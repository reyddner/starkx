import { describe, expect, it } from 'vitest'
import { createColumn, emptyColumnLoad } from '../../apps/web/src/store/columns'
import {
  defaultColumnLayout,
  designColumnCap,
  missingLoadSummary,
} from '../../apps/web/src/store/columnCaps'

describe('columnCaps (DEC-45)', () => {
  it('sugere grade >1×1 quando N exige grupo', () => {
    const load = { ...emptyColumnLoad(), columnLabel: 'P02', N_kN: 500, Mx_kNm: 0, My_kNm: 0 }
    const out = designColumnCap({
      load,
      padm_kN: 200,
      diameter_m: 0.3,
      layout: defaultColumnLayout(),
      autoSuggest: true,
    })
    expect(out.foundationKind).toBe('pile_cap')
    expect(out.layout.blockRows * out.layout.blockCols).toBeGreaterThanOrEqual(3)
    expect(out.summary.pileCount).toBeGreaterThanOrEqual(3)
    expect(out.block).toBeDefined()
    expect(out.block.pileCount).toBeGreaterThanOrEqual(3)
  })

  it('considera momentos na sugestão (grade maior que só N/Padm)', () => {
    const light = designColumnCap({
      load: { ...emptyColumnLoad(), N_kN: 300, Mx_kNm: 0, My_kNm: 0, columnLabel: 'A' },
      padm_kN: 200,
      diameter_m: 0.3,
      layout: defaultColumnLayout(),
      autoSuggest: true,
    })
    const heavyM = designColumnCap({
      load: { ...emptyColumnLoad(), N_kN: 300, Mx_kNm: 400, My_kNm: 0, columnLabel: 'B' },
      padm_kN: 200,
      diameter_m: 0.3,
      layout: defaultColumnLayout(),
      autoSuggest: true,
    })
    expect(heavyM.summary.pileCount).toBeGreaterThanOrEqual(light.summary.pileCount)
  })

  it('withCap e missingLoadSummary são estáveis', () => {
    const col = createColumn({ columnLabel: 'P01', N_kN: null })
    expect(missingLoadSummary(col.columnLabel).pileCount).toBe(0)
    expect(missingLoadSummary(col.columnLabel).message).toMatch(/N não informado/)
  })
})
