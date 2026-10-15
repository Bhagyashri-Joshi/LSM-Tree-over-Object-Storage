export type WorkloadKind = 'write-heavy' | 'read-heavy' | 'burst-writes' | 'compaction-pressure'
export type WorkloadOperationKind = 'put' | 'update' | 'delete' | 'get'

export interface WorkloadOperation {
  id: number
  kind: WorkloadOperationKind
  key: string
  value?: string
}

export interface WorkloadDefinition {
  id: WorkloadKind
  label: string
  description: string
}

export const workloads: WorkloadDefinition[] = [
  { id: 'write-heavy', label: 'Write-heavy', description: 'Frequent puts and updates with occasional reads.' },
  { id: 'read-heavy', label: 'Read-heavy', description: 'Mostly reads against a small, stable key set.' },
  { id: 'burst-writes', label: 'Burst writes', description: 'Short repeated write bursts separated by reads.' },
  { id: 'compaction-pressure', label: 'Compaction pressure', description: 'Distinct writes sized to trigger flushes and compaction.' },
]

export function createWorkload(kind: WorkloadKind, seed = 17, count = 36): WorkloadOperation[] {
  const random = seededRandom(seed)
  const operations: WorkloadOperation[] = []
  const keyCount = kind === 'compaction-pressure' ? 24 : 8
  for (let index = 0; index < count; index += 1) {
    const key = `key-${kind === 'compaction-pressure' ? index % keyCount : Math.floor(random() * keyCount)}`
    const roll = random()
    const opKind = selectKind(kind, roll, index)
    operations.push({ id: index + 1, kind: opKind, key, value: opKind === 'get' || opKind === 'delete' ? undefined : `value-${seed}-${index + 1}` })
  }
  return operations
}

function selectKind(workload: WorkloadKind, roll: number, index: number): WorkloadOperationKind {
  if (workload === 'read-heavy') return roll < 0.65 ? 'get' : roll < 0.85 ? 'update' : 'put'
  if (workload === 'burst-writes') return index % 8 < 6 ? (roll < 0.7 ? 'put' : 'update') : 'get'
  if (workload === 'compaction-pressure') return index % 7 === 6 ? 'get' : index % 11 === 10 ? 'delete' : 'put'
  return roll < 0.48 ? 'put' : roll < 0.77 ? 'update' : roll < 0.9 ? 'delete' : 'get'
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}
