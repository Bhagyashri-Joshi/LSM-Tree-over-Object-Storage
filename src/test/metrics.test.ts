import { describe, expect, it } from 'vitest'
import { displayMetric } from '../lib/metrics'

describe('displayMetric', () => {
  it('uses a deliberate placeholder before the simulator produces a value', () => {
    expect(displayMetric(null, ' ms')).toBe('—')
  })

  it('formats an available metric value', () => {
    expect(displayMetric(42, ' ops/s')).toBe('42 ops/s')
  })
})
