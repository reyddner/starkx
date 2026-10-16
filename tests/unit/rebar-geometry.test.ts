import { describe, expect, it } from 'vitest'
import {
  longBarCircleRadius_m,
  longitudinalBarPositions,
  transverseRingDepths_m,
  visualBarRadius_m,
} from '../../apps/web/src/viz3d/rebarGeometry'

describe('rebarGeometry (DEC-46)', () => {
  const base = {
    pileDiameter_m: 0.3,
    cover_mm: 30,
    longCount: 6,
    longDia_mm: 12.5,
    transDia_mm: 6.3,
    transSpacing_m: 0.2,
    cageLength_m: 4,
  }

  it('posiciona longitudinais em círculo interno ao cobrimento', () => {
    const r = longBarCircleRadius_m(base)
    expect(r).toBeLessThan(0.15)
    expect(r).toBeGreaterThan(0.05)
    const bars = longitudinalBarPositions(base)
    expect(bars).toHaveLength(6)
    for (const b of bars) {
      expect(Math.hypot(b.x, b.z)).toBeCloseTo(r, 6)
    }
  })

  it('gera anéis espaçados sem estourar maxRings', () => {
    const ys = transverseRingDepths_m({ ...base, maxRings: 5 })
    expect(ys.length).toBeLessThanOrEqual(5)
    expect(ys.every((y) => y < 0)).toBe(true)
  })

  it('raio visual é maior que o real para leitura', () => {
    const real = 12.5 / 2000
    const vis = visualBarRadius_m(12.5, 0.3)
    expect(vis).toBeGreaterThan(real)
  })
})
