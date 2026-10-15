import { X } from 'lucide-react'
import type { SimulationComponent } from '../domain/simulation'
import type { SimulationSnapshot } from '../simulation/SimulationController'

export function ComponentDetailsPanel({ component, snapshot, onClose }: { component: SimulationComponent; snapshot: SimulationSnapshot; onClose: () => void }) {
  const recentEvents = snapshot.events.slice(0, 4)
  return <aside className="absolute right-4 top-4 z-20 max-h-[calc(100%-64px)] w-72 overflow-y-auto rounded-lg border border-line bg-[#111820]/95 p-3 shadow-2xl shadow-black/25" aria-label={`${component.label} details`}>
    <div className="flex items-start justify-between gap-3 border-b border-line pb-2"><div><p className="text-sm font-semibold text-slate-200">{component.label}</p><p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{component.category} · inspection</p></div><button aria-label="Close details" className="canvas-control" onClick={onClose}><X size={13} /></button></div>
    <p className="mt-3 text-xs leading-5 text-slate-400">{component.description}</p>
    <DetailContent componentId={component.id} snapshot={snapshot} />
    <section className="mt-4 border-t border-line pt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recent simulation events</p>{recentEvents.length === 0 ? <p className="mt-2 text-xs text-slate-600">No operations have run.</p> : recentEvents.map((event) => <p className={`mt-2 text-[11px] ${event.outcome === 'failure' ? 'text-rose-300' : 'text-slate-400'}`} key={event.id}>t+{event.timestampMs}ms · {event.detail}</p>)}</section>
  </aside>
}

function DetailContent({ componentId, snapshot }: { componentId: string; snapshot: SimulationSnapshot }) {
  if (componentId === 'client') return <Facts rows={[['Completed', String(snapshot.metrics.completedOperations)], ['Successful', String(snapshot.metrics.successfulOperations)], ['Failed', String(snapshot.metrics.failedOperations)], ['Workload', snapshot.workload]]} />
  if (componentId === 'lsm-engine') return <Facts rows={[['Status', snapshot.status], ['MemTable entries', String(snapshot.inspection.memtableEntries.length)], ['Active SSTables', String(snapshot.inspection.tables.length)], ['Supported', 'PUT · GET · UPDATE · DELETE']]} />
  if (componentId === 'memtable') return <RecordList title="Buffered entries" empty="No buffered entries." records={snapshot.inspection.memtableEntries.map((entry) => `${entry.key} · ${entry.kind === 'delete' ? 'tombstone' : entry.value} · #${entry.sequence}`)} />
  if (componentId === 'wal') return <RecordList title="WAL records" empty="No WAL records." records={snapshot.inspection.walEntries.slice(-8).reverse().map((entry) => `#${entry.sequence} · ${entry.kind.toUpperCase()} ${entry.key}`)} />
  if (componentId === 'sstables') return <RecordList title="Active SSTables" empty="No active SSTables." records={snapshot.inspection.tables.map((table) => `${table.id} · L${table.level} · ${table.entryCount} entries · ${table.sizeBytes} B`)} />
  if (componentId === 'compaction') return <Facts rows={[['Compactions', String(snapshot.metrics.compactions)], ['Flushes', String(snapshot.metrics.flushes)], ['Write amplification', `${snapshot.metrics.writeAmplification.toFixed(2)}×`], ['Supported', 'Automatic full-catalogue merge']]} />
  return <RecordList title="Simulated objects" empty="No SSTable objects." records={snapshot.inspection.objects.map((object) => `${object.key} · ${object.sizeBytes} B`)} />
}

function Facts({ rows }: { rows: [string, string][] }) {
  return <dl className="mt-4 space-y-2">{rows.map(([label, value]) => <div className="flex items-center justify-between gap-3 text-xs" key={label}><dt className="text-slate-500">{label}</dt><dd className="max-w-40 text-right font-mono text-slate-300">{value}</dd></div>)}</dl>
}

function RecordList({ title, empty, records }: { title: string; empty: string; records: string[] }) {
  return <section className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>{records.length === 0 ? <p className="mt-2 text-xs text-slate-600">{empty}</p> : <ul className="mt-2 space-y-1">{records.slice(0, 8).map((record, index) => <li className="rounded border border-line/70 bg-black/10 px-2 py-1.5 font-mono text-[10px] text-slate-400" key={`${record}-${index}`}>{record}</li>)}</ul>}</section>
}
