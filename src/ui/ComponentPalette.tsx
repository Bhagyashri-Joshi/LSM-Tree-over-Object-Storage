import { Box, Database, HardDrive, Network, Server, Users } from 'lucide-react'
import type { ComponentCategory } from '../domain/simulation'

const groups: { category: ComponentCategory; title: string; items: { label: string; icon: typeof Users }[] }[] = [
  { category: 'traffic', title: 'Traffic', items: [{ label: 'Client', icon: Users }, { label: 'Load balancer', icon: Network }] },
  { category: 'compute', title: 'Compute', items: [{ label: 'LSM engine', icon: Server }] },
  { category: 'data', title: 'Data', items: [{ label: 'MemTable', icon: Database }, { label: 'Object storage', icon: HardDrive }, { label: 'SSTable', icon: Box }] },
]

export function ComponentPalette() {
  return <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-line bg-[#0e141b] p-3 md:block">
    <p className="mb-4 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Components</p>
    <div className="space-y-5">{groups.map((group) => <section key={group.category}><h2 className="mb-2 px-1 text-[11px] font-medium text-slate-400">{group.title}</h2><div className="space-y-1">{group.items.map((item) => { const Icon = item.icon; return <div className="flex cursor-default items-center gap-2 rounded-md border border-transparent px-2 py-2 text-xs text-slate-400 hover:border-line hover:bg-white/[0.025]" key={item.label}><span className={`rounded p-1 ${categoryColor(group.category)}`}><Icon size={14} /></span>{item.label}</div> })}</div></section>)}</div>
    <p className="mt-8 px-1 text-[11px] leading-5 text-slate-600">Component placement is introduced with the interactive topology editor.</p>
  </aside>
}

function categoryColor(category: ComponentCategory) {
  return { traffic: 'bg-violet-400/10 text-violet-300', compute: 'bg-cyan-400/10 text-cyan-300', data: 'bg-emerald-400/10 text-emerald-300' }[category]
}
