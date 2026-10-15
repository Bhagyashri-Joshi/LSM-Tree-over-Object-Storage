import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { SimulationEvent } from '../simulation/SimulationController'

export function EventLog({ events }: { events: SimulationEvent[] }) {
  return <aside className="hidden w-72 shrink-0 border-l border-line bg-[#0e141b] xl:flex xl:flex-col" aria-label="Simulation event log">
    <div className="border-b border-line px-3 py-3"><p className="text-xs font-semibold text-slate-300">Event log</p><p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">Newest first · simulated time</p></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">{events.length === 0 ? <p className="p-2 text-xs leading-5 text-slate-600">Start or step the workload to inspect actual engine and storage events.</p> : events.map((event) => <div className={`mb-1 rounded border p-2 ${event.outcome === 'failure' ? 'border-rose-400/25 bg-rose-400/5' : 'border-line bg-white/[0.015]'}`} key={event.id}>
      <div className="flex items-center justify-between gap-2 text-[10px]"><span className="flex items-center gap-1 text-slate-500">{event.outcome === 'failure' ? <AlertTriangle size={12} className="text-rose-300" /> : <CheckCircle2 size={12} className="text-emerald-300" />} t+{event.timestampMs}ms</span><span className="font-mono text-slate-600">{event.latencyMs}ms</span></div>
      <p className="mt-1 text-xs text-slate-300">{event.detail}</p>
      {event.lifecycleEvents.map((lifecycle, index) => <p className="mt-1 text-[10px] text-cyan-300/80" key={index}>{lifecycle.type === 'flush' ? `Flush → ${lifecycle.table.id}` : `Compaction → ${lifecycle.inputTableCount} table(s)`}</p>)}
    </div>)}</div>
  </aside>
}
