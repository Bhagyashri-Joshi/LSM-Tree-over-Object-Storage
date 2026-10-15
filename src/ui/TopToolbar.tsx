import { Gauge, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SimulationSnapshot } from '../simulation/SimulationController'
import { workloads, type WorkloadKind } from '../simulation/workloads'
import { displayMetric } from '../lib/metrics'

interface TopToolbarProps {
  snapshot: SimulationSnapshot
  start: () => void
  pause: () => void
  step: () => Promise<void>
  reset: () => void
  setOfferedLoad: (value: number) => void
  setWorkload: (workload: WorkloadKind) => void
}

export function TopToolbar({ snapshot, start, pause, step, reset, setOfferedLoad, setWorkload }: TopToolbarProps) {
  const metrics = [
    ['Throughput', displayMetric(Number(snapshot.metrics.throughputOpsPerSecond.toFixed(1)), ' ops/s')],
    ['p99 latency', displayMetric(snapshot.metrics.p99LatencyMs, ' ms')],
    ['Write amp.', displayMetric(Number(snapshot.metrics.writeAmplification.toFixed(2)), '×')],
    ['Ops', `${snapshot.metrics.successfulOperations}/${snapshot.metrics.completedOperations}`],
  ]
  return (
    <header className="flex min-h-[72px] flex-wrap items-center gap-3 border-b border-line bg-[#0e141b] px-4 py-3 lg:flex-nowrap">
      <div className="mr-2 flex min-w-fit items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"><Gauge size={17} /></div>
        <div><h1 className="text-sm font-semibold tracking-wide">LSM Lab</h1><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Storage architecture simulator</p></div>
      </div>
      <label className="flex items-center gap-2 rounded-md border border-line bg-[#111820] px-2.5 py-1.5 text-xs text-slate-400">
        Offered load
        <input aria-label="Offered load" className="w-14 bg-transparent text-right text-sm text-slate-100 outline-none" min="1" max="100000" step="1" type="number" value={snapshot.offeredLoadOpsPerSecond} onChange={(event) => setOfferedLoad(Number(event.target.value))} />
        <span className="text-slate-500">ops/s</span>
      </label>
      <div className="hidden h-7 w-px bg-line md:block" />
      <label className="hidden items-center gap-2 rounded-md border border-line bg-[#111820] px-2.5 py-1.5 text-xs text-slate-400 lg:flex">Workload
        <select aria-label="Workload" className="max-w-36 bg-transparent text-xs text-slate-200 outline-none" disabled={snapshot.status === 'running'} value={snapshot.workload} onChange={(event) => setWorkload(event.target.value as WorkloadKind)}>{workloads.map((workload) => <option className="bg-[#111820]" key={workload.id} value={workload.id}>{workload.label}</option>)}</select>
      </label>
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {metrics.map(([label, value]) => <div className="min-w-[92px]" key={label}><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="font-mono text-sm text-slate-300">{value}</p></div>)}
      </div>
      <div className="ml-auto flex items-center gap-1" aria-label="Simulation controls">
        <Control label="Start workload" disabled={snapshot.status === 'running' || snapshot.status === 'complete'} icon={<Play size={15} />} onClick={start} />
        <Control label="Pause workload" disabled={snapshot.status !== 'running'} icon={<Pause size={15} />} onClick={pause} />
        <Control label="Step one operation" disabled={snapshot.status === 'running' || snapshot.status === 'complete'} icon={<SkipForward size={15} />} onClick={() => void step()} />
        <Control label="Reset workload" icon={<RotateCcw size={15} />} onClick={reset} />
      </div>
    </header>
  )
}

function Control({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return <button aria-label={label} className="grid h-8 w-8 place-items-center rounded border border-line text-slate-400 hover:border-slate-600 hover:text-slate-100 disabled:cursor-not-allowed disabled:text-slate-600" disabled={disabled} onClick={onClick} title={label}>{icon}</button>
}
