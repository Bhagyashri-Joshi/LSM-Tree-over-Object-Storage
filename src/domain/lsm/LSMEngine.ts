import type { ObjectStorage } from '../object-storage/types'
import { MemTable } from './MemTable'
import { createSSTableMetadata, deserializeSSTable, serializeSSTable } from './SSTable'
import { WriteAheadLog } from './WriteAheadLog'
import type { LSMEngineEvent, Mutation, ReadResult, SSTableMetadata } from './types'

export interface LSMEngineOptions {
  objectStorage: ObjectStorage
  wal?: WriteAheadLog
  memtableMaxEntries?: number
  level0CompactionTrigger?: number
  tablePrefix?: string
}

export interface CompactionResult {
  compacted: boolean
  inputTableCount: number
  outputTable?: SSTableMetadata
  cleanupFailures: string[]
}

/**
 * A deterministic, single-threaded LSM lifecycle model.
 *
 * Write order: append to the supplied WAL, apply to the memtable, then flush
 * when its entry threshold is met. A failed flush leaves its memtable data and
 * WAL records available for retry/replay. SSTable metadata is published only
 * after the simulated object store acknowledges the upload.
 */
export class LSMEngine {
  private memtable = new MemTable()
  private sequence = 0
  private tableSequence = 0
  private tables: SSTableMetadata[] = []
  private events: LSMEngineEvent[] = []
  private readonly maxMemtableEntries: number
  private readonly compactionTrigger: number
  private readonly tablePrefix: string
  readonly wal: WriteAheadLog

  constructor(private readonly options: LSMEngineOptions) {
    this.wal = options.wal ?? new WriteAheadLog()
    this.maxMemtableEntries = options.memtableMaxEntries ?? 4
    this.compactionTrigger = options.level0CompactionTrigger ?? 4
    this.tablePrefix = options.tablePrefix ?? 'sstables/'
    if (this.maxMemtableEntries < 1) throw new Error('memtableMaxEntries must be at least 1')
  }

  async put(key: string, value: string): Promise<void> { await this.write({ key, value, kind: 'put' }) }
  async update(key: string, value: string): Promise<void> { await this.put(key, value) }
  async delete(key: string): Promise<void> { await this.write({ key, value: null, kind: 'delete' }) }

  async get(key: string): Promise<ReadResult> {
    let latest = this.memtable.get(key)
    for (const table of this.tables) {
      const object = await this.options.objectStorage.getObject(table.objectKey)
      const candidate = deserializeSSTable(object.data).entries.find((entry) => entry.key === key)
      if (candidate && (!latest || candidate.sequence > latest.sequence)) latest = candidate
    }
    if (!latest) return { found: false }
    if (latest.kind === 'delete') return { found: false, sequence: latest.sequence }
    return { found: true, value: latest.value!, sequence: latest.sequence }
  }

  async flush(): Promise<SSTableMetadata | undefined> {
    const entries = this.memtable.sortedEntries()
    if (entries.length === 0) return undefined
    const id = `sst-${String(++this.tableSequence).padStart(6, '0')}`
    const objectKey = `${this.tablePrefix}${id}.json`
    const bytes = serializeSSTable(entries)
    // Upload first. This can throw; in that case no catalogue state is changed.
    const stored = await this.options.objectStorage.putObject(objectKey, bytes)
    const metadata = createSSTableMetadata(id, objectKey, 0, entries, stored.sizeBytes)
    // Publish only after a successful upload, then clear exactly those entries.
    this.memtable.drainSorted()
    this.tables = [metadata, ...this.tables]
    this.events.push({ type: 'flush', table: { ...metadata } })
    if (this.tables.filter((table) => table.level === 0).length >= this.compactionTrigger) await this.compact()
    return metadata
  }

  /** Compacts the complete active catalogue, making tombstone elision safe in this simplified model. */
  async compact(): Promise<CompactionResult> {
    const inputTables = [...this.tables]
    if (inputTables.length === 0) return { compacted: false, inputTableCount: 0, cleanupFailures: [] }
    const latestByKey = new Map<string, Mutation>()
    for (const table of inputTables) {
      const object = await this.options.objectStorage.getObject(table.objectKey)
      for (const entry of deserializeSSTable(object.data).entries) {
        const current = latestByKey.get(entry.key)
        if (!current || entry.sequence > current.sequence) latestByKey.set(entry.key, entry)
      }
    }
    // Every active table participates, so older values cannot remain elsewhere.
    const outputEntries = [...latestByKey.values()].filter((entry) => entry.kind !== 'delete').sort((a, b) => a.key.localeCompare(b.key))
    if (outputEntries.length === 0) {
      this.tables = []
      const cleanupFailures = await this.removeObsolete(inputTables)
      this.events.push({ type: 'compaction', inputTableCount: inputTables.length, cleanupFailures })
      return { compacted: true, inputTableCount: inputTables.length, cleanupFailures }
    }
    const id = `sst-${String(++this.tableSequence).padStart(6, '0')}`
    const objectKey = `${this.tablePrefix}${id}.json`
    const bytes = serializeSSTable(outputEntries)
    const stored = await this.options.objectStorage.putObject(objectKey, bytes)
    const output = createSSTableMetadata(id, objectKey, 1, outputEntries, stored.sizeBytes)
    // The replacement is durable before it replaces active metadata.
    this.tables = [output]
    const cleanupFailures = await this.removeObsolete(inputTables)
    this.events.push({ type: 'compaction', inputTableCount: inputTables.length, outputTable: { ...output }, cleanupFailures })
    return { compacted: true, inputTableCount: inputTables.length, outputTable: output, cleanupFailures }
  }

  /** Rebuilds the memtable from the supplied WAL. The WAL itself is intentionally retained. */
  recoverFromWal(): void {
    this.memtable = new MemTable()
    this.sequence = 0
    for (const entry of this.wal.replay()) {
      this.memtable.apply(entry)
      this.sequence = Math.max(this.sequence, entry.sequence)
    }
  }

  get tableMetadata(): readonly SSTableMetadata[] { return this.tables.map((table) => ({ ...table })) }
  get memtableEntryCount(): number { return this.memtable.size }
  get memtableEntries(): readonly Mutation[] { return this.memtable.sortedEntries() }
  get walEntries(): readonly Mutation[] { return this.wal.replay() }
  drainEvents(): LSMEngineEvent[] {
    const events = this.events.map((event) => event.type === 'flush'
      ? { type: 'flush' as const, table: { ...event.table } }
      : { ...event, outputTable: event.outputTable ? { ...event.outputTable } : undefined, cleanupFailures: [...event.cleanupFailures] })
    this.events = []
    return events
  }

  private async write(mutation: Omit<Mutation, 'sequence'>): Promise<void> {
    const entry: Mutation = { ...mutation, sequence: ++this.sequence }
    this.wal.append(entry)
    this.memtable.apply(entry)
    if (this.memtable.size >= this.maxMemtableEntries) await this.flush()
  }

  private async removeObsolete(tables: SSTableMetadata[]): Promise<string[]> {
    const failures: string[] = []
    for (const table of tables) {
      try { await this.options.objectStorage.deleteObject(table.objectKey) } catch (error) { failures.push(error instanceof Error ? error.message : String(error)) }
    }
    return failures
  }
}
