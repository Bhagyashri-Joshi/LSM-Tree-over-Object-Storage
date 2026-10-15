export type StorageOperation = 'put' | 'get' | 'list' | 'delete'

export interface ObjectMetadata {
  key: string
  sizeBytes: number
  createdAt: number
  updatedAt: number
}

export interface StoredObject extends ObjectMetadata {
  data: Uint8Array
}

export interface ObjectStorageStats {
  putCount: number
  getCount: number
  listCount: number
  deleteCount: number
  putBytes: number
  getBytes: number
  deletedBytes: number
  objectCount: number
  storedBytes: number
}

export interface ObjectStorage {
  /** This remains false for the in-memory implementation shipped in LSM Lab. */
  readonly isSimulated: boolean
  putObject(key: string, data: Uint8Array): Promise<ObjectMetadata>
  getObject(key: string): Promise<StoredObject>
  listObjects(prefix: string): Promise<ObjectMetadata[]>
  deleteObject(key: string): Promise<void>
  getStats(): ObjectStorageStats
}

export class ObjectStorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'OPERATION_FAILED',
    public readonly operation: StorageOperation,
    public readonly key?: string,
  ) {
    super(message)
    this.name = 'ObjectStorageError'
  }
}
