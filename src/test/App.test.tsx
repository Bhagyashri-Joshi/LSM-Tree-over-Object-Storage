import { render, screen } from '@testing-library/react'
import { App } from '../app/App'

describe('App', () => {
  it('renders the simulator shell', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'LSM Lab' })).toBeInTheDocument()
    expect(screen.getByLabelText('LSM architecture canvas')).toBeInTheDocument()
  })
})
