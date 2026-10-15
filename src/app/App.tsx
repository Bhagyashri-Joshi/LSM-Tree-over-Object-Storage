import { ArchitectureCanvas } from '../canvas/ArchitectureCanvas'
import { AppErrorBoundary } from './AppErrorBoundary'
import { useSimulation } from '../state/useSimulation'
import { ComponentPalette } from '../ui/ComponentPalette'
import { EventLog } from '../ui/EventLog'
import { ExperimentPanel } from '../ui/ExperimentPanel'
import { TopToolbar } from '../ui/TopToolbar'

export function App() {
  const simulation = useSimulation()
  return (
    <AppErrorBoundary><main className="min-h-screen bg-ink text-slate-100">
      <TopToolbar {...simulation} />
      <section className="flex h-[calc(100vh-72px)] min-h-[560px] overflow-hidden">
        <ComponentPalette />
        <div className="flex min-w-0 flex-1 flex-col"><ExperimentPanel setParameters={simulation.setParameters} snapshot={simulation.snapshot} /><ArchitectureCanvas snapshot={simulation.snapshot} /></div>
        <EventLog events={simulation.snapshot.events} />
      </section>
    </main></AppErrorBoundary>
  )
}
