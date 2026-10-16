import { describe, expect, it } from 'vitest'
import { suggestSoilFromDescription } from '../../assist-engine/soilSuggest'

describe('suggestSoilFromDescription (DEC-40)', () => {
  it('sugere argila arenosa pela descrição', () => {
    const s = suggestSoilFromDescription('Argila arenosa medianamente compacta')
    expect(s?.soilTypeId).toBe(12)
    expect(s?.soilName).toMatch(/Argila arenosa/i)
  })

  it('prefere silte arenoso a silte genérico', () => {
    const s = suggestSoilFromDescription('Silte arenoso com mica')
    expect(s?.soilTypeId).toBe(7)
  })

  it('não inventa sem descrição útil', () => {
    expect(suggestSoilFromDescription('')).toBeNull()
    expect(suggestSoilFromDescription('ab')).toBeNull()
  })

  it('não usa NSPT — função só recebe texto', () => {
    // Garantia de API: ausência de parâmetro N implica não classificar por golpe.
    const s = suggestSoilFromDescription('Areia fina')
    expect(s?.soilTypeId).toBe(1)
    expect(s?.disclaimer).toMatch(/NSPT não define/i)
  })
})
