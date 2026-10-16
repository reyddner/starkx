import { describe, expect, it } from 'vitest'
import { calculate } from '@engine/index'
import { refInput, refExpected } from '../fixtures/reference'
import { analyzeProjectAlerts } from '../../assist-engine/projectAlerts'

describe('excludeFromShaftFriction (DEC-47)', () => {
  const base = refInput as Parameters<typeof calculate>[0]

  it('zerar Rl em um metro reduz Padm sem alterar Rp na ponta', () => {
    const ref = calculate(base)
    const excluded = calculate({
      ...base,
      layers: base.layers.map((l) =>
        l.depth_m === 2 ? { ...l, excludeFromShaftFriction: true } : l,
      ),
    })

    const refAoki = ref.atTip.methods.find((m) => m.methodId === 'aoki_velloso')!
    const exAoki = excluded.atTip.methods.find((m) => m.methodId === 'aoki_velloso')!
    expect(exAoki.Rp_kN).toBeCloseTo(refAoki.Rp_kN, 9)
    expect(exAoki.Rl_acum_kN).toBeLessThan(refAoki.Rl_acum_kN - 1e-6)
    expect(exAoki.Padm_kN).toBeLessThan(refAoki.Padm_kN - 1e-6)

    const row2 = excluded.profile.find((p) => p.depth_m === 2)!
    expect(row2.aoki!.Rl_m_kN).toBe(0)
    expect(excluded.warnings.some((w) => /exclusão de atrito lateral/i.test(w))).toBe(true)
  })

  it('alerta tip quando há camadas excluídas', () => {
    const f = analyzeProjectAlerts({
      foundationKind: 'pile',
      layers: [
        { depth_m: 1, soilTypeId: 12, excludeFromShaftFriction: true },
        { depth_m: 4, soilTypeId: 7 },
      ],
      waterLevel_m: null,
      designLoad_kN: 100,
      tipDepth_m: 4,
      hasCapacityResult: true,
    })
    expect(f.some((x) => x.id === 'proj.nsf.shaft-excluded')).toBe(true)
    expect(f.every((x) => x.id !== 'proj.nsf.ui-only')).toBe(true)
  })
})
