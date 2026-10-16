import { SOIL_TYPES } from '../calculation-engine/catalogs'

export interface SoilSuggestion {
  soilTypeId: number
  soilName: string
  /** 0–1: força do match textual (nunca “certeza geotécnica”). */
  confidence: number
  matchedTerms: string[]
  disclaimer: string
}

const DISCLAIMER =
  'Sugestão a partir da descrição do boletim. NSPT não define granulometria — confirme ou altere o tipo para métodos.'

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

function normalize(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tokens auxiliares comuns em boletins BR. */
const ALIASES: { terms: string[]; soilTypeId: number }[] = [
  { terms: ['argila arenosa', 'argilo arenosa', 'solo argiloarenoso'], soilTypeId: 12 },
  { terms: ['argila arenossiltosa', 'argila areno siltosa'], soilTypeId: 13 },
  { terms: ['argila siltoarenosa', 'argila silte arenosa'], soilTypeId: 15 },
  { terms: ['argila siltosa', 'argilo siltosa'], soilTypeId: 14 },
  { terms: ['silte arenoargiloso', 'silte areno argiloso'], soilTypeId: 8 },
  { terms: ['silte argiloarenoso', 'silte argilo arenoso'], soilTypeId: 10 },
  { terms: ['silte arenoso'], soilTypeId: 7 },
  { terms: ['silte argiloso'], soilTypeId: 9 },
  { terms: ['areia siltoargilosa', 'areia silto argilosa'], soilTypeId: 3 },
  { terms: ['areia argilossiltosa', 'areia argilo siltosa'], soilTypeId: 5 },
  { terms: ['areia siltosa'], soilTypeId: 2 },
  { terms: ['areia argilosa'], soilTypeId: 4 },
  { terms: ['argila'], soilTypeId: 11 },
  { terms: ['silte'], soilTypeId: 6 },
  { terms: ['areia'], soilTypeId: 1 },
]

/**
 * Infere possível `soilTypeId` a partir da descrição da camada.
 * Não usa NSPT (evitar falsa certeza granulométrica).
 */
export function suggestSoilFromDescription(description: string | null | undefined): SoilSuggestion | null {
  const raw = (description ?? '').trim()
  if (raw.length < 3) return null
  const text = normalize(raw)
  if (!text) return null

  // Preferir aliases mais longos primeiro (já ordenados por especificidade).
  for (const alias of ALIASES) {
    for (const term of alias.terms) {
      const nTerm = normalize(term)
      if (nTerm.length >= 3 && text.includes(nTerm)) {
        const soil = SOIL_TYPES.find((s) => s.id === alias.soilTypeId)
        if (!soil) continue
        const specificity = Math.min(1, nTerm.length / 18)
        return {
          soilTypeId: soil.id,
          soilName: soil.name,
          confidence: 0.55 + 0.4 * specificity,
          matchedTerms: [term],
          disclaimer: DISCLAIMER,
        }
      }
    }
  }

  // Fallback: nome do catálogo contido na descrição (mais específico primeiro).
  const byNameLen = [...SOIL_TYPES].sort((a, b) => b.name.length - a.name.length)
  for (const soil of byNameLen) {
    const nName = normalize(soil.name)
    if (nName.length >= 4 && text.includes(nName)) {
      return {
        soilTypeId: soil.id,
        soilName: soil.name,
        confidence: 0.7,
        matchedTerms: [soil.name],
        disclaimer: DISCLAIMER,
      }
    }
  }

  return null
}
