import { describe, expect, it } from 'vitest'
import {
  classifyPatchKeys,
  patchTouchesBlockLayout,
  patchTouchesLoads,
} from '../../apps/web/src/store/patchPolicy'

describe('patchPolicy (Fase B / C1)', () => {
  it('metadados de obra são safe', () => {
    expect(classifyPatchKeys(['projectName', 'client', 'responsibleEngineer'])).toBe('safe')
  })

  it('cargas e arranjo preservam Padm', () => {
    expect(classifyPatchKeys(['columnLoad', 'designLoad_kN'])).toBe('keep_padm')
    expect(classifyPatchKeys(['blockRows', 'blockCols', 'blockEfficiency'])).toBe('keep_padm')
    expect(classifyPatchKeys(['waterLevel_m', 'fck_MPa'])).toBe('keep_padm')
  })

  it('insumos geotécnicos invalidam tudo', () => {
    expect(classifyPatchKeys(['layers'])).toBe('invalidate_all')
    expect(classifyPatchKeys(['diameterCm', 'tipDepth_m'])).toBe('invalidate_all')
    expect(classifyPatchKeys(['mode', 'aokiFs'])).toBe('invalidate_all')
    expect(classifyPatchKeys(['columnLoad', 'layers'])).toBe('invalidate_all')
    expect(classifyPatchKeys(['blockThickness_m', 'blockEmbedment_m'])).toBe('invalidate_all')
    expect(classifyPatchKeys(['pileTopElevation_m'])).toBe('invalidate_all')
  })

  it('detecta toques de carga e bloco', () => {
    expect(patchTouchesLoads(['columnLoad'])).toBe(true)
    expect(patchTouchesLoads(['blockRows'])).toBe(false)
    expect(patchTouchesBlockLayout(['blockSpacing_m'])).toBe(true)
    expect(patchTouchesBlockLayout(['designLoad_kN'])).toBe(false)
  })
})
