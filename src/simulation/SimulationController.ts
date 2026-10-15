import { LSMEngine, type LSMEngineEvent, type Mutation, type SSTableMetadata } from '../domain/lsm'
import { SimulatedObjectStore, type FailureRule, type SimulatedObjectStoreOptions } from '../domain/object-storage'
import type { ObjectMetadata } from '../domain/object-storage'
import { SimulationClock } from './SimulationClock'
import { mapEventToFlow, type FlowState } from './flow'
import { createWorkload, type WorkloadKind, type WorkloadOperation } from './workloads'

export type SimulationRunStatus = 'ready' | 'running' | 'paused' | 'complete'

export interface SimulationMetrics {
  completedOperations: number
  successfulOperations: number
  failedOperations: number
  throughputOpsPerSecond: number
  averageLatencyMs: number
  p99LatencyMs: number
  flushes: number
  compactions: number
  objectOperations: number
  objectBytesWritten: number
  objectBytesRead: number
  physicalBytes: number
  logicalWriteBytes: number
  /** SSTable bytes uploaded / logical client write bytes. Zero until a write is accepted. */
  writeAmplification: number
}

export interface SimulationEvent {
  id: number
  timestampMs: number
  operation: WorkloadOperation
  outcome: 'success' | 'failure'
  detail: string
  latencyMs: number
  storageOperations: number
  lifecycleEvents: LSMEngineEvent[]
}

export interface SimulationSnapshot {
  status: SimulationRunStatus
  workload: WorkloadKind
  offeredLoadOpsPerSecond: number
  operationIndex: number
  operationCount: number
  clockMs: number
  metrics: SimulationMetrics
  events: SimulationEvent[]
  activeConnectionIds: string[]
  flowState: FlowState
  parameters: SimulationParameters
  inspection: { memtableEntries: readonly Mutation[]; walEntries: readonly Mutation[]; tables: readonly SSTableMetadata[]; objects: readonly ObjectMetadata[] }
}

export interface SimulationControllerOptions {
  workload?: WorkloadKind
  seed?: number
  operationCount?: number
  offeredLoadOpsPerSecond?: number
  storeOptions?: SimulatedObjectStoreOptions
  failureRules?: FailureRule[]
  memtableMaxEntries?: number
  level0CompactionTrigger?: number
}

export interface SimulationParameters {
  memtableMaxEntries: number
  level0CompactionTrigger: number
  operationCount: number
  seed: number
}

export function validateParameters(parameters: Partial<SimulationParameters>): SimulationParameters {
  return {
    memtableMaxEntries: clampInteger(parameters.memtableMaxEntries ?? 4, 1, 64),
    level0CompactionTrigger: clampInteger(parameters.level0CompactionTrigger ?? 3, 2, 16),
    operationCount: clampInteger(parameters.operationCount ?? 36, 0, 200),
    seed: clampInteger(parameters.seed ?? 17, 0, 2_147_483_647),
  }
}

const emptyMetrics = (): SimulationMetrics => ({
  completedOperations: 0, successfulOperations: 0, failedOperations: 0,
  throughputOpsPerSecond: 0, averageLatencyMs: 0, p99LatencyMs: 0,
  flushes: 0, compactions: 0, objectOperations: 0, objectBytesWritten: 0,
  objectBytesRead: 0, physicalBytes: 0, logicalWriteBytes: 0, writeAmplification: 0,
})

/** Coordinates one deterministic workload with the real Stage 2 engine and simulated store. */
export class SimulationController {
  private readonly clock = new SimulationClock()
  private parameters: SimulationParameters
  private readonly storeOptions: SimulatedObjectStoreOptions
  private operations: WorkloadOperation[] = []
  private status: SimulationRunStatus = 'ready'
  private cursor = 0
  private sequence = 0
  private offeredLoad: number
  private selectedWorkload: WorkloadKind
  private store!: SimulatedObjectStore
  private engine!: LSMEngine
  private metrics = emptyMetrics()
  private events: SimulationEvent[] = []
  private latencies: number[] = []
  private activeConnectionIds: string[] = []
  private flowState: FlowState = 'idle'
  private generation = 0
  private stepInProgress = false

  constructor(options: SimulationControllerOptions = {}) {
    this.parameters = validateParameters({ seed: options.seed, operationCount: options.operationCount, memtableMaxEntries: options.memtableMaxEntries, level0CompactionTrigger: options.level0CompactionTrigger })
    this.selectedWorkload = options.workload ?? 'write-heavy'
    this.offeredLoad = options.offeredLoadOpsPerSecond ?? 10
    this.storeOptions = { ...options.storeOptions, failures: [...(options.storeOptions?.failures ?? []), ...(options.failureRules ?? [])] }
    this.rebuild()
  }

  start(): void { if (this.status !== 'complete') this.status = 'running' }
  pause(): void { if (this.status === 'running') this.status = 'paused' }
  setOfferedLoad(value: number): void { this.offeredLoad = Math.max(1, Math.min(100000, Math.floor(value) || 1)) }
  setWorkload(workload: WorkloadKind): void { if (this.status !== 'running') { this.selectedWorkload = workload; this.reset() } }
  setParameters(parameters: Partial<SimulationParameters>): void {
    if (this.status === 'running') return
    this.parameters = validateParameters({ ...this.parameters, ...parameters })
    this.reset()
  }
  reset(): void { this.rebuild() }

