import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArchitectureCanvas } from '../canvas/ArchitectureCanvas'
import { SimulationController } from '../simulation/SimulationController'

describe('ArchitectureCanvas inspection', () => {
  it('selects a node with keyboard navigation and shows actual MemTable data', async () => {
    const simulation = new SimulationController({ workload: 'compaction-pressure', operationCount: 1 })
    await simulation.step()
    render(<ArchitectureCanvas snapshot={simulation.snapshot()} />)

    const memtable = screen.getByRole('button', { name: 'Inspect MemTable' })
    fireEvent.keyDown(memtable, { key: 'Enter' })
    const panel = screen.getByLabelText('MemTable details')
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByText('Buffered entries')).toBeInTheDocument()
    expect(within(panel).getByText(/^key-0/)).toBeInTheDocument()
  })

  it('marks the request path as failed after a storage failure', async () => {
    const simulation = new SimulationController({ workload: 'compaction-pressure', operationCount: 4, failureRules: [{ operation: 'put' }] })
    for (let index = 0; index < 4; index += 1) await simulation.step()
    render(<ArchitectureCanvas snapshot={simulation.snapshot()} />)

    expect(screen.getByLabelText('requests path failed')).toHaveClass('flow-failed')
  })
})
