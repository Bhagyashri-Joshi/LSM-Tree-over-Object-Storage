import { ObjectStorageError, type ObjectMetadata, type ObjectStorage, type ObjectStorageStats, type StorageOperation, type StoredObject } from './types'

export interface FailureRule {
  operation: StorageOperation
  key?: string
  /** Number of matching calls that should fail. Defaults to one. */
  times?: number
}

export interface SimulatedObjectStoreOptions {
  /** Fixed latency per operation. It is intentionally deterministic. */
  latencyMs?: number
  failures?: FailureRule[]
}

interface PendingFailure extends FailureRule { times: number }

/**
 * An explicitly simulated, in-memory object store. It has no network, cloud
 * credentials, or persistence beyond the lifetime of this JavaScript object.
 */
export class SimulatedObjectStore implements ObjectStorage {
  readonly isSimulated = true
  private readonly objects = new Map<string, StoredObject>()
  private readonly failures: PendingFailure[]
  private readonly latencyMs: number
  private logicalTime = 0
  private stats = { putCount: 0, getCount: 0, listCount: 0, deleteCount: 0, putBytes: 0, getBytes: 0, deletedBytes: 0 }

  constructor(options: SimulatedObjectStoreOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0
    this.failures = (options.failures ?? []).map((rule) => ({ ...rule, times: rule.times ?? 1 }))
  }

  failNext(rule: FailureRule): void {
    this.failures.push({ ...rule, times: rule.times ?? 1 })
  }

  async putObject(key: string, data: Uint8Array): Promise<ObjectMetadata> {
    await this.beforeOperation('put', key)
    this.stats.putCount += 1
    this.stats.putBytes += data.byteLength
    const prior = this.objects.get(key)
    const now = this.nextTime()
    const object: StoredObject = {
      key,
      data: new Uint8Array(data),
      sizeBytes: data.byteLength,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    }
    this.objects.set(key, object)
    return this.toMetadata(object)
  }

  async getObject(key: string): Promise<StoredObject> {
    await this.beforeOperation('get', key)
    this.stats.getCount += 1
    const object = this.objects.get(key)
    if (!object) throw new ObjectStorageError(`Object not found: ${key}`, 'NOT_FOUND', 'get', key)
    this.stats.getBytes += object.sizeBytes
    return { ...object, data: new Uint8Array(object.data) }
  }

  async listObjects(prefix: string): Promise<ObjectMetadata[]> {
    await this.beforeOperation('list')
    this.stats.listCount += 1
    return [...this.objects.values()]
      .filter((object) => object.key.startsWith(prefix))
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((object) => this.toMetadata(object))
  }

  async deleteObject(key: string): Promise<void> {
    await this.beforeOperation('delete', key)
    this.stats.deleteCount += 1
    const object = this.objects.get(key)
    if (object) this.stats.deletedBytes += object.sizeBytes
    this.objects.delete(key)
  }

  getStats(): ObjectStorageStats {
    return {
      ...this.stats,
      objectCount: this.objects.size,
      storedBytes: [...this.objects.values()].reduce((total, object) => total + object.sizeBytes, 0),
    }
  }

  /** Read-only metadata view for the educational inspector. */
  inspectObjects(prefix = ''): ObjectMetadata[] {
    return [...this.objects.values()]
      .filter((object) => object.key.startsWith(prefix))
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((object) => this.toMetadata(object))
  }

  private async beforeOperation(operation: StorageOperation, key?: string): Promise<void> {
    if (this.latencyMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs))
    const failure = this.failures.find((rule) => rule.times > 0 && rule.operation === operation && (rule.key === undefined || rule.key === key))
    if (failure) {
      failure.times -= 1
      throw new ObjectStorageError(`Simulated ${operation} failure${key ? ` for ${key}` : ''}`, 'OPERATION_FAILED', operation, key)
    }
  }

  private nextTime(): number { this.logicalTime += 1; return this.logicalTime }
  private toMetadata(object: StoredObject): ObjectMetadata {
    const { data: _data, ...metadata } = object
    return metadata
  }
}