  async step(): Promise<SimulationEvent | undefined> {
    if (this.status === 'complete' || this.stepInProgress) return undefined
    this.stepInProgress = true
    const generation = this.generation
    const store = this.store
    const engine = this.engine
    try {
    const operation = this.operations[this.cursor]
    if (!operation) { this.status = 'complete'; return undefined }
    const before = store.getStats()
    let outcome: SimulationEvent['outcome'] = 'success'
    let detail = ''
    let logicalWriteBytes = 0
    try {
      if (operation.kind === 'get') {
        const result = await engine.get(operation.key)
        detail = result.found ? `GET ${operation.key} → ${result.value}` : `GET ${operation.key} → miss`
      } else if (operation.kind === 'delete') {
        await engine.delete(operation.key)
        logicalWriteBytes = byteLength(operation.key)
        detail = `DELETE ${operation.key}`
      } else if (operation.kind === 'update') {
        await engine.update(operation.key, operation.value!)
        logicalWriteBytes = byteLength(operation.key) + byteLength(operation.value!)
        detail = `UPDATE ${operation.key}`
      } else {
        await engine.put(operation.key, operation.value!)
        logicalWriteBytes = byteLength(operation.key) + byteLength(operation.value!)
        detail = `PUT ${operation.key}`
      }
    } catch (error) {
      outcome = 'failure'
      detail = error instanceof Error ? error.message : String(error)
    }
    const after = store.getStats()
    if (generation !== this.generation) return undefined
    if (outcome === 'success') {
      this.metrics.successfulOperations += 1
      this.metrics.logicalWriteBytes += logicalWriteBytes
    } else {
      this.metrics.failedOperations += 1
    }
    const storageOperations = (after.putCount - before.putCount) + (after.getCount - before.getCount) + (after.listCount - before.listCount) + (after.deleteCount - before.deleteCount)
    const latencyMs = 1 + storageOperations
    this.clock.advance(latencyMs)
    this.latencies.push(latencyMs)
    const lifecycleEvents = engine.drainEvents()
    this.metrics.completedOperations += 1
    this.metrics.flushes += lifecycleEvents.filter((event) => event.type === 'flush').length
    this.metrics.compactions += lifecycleEvents.filter((event) => event.type === 'compaction').length
    this.cursor += 1
    if (this.cursor >= this.operations.length) this.status = 'complete'
    else if (this.status !== 'running') this.status = 'paused'
    this.refreshMetrics()
    const event: SimulationEvent = { id: ++this.sequence, timestampMs: this.clock.now, operation: { ...operation }, outcome, detail, latencyMs, storageOperations, lifecycleEvents }
    this.events = [event, ...this.events].slice(0, 80)
    const flow = mapEventToFlow(event)
    this.activeConnectionIds = flow.activeConnectionIds
    this.flowState = flow.state
    return event
    } finally {
      this.stepInProgress = false
    }
  }

  snapshot(): SimulationSnapshot {
    return {
      status: this.status, workload: this.selectedWorkload, offeredLoadOpsPerSecond: this.offeredLoad,
      operationIndex: this.cursor, operationCount: this.operations.length, clockMs: this.clock.now,
      metrics: { ...this.metrics }, events: this.events.map((event) => ({ ...event, operation: { ...event.operation }, lifecycleEvents: [...event.lifecycleEvents] })),
      activeConnectionIds: [...this.activeConnectionIds],
      flowState: this.flowState,
      parameters: { ...this.parameters },
      inspection: { memtableEntries: this.engine.memtableEntries, walEntries: this.engine.walEntries, tables: this.engine.tableMetadata, objects: this.store.inspectObjects() },
    }
  }

  private rebuild(): void {
    this.generation += 1
    this.clock.reset()
    this.store = new SimulatedObjectStore(this.storeOptions)
    this.engine = new LSMEngine({ objectStorage: this.store, memtableMaxEntries: this.parameters.memtableMaxEntries, level0CompactionTrigger: this.parameters.level0CompactionTrigger })
    this.operations = createWorkload(this.selectedWorkload, this.parameters.seed, this.parameters.operationCount)
    this.status = 'ready'; this.cursor = 0; this.sequence = 0; this.metrics = emptyMetrics(); this.events = []; this.latencies = []; this.activeConnectionIds = []; this.flowState = 'idle'
  }

  private refreshMetrics(): void {
    const stats = this.store.getStats()
    this.metrics.objectOperations = stats.putCount + stats.getCount + stats.listCount + stats.deleteCount
    this.metrics.objectBytesWritten = stats.putBytes
    this.metrics.objectBytesRead = stats.getBytes
    this.metrics.physicalBytes = stats.storedBytes
    this.metrics.writeAmplification = this.metrics.logicalWriteBytes === 0 ? 0 : stats.putBytes / this.metrics.logicalWriteBytes
    this.metrics.averageLatencyMs = this.latencies.reduce((sum, value) => sum + value, 0) / this.latencies.length
    const sorted = [...this.latencies].sort((a, b) => a - b)
    this.metrics.p99LatencyMs = sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99) - 1)]
    this.metrics.throughputOpsPerSecond = this.clock.now === 0 ? 0 : this.metrics.successfulOperations / (this.clock.now / 1000)
  }
}

function byteLength(value: string): number { return new TextEncoder().encode(value).byteLength }
function clampInteger(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, Number.isFinite(value) ? Math.floor(value) : min)) }
