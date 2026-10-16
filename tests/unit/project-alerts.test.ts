import { describe, expect, it } from 'vitest'
import { analyzeProjectAlerts } from '../../assist-engine/projectAlerts'

describe('analyzeProjectAlerts (DEC-43)', () => {
  it('alerta sondagem vazia', () => {
    const f = analyzeProjectAlerts({
      foundationKind: 'pile',
      layers: [],
      waterLevel_m: null,
      designLoad_kN: null,
      tipDepth_m: 4,
      hasCapacityResult: false,
    })
    expect(f.some((x) => x.id === 'proj.borehole.empty')).toBe(true)
    expect(f.find((x) => x.id === 'proj.borehole.empty')!.message).toMatch(/Como corrigir/)
  })

  it('alerta cota sem camada', () => {
    const f = analyzeProjectAlerts({
      foundationKind: 'pile',
      layers: [{ depth_m: 1, soilTypeId: 12, description: 'Argila' }],
      waterLevel_m: 2,
      designLoad_kN: 100,
      tipDepth_m: 4,
      hasCapacityResult: false,
    })
    expect(f.some((x) => x.id === 'proj.tip.mismatch')).toBe(true)
  })

  it('alerta carga ausente após capacidade', () => {
    const f = analyzeProjectAlerts({
      foundationKind: 'pile',
      layers: [
        { depth_m: 1, soilTypeId: 12, description: 'a' },
        { depth_m: 4, soilTypeId: 7, description: 'b' },
      ],
      waterLevel_m: 1,
      designLoad_kN: null,
      tipDepth_m: 4,
      hasCapacityResult: true,
      columnLabel: 'P3',
    })
    const load = f.find((x) => x.id === 'proj.load.missing')
    expect(load).toBeDefined()
    expect(load!.message).toMatch(/P3/)
  })

  it('não alerta tip.mismatch depois que a capacidade já foi calculada', () => {
    const f = analyzeProjectAlerts({
      foundationKind: 'pile',
      layers: [{ depth_m: 1, soilTypeId: 12, description: 'Argila' }],
      waterLevel_m: 2,
      designLoad_kN: 100,
      tipDepth_m: 4,
      hasCapacityResult: true,
    })
    expect(f.some((x) => x.id === 'proj.tip.mismatch')).toBe(false)
  })
})
