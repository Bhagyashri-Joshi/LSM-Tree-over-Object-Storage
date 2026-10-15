import { FlaskConical, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SimulationParameters, SimulationSnapshot } from '../simulation/SimulationController'
import { compareConfigurations, educationalScenarios, type ComparisonResult } from '../simulation/experiments'

export function ExperimentPanel({ snapshot, setParameters }: { snapshot: SimulationSnapshot; setParameters: (parameters: Partial<SimulationParameters>) => void }) {
  const [scenarioId, setScenarioId] = useState(educationalScenarios[0].id)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [running, setRunning] = useState(false)
  const scenario = useMemo(() => educationalScenarios.find((item) => item.id === scenarioId)!, [scenarioId])
  const disabled = snapshot.status === 'running'
  const update = (name: keyof SimulationParameters, value: number) => { setResult(null); setParameters({ [name]: value }) }
  const compare = async () => {
    setRunning(true)
    const baseline = baselineForScenario(scenarioId, snapshot.parameters)
    try { setResult(await compareConfigurations(snapshot.workload, baseline, snapshot.parameters)) } finally { setRunning(false) }
  }
  return <section className="border-b border-line bg-[#0e141b] px-3 py-2" aria-label="Experiments and parameter tuning">
    <div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><FlaskConical size={14} className="text-amber-300" /> Experiments</div>
      <select aria-label="Educational scenario" className="rounded border border-line bg-[#111820] px-2 py-1 text-xs text-slate-300 outline-none" disabled={disabled} value={scenarioId} onChange={(event) => { setScenarioId(event.target.value as typeof scenarioId); setResult(null) }}>{educationalScenarios.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      <span className="text-[11px] text-slate-500">Deterministic model · same workload, seed, and count per comparison</span>
    </div>
    <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(430px,1fr)_minmax(330px,0.8fr)]">
      <div className="rounded border border-line bg-[#111820]/70 p-2"><p className="text-xs text-slate-300">{scenario.objective}</p><p className="mt-1 text-[11px] text-slate-500"><b className="font-medium text-slate-400">Setup:</b> {scenario.setup}</p><p className="mt-1 text-[11px] text-amber-200/80">{scenario.expectedObservation}</p><p className="mt-1 text-[11px] text-slate-400">{scenario.conclusion}</p></div>
      <div className="flex flex-wrap items-end gap-2 rounded border border-line bg-[#111820]/70 p-2">
        <NumberSetting label="MemTable entries" value={snapshot.parameters.memtableMaxEntries} min={1} max={64} disabled={disabled} onChange={(value) => update('memtableMaxEntries', value)} />
        <NumberSetting label="Operation count" value={snapshot.parameters.operationCount} min={1} max={200} disabled={disabled} onChange={(value) => update('operationCount', value)} />
        <NumberSetting label="Seed" value={snapshot.parameters.seed} min={0} max={2147483647} disabled={disabled} onChange={(value) => update('seed', value)} />
        <button className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || running} onClick={() => void compare()}>{running ? 'Comparing…' : 'Compare'}</button>
        <button aria-label="Reset tuning parameters" className="canvas-control" disabled={disabled} onClick={() => { setResult(null); setParameters({ memtableMaxEntries: 4, operationCount: 36, seed: 17 }) }}><RotateCcw size={13} /></button>
        <p className="basis-full text-[10px] text-slate-600">SSTable byte/batch limit: unavailable—the engine flushes its whole MemTable. Strategy: fixed full-catalogue compaction.</p>
      </div>
    </div>
    {result && <ComparisonTable result={result} />}
  </section>
}

function NumberSetting({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-slate-500">{label}<input aria-label={label} className="w-20 rounded border border-line bg-[#0b0f14] px-1.5 py-1 font-mono text-xs normal-case text-slate-200 outline-none" disabled={disabled} max={max} min={min} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function ComparisonTable({ result }: { result: ComparisonResult }) {
  const rows: [string, number, number, string][] = [
    ['Completed', result.baseline.metrics.completedOperations, result.candidate.metrics.completedOperations, ''],
    ['Failed', result.baseline.metrics.failedOperations, result.candidate.metrics.failedOperations, ''],
    ['Flushes', result.baseline.metrics.flushes, result.candidate.metrics.flushes, ''],
    ['Compactions', result.baseline.metrics.compactions, result.candidate.metrics.compactions, ''],
    ['Throughput', result.baseline.metrics.throughputOpsPerSecond, result.candidate.metrics.throughputOpsPerSecond, ' ops/s'],
    ['p99 latency', result.baseline.metrics.p99LatencyMs, result.candidate.metrics.p99LatencyMs, ' ms'],
    ['Object ops', result.baseline.metrics.objectOperations, result.candidate.metrics.objectOperations, ''],
    ['Object bytes written', result.baseline.metrics.objectBytesWritten, result.candidate.metrics.objectBytesWritten, ' B'],
    ['Write amplification', result.baseline.metrics.writeAmplification, result.candidate.metrics.writeAmplification, '×'],
  ]
  return <div className="mt-2 overflow-x-auto rounded border border-line bg-[#0b0f14] p-2"><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Comparison · {result.workload} · seed {result.seed} · {result.operationCount} operations</p><table className="w-full min-w-[560px] text-left text-[11px]"><thead className="text-slate-500"><tr><th className="pb-1 font-medium">Metric</th><th className="pb-1 font-medium">Baseline ({result.baseline.parameters.memtableMaxEntries})</th><th className="pb-1 font-medium">Candidate ({result.candidate.parameters.memtableMaxEntries})</th></tr></thead><tbody>{rows.map(([label, baseline, candidate, suffix]) => <tr className="border-t border-line/60" key={label}><td className="py-1 text-slate-400">{label}</td><td className="py-1 font-mono text-slate-300">{format(baseline)}{suffix}</td><td className="py-1 font-mono text-cyan-200">{format(candidate)}{suffix}</td></tr>)}</tbody></table></div>
}

function baselineForScenario(id: string, candidate: SimulationParameters): SimulationParameters {
  const memtableMaxEntries = id === 'small-memtable' || id === 'burst-compaction' ? 8 : id === 'compaction-cost' ? 2 : candidate.memtableMaxEntries
  return { ...candidate, memtableMaxEntries }
}
function format(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(2) }
