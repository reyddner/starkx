/**
 * Geometria esquemática da gaiola (DEC-46) — sem cálculo estrutural.
 * Unidades em metros. Barras podem ser exageradas na malha (ver visualBarRadius_m).
 */

export interface RebarCageParams {
  pileDiameter_m: number
  cover_mm: number
  longCount: number
  longDia_mm: number
  transDia_mm: number
  transSpacing_m: number
  cageLength_m: number
  /** Limite de anéis/espirais para performance. */
  maxRings?: number
}

export interface BarXZ {
  x: number
  z: number
}

/** Raio do círculo das longitudinais (centro das barras). */
export function longBarCircleRadius_m(p: RebarCageParams): number {
  const R = Math.max(0.05, p.pileDiameter_m / 2)
  const cover = Math.max(0, p.cover_mm) / 1000
  const longR = Math.max(0.002, p.longDia_mm / 2000)
  const transR = Math.max(0.002, p.transDia_mm / 2000)
  return Math.max(longR * 2, R - cover - 2 * transR - longR)
}

export function longitudinalBarPositions(p: RebarCageParams): BarXZ[] {
  const n = Math.max(0, Math.floor(p.longCount))
  if (n === 0) return []
  const r = longBarCircleRadius_m(p)
  return Array.from({ length: n }, (_, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { x: r * Math.cos(ang), z: r * Math.sin(ang) }
  })
}

/**
 * Cotas Y (negativas, topo em 0) dos estribos/espirais ao longo da gaiola.
 * Primeiro anel logo abaixo do topo; último antes da ponta da gaiola.
 */
export function transverseRingDepths_m(p: RebarCageParams): number[] {
  const L = Math.max(0.05, p.cageLength_m)
  const spacing = Math.max(0.05, p.transSpacing_m)
  const maxRings = p.maxRings ?? 40
  const depths: number[] = []
  // Começa a um espaçamento do topo; sobe até L − margem.
  for (let y = spacing; y < L - spacing * 0.25 && depths.length < maxRings; y += spacing) {
    depths.push(-y)
  }
  if (depths.length === 0) depths.push(-L / 2)
  return depths
}

/** Raio visual mínimo para leitura (não é CAD). */
export function visualBarRadius_m(dia_mm: number, pileDiameter_m: number): number {
  const real = Math.max(0.002, dia_mm / 2000)
  const floor = Math.max(0.006, pileDiameter_m * 0.035)
  return Math.min(Math.max(real * 2.2, floor), pileDiameter_m * 0.08)
}
