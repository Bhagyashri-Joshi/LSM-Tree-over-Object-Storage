export class SimulationClock {
  private timeMs = 0
  get now(): number { return this.timeMs }
  advance(milliseconds: number): number { this.timeMs += milliseconds; return this.timeMs }
  reset(): void { this.timeMs = 0 }
}
