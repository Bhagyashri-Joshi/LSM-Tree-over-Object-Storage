import { describe, expect, it } from 'vitest'
import { SimulationController, validateParameters } from '../simulation/SimulationController'
import { compareConfigurations, educationalScenarios } from '../simulation/experiments'

describe('parameter tuning', () => {
  it('normalizes parameter values to supported deterministic ranges', () => {
    expect(validateParameters({ memtableMaxEntries: 0, operationCount: 999, seed: -1, level0CompactionTrigger: 1 })).toEqual({ memtableMaxEntries: 1, operationCount: 200, seed: 0, level0CompactionTrigger: 2 })
  })

  it('applies a new MemTable threshold through a reset engine', async () => {
    const simulation = new SimulationController({ workload: 'compaction-pressure', operationCount: 4, memtableMaxEntries: 8 })
    simulation.setParameters({ memtableMaxEntries: 2 })
    for (let index = 0; index < 4; index += 1) await simulation.step()
    expect(simulation.snapshot().parameters.memtableMaxEntries).toBe(2)
    expect(simulation.snapshot().metrics.flushes).toBe(2)
  })
})

describe('repeatable comparisons', () => {
  it('runs isolated, repeatable configurations with a shared workload and seed', async () => {
    const baseline = { memtableMaxEntries: 8, level0CompactionTrigger: 3, operationCount: 16, seed: 22 }
    const candidate = { memtableMaxEntries: 2, level0CompactionTrigger: 3, operationCount: 16, seed: 22 }
    const first = await compareConfigurations('compaction-pressure', baseline, candidate)
    const second = await compareConfigurations('compaction-pressure', baseline, candidate)

    expect(first).toEqual(second)
    expect(first.baseline.metrics.completedOperations).toBe(16)
    expect(first.candidate.metrics.completedOperations).toBe(16)
    expect(first.candidate.metrics.flushes).toBeGreaterThan(first.baseline.metrics.flushes)
    expect(first.candidate.metrics.writeAmplification).toBeGreaterThanOrEqual(0)
  })

  it('defines four guided scenarios with hypotheses rather than guarantees', () => {
    expect(educationalScenarios).toHaveLength(4)
    expect(educationalScenarios.every((scenario) => scenario.expectedObservation.startsWith('Hypothesis:'))).toBe(true)
  })
})
