import { Minus, MousePointer2, Plus, RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { initialTopology } from '../domain/initialTopology'
import type { ComponentCategory, SimulationComponent } from '../domain/simulation'
import type { SimulationSnapshot } from '../simulation/SimulationController'
import { ComponentDetailsPanel } from '../ui/ComponentDetailsPanel'

const NODE_WIDTH = 158
const NODE_HEIGHT = 74

export function ArchitectureCanvas({ snapshot }: { snapshot: SimulationSnapshot }) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragOrigin = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const components = initialTopology.components
  const nodeById = useMemo(() => new Map(components.map((component) => [component.id, component])), [components])
  const selected = selectedId ? nodeById.get(selectedId) : undefined

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest('[data-node]')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOrigin.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }
  }
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragOrigin.current) return
    setOffset({ x: dragOrigin.current.offsetX + event.clientX - dragOrigin.current.x, y: dragOrigin.current.offsetY + event.clientY - dragOrigin.current.y })
  }
  function onPointerUp() { dragOrigin.current = null }
  function setSafeZoom(next: number) { setZoom(Math.min(1.5, Math.max(0.6, Number(next.toFixed(2))))) }

  return <section className="relative min-w-0 flex-1 overflow-hidden bg-[#0b0f14]" aria-label="LSM architecture canvas">
    <div className="absolute left-4 top-4 z-10 rounded border border-line bg-[#111820]/95 px-3 py-2 shadow-xl shadow-black/10"><p className="text-xs font-medium text-slate-300">Storage lifecycle</p><p className="mt-0.5 text-[11px] text-slate-500">{snapshot.status} · {snapshot.operationIndex}/{snapshot.operationCount} operations · t+{snapshot.clockMs}ms</p></div>
    <FlowLegend />
    {selected && <ComponentDetailsPanel component={selected} snapshot={snapshot} onClose={() => setSelectedId(null)} />}
    <svg className="h-full w-full touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} role="img" aria-label="Initial LSM storage architecture">
      <defs>
        <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M 26 0 L 0 0 0 26" fill="none" stroke="#25303d" strokeOpacity=".45" strokeWidth="1" /></pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#536171" /></marker>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
        {initialTopology.connections.map((connection) => {
          const from = nodeById.get(connection.sourceId)!
          const to = nodeById.get(connection.targetId)!
          const sx = from.position.x + NODE_WIDTH
          const sy = from.position.y + NODE_HEIGHT / 2
          const tx = to.position.x
          const ty = to.position.y + NODE_HEIGHT / 2
          const mid = sx + (tx - sx) / 2
          const active = snapshot.activeConnectionIds.includes(connection.id)
          const flowColor = colorForFlow(snapshot.flowState)
          return <g key={connection.id}><path aria-label={`${connection.label} path ${active ? snapshot.flowState : 'idle'}`} className={active ? `flow-path flow-${snapshot.flowState}` : undefined} d={`M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx - 8} ${ty}`} fill="none" markerEnd="url(#arrow)" stroke={active ? flowColor : '#536171'} strokeWidth={active ? '2.5' : '1.5'} /><text x={mid} y={(sy + ty) / 2 - 9} fill={active ? flowColor : '#718096'} fontSize="11" textAnchor="middle">{connection.label}</text></g>
        })}
        {components.map((component) => <TopologyNode active={isActiveComponent(component.id, snapshot.activeConnectionIds)} component={component} key={component.id} onSelect={setSelectedId} selected={selectedId === component.id} />)}
      </g>
    </svg>
    <div className="absolute bottom-0 left-0 right-0 flex h-10 items-center justify-between border-t border-line bg-[#0e141b]/95 px-3 text-[11px] text-slate-500">
      <span className="hidden items-center gap-1.5 sm:flex"><MousePointer2 size={13} /> Drag empty space to pan</span>
      <span className="sm:hidden">Topology view</span>
      <div className="flex items-center gap-1"><button aria-label="Zoom out" className="canvas-control" onClick={() => setSafeZoom(zoom - 0.1)}><Minus size={14} /></button><span className="w-10 text-center font-mono text-slate-400">{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" className="canvas-control" onClick={() => setSafeZoom(zoom + 0.1)}><Plus size={14} /></button><button aria-label="Reset view" className="canvas-control ml-1" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }}><RotateCcw size={13} /></button></div>
    </div>
  </section>
}

function FlowLegend() {
  const items: [string, string][] = [['write', '#55d6ed'], ['read', '#b5a6ff'], ['flush', '#74d6ad'], ['compaction', '#f4b86a'], ['failed', '#fb7185']]
  return <div className="absolute bottom-12 left-4 z-10 hidden rounded border border-line bg-[#111820]/95 p-2 lg:block" aria-label="Flow legend"><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Flow legend</p><div className="flex gap-2">{items.map(([label, color]) => <span className="flex items-center gap-1 text-[10px] text-slate-400" key={label}><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div></div>
}

function isActiveComponent(componentId: string, connections: string[]): boolean {
  const token = componentId === 'lsm-engine' ? 'engine' : componentId === 'object-storage' ? 'storage' : componentId
  return connections.some((connection) => connection.includes(token))
}

function TopologyNode({ component, active, selected, onSelect }: { component: SimulationComponent; active: boolean; selected: boolean; onSelect: (id: string) => void }) {
  const colors: Record<ComponentCategory, { border: string; fill: string; accent: string }> = {
    traffic: { border: '#7359d7', fill: '#181427', accent: '#b5a6ff' },
    compute: { border: '#177c99', fill: '#0e2028', accent: '#66d9f5' },
    data: { border: '#26765d', fill: '#11231e', accent: '#74d6ad' },
  }
  const color = colors[component.category]
  const select = () => onSelect(component.id)
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select() } }
  return <g aria-label={`Inspect ${component.label}`} aria-pressed={selected} data-node="true" onClick={select} onKeyDown={onKeyDown} role="button" tabIndex={0} transform={`translate(${component.position.x} ${component.position.y})`}>
    <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" fill={color.fill} stroke={selected ? '#f8fafc' : active ? color.accent : color.border} strokeWidth={selected || active ? '2' : '1.25'} />
    <circle cx="17" cy="19" r="4" fill={color.accent} /><text x="29" y="23" fill="#e2e8f0" fontSize="13" fontWeight="600">{component.label}</text>
    <text x="16" y="51" fill="#8291a3" fontSize="10">{component.description}</text>
    <text x="16" y="64" fill={color.accent} fillOpacity=".75" fontSize="9" letterSpacing="1">{component.category.toUpperCase()}</text>
  </g>
}

function colorForFlow(state: SimulationSnapshot['flowState']): string {
  return { idle: '#536171', write: '#55d6ed', read: '#b5a6ff', flush: '#74d6ad', compaction: '#f4b86a', failed: '#fb7185' }[state]
}
