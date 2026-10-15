import { SimulationController, type SimulationMetrics, type SimulationParameters } from './SimulationController'
import type { WorkloadKind } from './workloads'

export interface EducationalScenario {
  id: 'small-memtable' | 'workload-mix' | 'burst-compaction' | 'compaction-cost'
  title: string
  objective: string
  setup: string
  expectedObservation: string
  conclusion: string
}

export const educationalScenarios: EducationalScenario[] = [
  { id: 'small-memtable', title: 'Smaller MemTable', objective: 'Relate buffer capacity to flush frequency.', setup: 'Hold workload and seed constant; compare 2 entries against 8 entries.', expectedObservation: 'Hypothesis: the smaller threshold may create more SSTables and flushes.', conclusion: 'Smaller buffers trade shorter in-memory residence for more storage work.' },
  { id: 'workload-mix', title: 'Write-heavy vs read-heavy', objective: 'Contrast read-path and write-path storage work.', setup: 'Run each workload separately with the same seed and operation count.', expectedObservation: 'Hypothesis: write-heavy runs may upload more table bytes, while reads may issue more object reads after flushes.', conclusion: 'Workload mix changes which LSM path dominates observed metrics.' },
  { id: 'burst-compaction', title: 'Burst writes', objective: 'Observe a burst crossing flush and compaction thresholds.', setup: 'Select Burst writes and reduce the MemTable threshold.', expectedObservation: 'Hypothesis: concentrated writes may create flushes in close succession and trigger compaction.', conclusion: 'Bursts can shift work from the write buffer into immutable tables quickly.' },
  { id: 'compaction-cost', title: 'Compaction cost', objective: 'Relate table merging to storage bytes and amplification.', setup: 'Select Compaction pressure; keep seed fixed and compare small versus large MemTables.', expectedObservation: 'Hypothesis: configurations that compact more often may upload more replacement bytes.', conclusion: 'Write amplification includes bytes uploaded during compaction, not just initial flushes.' },
]

export interface ComparisonResult {
  workload: WorkloadKind
  seed: number
  operationCount: number
  baseline: { parameters: SimulationParameters; metrics: SimulationMetrics }
  candidate: { parameters: SimulationParameters; metrics: SimulationMetrics }
}

/** Runs isolated controllers to avoid changing live canvas state. Both sides share workload, seed, and count. */
export async function compareConfigurations(workload: WorkloadKind, baseline: SimulationParameters, candidate: SimulationParameters): Promise<ComparisonResult> {
  const shared = { workload, seed: candidate.seed, operationCount: candidate.operationCount, offeredLoadOpsPerSecond: 10 }
  const left = new SimulationController({ ...shared, memtableMaxEntries: baseline.memtableMaxEntries, level0CompactionTrigger: baseline.level0CompactionTrigger })
  const right = new SimulationController({ ...shared, memtableMaxEntries: candidate.memtableMaxEntries, level0CompactionTrigger: candidate.level0CompactionTrigger })
  await runToCompletion(left)
  await runToCompletion(right)
  return { workload, seed: shared.seed, operationCount: shared.operationCount, baseline: { parameters: { ...baseline, seed: shared.seed, operationCount: shared.operationCount }, metrics: left.snapshot().metrics }, candidate: { parameters: { ...candidate }, metrics: right.snapshot().metrics } }
}

async function runToCompletion(controller: SimulationController): Promise<void> {
  while (controller.snapshot().status !== 'complete') await controller.step()
}
