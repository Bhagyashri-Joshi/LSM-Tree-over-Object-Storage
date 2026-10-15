import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { error: Error | null }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(_error: Error, _info: ErrorInfo): void { /* keep the educational simulator usable without external reporting */ }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="grid min-h-screen place-items-center bg-ink p-6 text-slate-100"><section className="max-w-md rounded-lg border border-rose-400/30 bg-[#111820] p-5"><h1 className="text-lg font-semibold">LSM Lab could not render</h1><p className="mt-2 text-sm leading-6 text-slate-400">The simulator encountered an unexpected interface error. Your simulation data is in memory and can be safely restarted.</p><button className="mt-4 rounded border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200" onClick={() => window.location.reload()}>Reload LSM Lab</button></section></main>
  }
}
