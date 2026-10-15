import { describe, expect, it } from 'vitest'
import { LSMEngine, WriteAheadLog, deserializeSSTable, serializeSSTable } from '../domain/lsm'
import { SimulatedObjectStore } from '../domain/object-storage/SimulatedObjectStore'
import type { Mutation } from '../domain/lsm/types'

function createEngine(options: { threshold?: number; compactAt?: number; store?: SimulatedObjectStore; wal?: WriteAheadLog } = {}) {
  const store = options.store ?? new SimulatedObjectStore()
  const engine = new LSMEngine({ objectStorage: store, wal: options.wal, memtableMaxEntries: options.threshold ?? 2, level0CompactionTrigger: options.compactAt ?? 99 })
  return { engine, store }
}

describe('SSTable serialization', () => {
  it('round-trips a stable key-sorted representation', () => {
    const entries: Mutation[] = [
      { key: 'z', value: 'last', kind: 'put', sequence: 2 },
      { key: 'a', value: null, kind: 'delete', sequence: 1 },
    ]
    const restored = deserializeSSTable(serializeSSTable(entries))
    expect(restored.entries.map((entry) => entry.key)).toEqual(['a', 'z'])
    expect(restored.entries[0]).toMatchObject({ kind: 'delete', value: null })
  })
})

describe('LSMEngine', () => {
  it('writes and reads a value through the memtable', async () => {
    const { engine } = createEngine()
    await engine.put('account:1', 'gold')
    await expect(engine.get('account:1')).resolves.toEqual({ found: true, value: 'gold', sequence: 1 })
  })

  it('returns the latest value after an update', async () => {
    const { engine } = createEngine()
    await engine.put('account:1', 'bronze')
    await engine.update('account:1', 'platinum')
    await expect(engine.get('account:1')).resolves.toMatchObject({ found: true, value: 'platinum', sequence: 2 })
  })

  it('keeps tombstones authoritative for deleted keys', async () => {
    const { engine } = createEngine({ threshold: 1 })
    await engine.put('account:1', 'present')
    await engine.delete('account:1')
    await expect(engine.get('account:1')).resolves.toEqual({ found: false, sequence: 2 })
  })

  it('uses the newest version across multiple SSTables', async () => {
    const { engine } = createEngine({ threshold: 1 })
    await engine.put('account:1', 'v1')
    await engine.update('account:1', 'v2')
    expect(engine.tableMetadata).toHaveLength(2)
    await expect(engine.get('account:1')).resolves.toMatchObject({ found: true, value: 'v2', sequence: 2 })
  })

  it('flushes when the unique memtable-entry threshold is reached', async () => {
    const { engine, store } = createEngine({ threshold: 2 })
    await engine.put('a', '1')
    expect(engine.memtableEntryCount).toBe(1)
    await engine.put('b', '2')
    expect(engine.memtableEntryCount).toBe(0)
    expect(engine.tableMetadata).toHaveLength(1)
    await expect(store.listObjects('sstables/')).resolves.toHaveLength(1)
  })

  it('compacts to the newest value only', async () => {
    const { engine } = createEngine({ threshold: 1 })
    await engine.put('a', 'old')
    await engine.update('a', 'new')
    const result = await engine.compact()
    expect(result).toMatchObject({ compacted: true, inputTableCount: 2, outputTable: { level: 1 } })
    expect(engine.tableMetadata).toHaveLength(1)
    await expect(engine.get('a')).resolves.toMatchObject({ found: true, value: 'new', sequence: 2 })
  })

  it('removes tombstones only after compacting the full active catalogue', async () => {
    const { engine, store } = createEngine({ threshold: 1 })
    await engine.put('a', 'old')
    await engine.delete('a')
    await engine.compact()
    expect(engine.tableMetadata).toHaveLength(0)
    await expect(engine.get('a')).resolves.toEqual({ found: false })
    await expect(store.listObjects('sstables/')).resolves.toHaveLength(0)
  })

  it('preserves existing catalogue metadata when an SSTable upload fails', async () => {
    const { engine, store } = createEngine({ threshold: 1 })
    await engine.put('durable', 'first')
    const previous = engine.tableMetadata
    store.failNext({ operation: 'put' })
    await expect(engine.put('newer', 'second')).rejects.toMatchObject({ code: 'OPERATION_FAILED' })
    expect(engine.tableMetadata).toEqual(previous)
    await expect(engine.get('durable')).resolves.toMatchObject({ found: true, value: 'first' })
    await expect(store.listObjects('sstables/')).resolves.toHaveLength(1)
  })

  it('replays the WAL on a simulated restart', async () => {
    const wal = new WriteAheadLog()
    const store = new SimulatedObjectStore()
    const first = new LSMEngine({ objectStorage: store, wal, memtableMaxEntries: 99 })
    await first.put('a', 'one')
    await first.update('a', 'two')
    await first.delete('b')

    const restarted = new LSMEngine({ objectStorage: store, wal, memtableMaxEntries: 99 })
    restarted.recoverFromWal()
    await expect(restarted.get('a')).resolves.toMatchObject({ found: true, value: 'two', sequence: 2 })
    await expect(restarted.get('b')).resolves.toEqual({ found: false, sequence: 3 })
  })
})
