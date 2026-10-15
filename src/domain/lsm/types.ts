export type MutationKind = 'put' | 'delete'

export interface Mutation {
  key: string
  value: string | null
  kind: MutationKind
  sequence: number
}

export interface WalEntry extends Mutation {}

export interface SSTableMetadata {
  id: string
  objectKey: string
  level: number
  entryCount: number
  minSequence: number
  maxSequence: number
  sizeBytes: number
}

export interface SSTableData {
  format: 'lsm-lab/sstable-v1'
  entries: Mutation[]
}

export interface ReadResult {
  found: boolean
  value?: string
  sequence?: number
}

export type LSMEngineEvent =
  | { type: 'flush'; table: SSTableMetadata }
  | { type: 'compaction'; inputTableCount: number; outputTable?: SSTableMetadata; cleanupFailures: string[] }
