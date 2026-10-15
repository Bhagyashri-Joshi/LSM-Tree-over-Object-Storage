import type { SimulationEvent } from './SimulationController'

export type FlowState = 'idle' | 'write' | 'read' | 'flush' | 'compaction' | 'failed'

export interface FlowVisualState {
  state: FlowState
  activeConnectionIds: string[]
}

export function mapEventToFlow(event: SimulationEvent | undefined): FlowVisualState {
  if (!event) return { state: 'idle', activeConnectionIds: [] }
  if (event.outcome === 'failure') return { state: 'failed', activeConnectionIds: ['client-engine'] }
  if (event.lifecycleEvents.some((entry) => entry.type === 'compaction')) return {
    state: 'compaction', activeConnectionIds: ['client-engine', 'engine-wal', 'engine-memtable', 'memtable-sstables', 'sstables-compaction', 'compaction-storage'],
  }
  if (event.lifecycleEvents.some((entry) => entry.type === 'flush')) return {
    state: 'flush', activeConnectionIds: ['client-engine', 'engine-wal', 'engine-memtable', 'memtable-sstables', 'sstables-storage'],
  }
  if (event.operation.kind === 'get') return { state: 'read', activeConnectionIds: ['client-engine', 'engine-storage'] }
  return { state: 'write', activeConnectionIds: ['client-engine', 'engine-wal', 'engine-memtable'] }
}
