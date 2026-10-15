import { describe, expect, it } from 'vitest'
import { SimulationController } from '../simulation/SimulationController'
import { createWorkload } from '../simulation/workloads'

describe('workload generation', () => {
  it('is deterministic for the same kind, seed, and count', () => {
    expect(createWorkload('write-heavy', 42, 12)).toEqual(createWorkload('write-heavy', 42, 12))
    expect(createWorkload('write-heavy', 42, 12)).not.toEqual(createWorkload('read-heavy', 42, 12))
  })
})

describe('SimulationController', () => {
  it('advances one deterministic operation per step and records real metrics', async () => {
    const simulation = new SimulationController({ workload: 'compaction-pressure', seed: 4, operationCount: 12 })
    await simulation.step()
    await simulation.step()
    const snapshot = simulation.snapshot()

    expect(snapshot.status).toBe('paused')
    expect(snapshot.operationIndex).toBe(2)
    expect(snapshot.metrics.completedOperations).toBe(2)
    expect(snapshot.metrics.successfulOperations).toBe(2)
    expect(snapshot.clockMs).toBeGreaterThan(0)
    expect(snapshot.events).toHaveLength(2)
  })

  it('starts, pauses, and resets without changing the deterministic workload definition', async () => {
    const simulation = new SimulationController({ workload: 'write-heavy', seed: 9, operationCount: 4 })
    simulation.start()
    expect(simulation.snapshot().status).toBe('running')
    await simulation.step()
    simulation.pause()
    expect(simulation.snapshot().status).toBe('paused')
    simulation.reset()
    const reset = simulation.snapshot()
    expect(reset).toMatchObject({ status: 'ready', operationIndex: 0, clockMs: 0 })
    expect(reset.metrics.completedOperations).toBe(0)
    expect(reset.events).toHaveLength(0)
  })

  it('records flushes, compactions, and write amplification from engine/store events', async () => {
    const simulation = new SimulationController({ workload: 'compaction-pressure', seed: 2, operationCount: 14 })
    for (let index = 0; index < 14; index += 1) await simulation.step()
    const metrics = simulation.snapshot().metrics

    expect(metrics.flushes).toBeGreaterThan(0)
    expect(metrics.compactions).toBeGreaterThan(0)
    expect(metrics.objectOperations).toBeGreaterThan(0)
    expect(metrics.objectBytesWritten).toBeGreaterThan(0)
    expect(metrics.writeAmplification).toBeGreaterThan(0)
  })

  it('turns an injected object-store failure into a visible failed event', async () => {
    const simulation = new SimulationController({
      workload: 'compaction-pressure',
      operationCount: 4,
      failureRules: [{ operation: 'put' }],
    })
    for (let index = 0; index < 4; index += 1) await simulation.step()
    const snapshot = simulation.snapshot()

    expect(snapshot.metrics.failedOperations).toBe(1)
    expect(snapshot.events.some((event) => event.outcome === 'failure')).toBe(true)
  })
})
