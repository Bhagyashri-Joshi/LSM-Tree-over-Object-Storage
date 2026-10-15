export type ComponentCategory = 'traffic' | 'compute' | 'data'

export type SimulationComponentKind =
  | 'client'
  | 'load-balancer'
  | 'lsm-engine'
  | 'memtable'
  | 'wal'
  | 'sstable'
  | 'object-storage'

export interface SimulationComponent {
  id: string
  kind: SimulationComponentKind
  label: string
  category: ComponentCategory
  position: { x: number; y: number }
  description: string
}

export interface DirectedConnection {
  id: string
  sourceId: string
  targetId: string
  label?: string
  status: 'idle' | 'active' | 'blocked'
}

export type SimulationStatus = 'draft' | 'ready' | 'running' | 'paused' | 'complete' | 'error'

export interface MetricSnapshot {
  timestamp: number
  offeredLoadOpsPerSecond: number
  throughputOpsPerSecond: number | null
  p99LatencyMs: number | null
  logicalBytes: number | null
  physicalBytes: number | null
  objectOperations: number | null
}

export interface SimulationTopology {
  components: SimulationComponent[]
  connections: DirectedConnection[]
}
