import { useEffect, useRef, useState } from 'react'
import { SimulationController, type SimulationSnapshot } from '../simulation/SimulationController'
import type { SimulationParameters } from '../simulation/SimulationController'
import type { WorkloadKind } from '../simulation/workloads'

export function useSimulation() {
  const controllerRef = useRef<SimulationController>()
  if (!controllerRef.current) controllerRef.current = new SimulationController()
  const controller = controllerRef.current
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => controller.snapshot())
  const refresh = () => setSnapshot(controller.snapshot())

  useEffect(() => {
    if (snapshot.status !== 'running') return undefined
    let cancelled = false
    let tickInProgress = false
    const tick = async () => {
      if (tickInProgress) return
      tickInProgress = true
      try { await controller.step() } finally {
        tickInProgress = false
        if (!cancelled) refresh()
      }
    }
    const interval = window.setInterval(() => { void tick() }, Math.max(50, Math.round(1000 / snapshot.offeredLoadOpsPerSecond)))
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [controller, snapshot.status, snapshot.offeredLoadOpsPerSecond])

  return {
    snapshot,
    start: () => { controller.start(); refresh() },
    pause: () => { controller.pause(); refresh() },
    step: async () => { await controller.step(); refresh() },
    reset: () => { controller.reset(); refresh() },
    setOfferedLoad: (value: number) => { controller.setOfferedLoad(value); refresh() },
    setWorkload: (workload: WorkloadKind) => { controller.setWorkload(workload); refresh() },
    setParameters: (parameters: Partial<SimulationParameters>) => { controller.setParameters(parameters); refresh() },
  }
}
