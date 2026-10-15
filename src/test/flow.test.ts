import { describe, expect, it } from 'vitest'
import { mapEventToFlow } from '../simulation/flow'
import type { SimulationEvent } from '../simulation/SimulationController'

function event(overrides: Partial<SimulationEvent> = {}): SimulationEvent {
  return {
    id: 1, timestampMs: 1, outcome: 'success', detail: 'PUT key-1', latencyMs: 1, storageOperations: 0,
    operation: { id: 1, kind: 'put', key: 'key-1', value: 'value' }, lifecycleEvents: [], ...overrides,
  }
}

describe('event flow mapping', () => {
  it('maps writes, reads, and flushes to distinct active paths', () => {
    expect(mapEventToFlow(event())).toEqual({ state: 'write', activeConnectionIds: ['client-engine', 'engine-wal', 'engine-memtable'] })
    expect(mapEventToFlow(event({ operation: { id: 1, kind: 'get', key: 'key-1' } }))).toEqual({ state: 'read', activeConnectionIds: ['client-engine', 'engine-storage'] })
    expect(mapEventToFlow(event({ lifecycleEvents: [{ type: 'flush', table: { id: 'sst-1', objectKey: 'sstables/sst-1', level: 0, entryCount: 1, minSequence: 1, maxSequence: 1, sizeBytes: 2 } }] })).state).toBe('flush')
  })

  it('maps failures to a visible failed state', () => {
    expect(mapEventToFlow(event({ outcome: 'failure', detail: 'Simulated put failure' }))).toEqual({ state: 'failed', activeConnectionIds: ['client-engine'] })
  })
})
