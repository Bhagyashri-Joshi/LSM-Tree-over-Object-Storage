import { describe, expect, it } from 'vitest'
import { SimulatedObjectStore } from '../domain/object-storage/SimulatedObjectStore'
import { ObjectStorageError } from '../domain/object-storage/types'

const bytes = (value: string) => new TextEncoder().encode(value)

describe('SimulatedObjectStore', () => {
  it('lists objects by prefix and tracks stored bytes', async () => {
    const store = new SimulatedObjectStore()
    await store.putObject('sstables/a', bytes('one'))
    await store.putObject('wal/a', bytes('two'))
    await store.putObject('sstables/b', bytes('three'))

    expect((await store.listObjects('sstables/')).map((object) => object.key)).toEqual(['sstables/a', 'sstables/b'])
    expect(store.getStats()).toMatchObject({ putCount: 3, listCount: 1, objectCount: 3, storedBytes: 11 })
  })

  it('distinguishes a missing object from an injected storage failure', async () => {
    const store = new SimulatedObjectStore()
    await expect(store.getObject('missing')).rejects.toMatchObject({ code: 'NOT_FOUND', operation: 'get' } satisfies Partial<ObjectStorageError>)
    store.failNext({ operation: 'put', key: 'sstables/failing' })
    await expect(store.putObject('sstables/failing', bytes('x'))).rejects.toMatchObject({ code: 'OPERATION_FAILED', operation: 'put' } satisfies Partial<ObjectStorageError>)
  })
})
