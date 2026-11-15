import { formatCop } from './money'

describe('formatCop', () => {
  it.each([
    [45_990_000, '$459.900'],
    [93_480_000, '$934.800'],
    [300_000, '$3.000'],
    [100, '$1'],
    [0, '$0'],
    [123_456_789_000, '$1.234.567.890'],
  ])('formats %s cents as %s', (cents, expected) => {
    expect(formatCop(cents)).toBe(expected)
  })

  it('never shows decimals, because prices are whole pesos', () => {
    expect(formatCop(45_990_050)).toBe('$459.901')
  })
})
