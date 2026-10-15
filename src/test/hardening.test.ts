import { describe, expect, it } from 'vitest'
import { SimulationController, validateParameters } from '../simulation/SimulationController'

describe('simulation hardening', () => {
  it('completes an empty workload without emitting metrics or events', async () => {
    const controller = new SimulationController({ operationCount: 0 })
    expect(controller.snapshot().operationCount).toBe(0)
    await expect(controller.step()).resolves.toBeUndefined()
    expect(controller.snapshot()).toMatchObject({ status: 'complete', clockMs: 0, metrics: { completedOperations: 0 } })
    expect(controller.snapshot().events).toHaveLength(0)
  })

  it('ignores a stale asynchronous step after reset', async () => {
    const controller = new SimulationController({ workload: 'compaction-pressure', operationCount: 4, memtableMaxEntries: 1, storeOptions: { latencyMs: 1 } })
    const inFlight = controller.step()
    controller.reset()
    await expect(inFlight).resolves.toBeUndefined()
    expect(controller.snapshot()).toMatchObject({ status: 'ready', operationIndex: 0, clockMs: 0, metrics: { completedOperations: 0, successfulOperations: 0, logicalWriteBytes: 0 } })
  })

  it('prevents overlapping step calls from double-processing an operation', async () => {
    const controller = new SimulationController({ operationCount: 3, storeOptions: { latencyMs: 1 } })
    const [first, second] = await Promise.all([controller.step(), controller.step()])
    expect(Boolean(first)).not.toBe(Boolean(second))
    expect(controller.snapshot().metrics.completedOperations).toBe(1)
  })

  it('normalizes non-finite tuning input safely', () => {
    expect(validateParameters({ seed: Number.NaN, operationCount: Number.POSITIVE_INFINITY })).toMatchObject({ seed: 0, operationCount: 0 })
  })
})
