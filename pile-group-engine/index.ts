/**
 * Distribuição de cargas em grupo retangular (compressão + momentos).
 * Não inventa critérios de atrito negativo / recalque — só estática rígida clássica.
 */

export interface PileGroupInput {
  rows: number
  cols: number
  spacing_m: number
  diameter_m: number
  N_kN: number
  Mx_kNm: number
  My_kNm: number
  singlePadm_kN: number
  efficiency: number | null
  /** Tipo de estaca: espaçamento mínimo 2,5D (pré-moldada/metálica) ou 3D (moldada in loco). */
  pileTypeId?: number | null
  /** Cargas já de cálculo? A verificação geotécnica usa serviço (÷ 1,4). */
  loadIsDesign?: boolean
  /** Bloco para o peso próprio (25 kN/m³): espessura e beiral (m). */
  capThickness_m?: number | null
  capEdge_m?: number | null
}

export interface PileGroupResult {
  nPiles: number
  rows: number
  cols: number
  spacing_m: number
  maxPileLoad_kN: number
  minPileLoad_kN: number
  hasTension: boolean
  efficiency: number | null
  groupPadm_kN: number | null
  ok: boolean
  message: string
  pileLoads_kN: number[]
  minSpacingOk: boolean
  minSpacing_m: number
}

function pileCoordinates(rows: number, cols: number, spacing: number): { x: number; y: number }[] {
  const coords: { x: number; y: number }[] = []
  const x0 = -((cols - 1) * spacing) / 2
  const y0 = -((rows - 1) * spacing) / 2
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      coords.push({ x: x0 + c * spacing, y: y0 + r * spacing })
    }
  }
  return coords
}

/**
 * N_i = N/n ± Mx·y_i/Σy² ± My·x_i/Σx²  (convenção de eixos do bloco).
 */
export function designPileGroup(input: PileGroupInput): PileGroupResult {
  const rows = Math.max(1, Math.floor(input.rows))
  const cols = Math.max(1, Math.floor(input.cols))
  const n = rows * cols
  const spacing = input.spacing_m > 0 ? input.spacing_m : 3 * input.diameter_m
  const k = input.pileTypeId != null && [1, 2, 3, 4].includes(input.pileTypeId) ? 2.5 : 3.0
  const minSpacing_m = k * input.diameter_m
  const minSpacingOk = spacing + 1e-9 >= minSpacing_m

  const coords = pileCoordinates(rows, cols, spacing)
  const sumX2 = coords.reduce((a, p) => a + p.x * p.x, 0)
  const sumY2 = coords.reduce((a, p) => a + p.y * p.y, 0)

  // Cargas de serviço + peso próprio do bloco (bloco rígido).
  const toService = input.loadIsDesign ? 1 / 1.4 : 1
  const t = input.capThickness_m ?? 0
  const e = input.capEdge_m ?? 0
  const capW =
    t > 0
      ? 25 *
        ((cols - 1) * spacing + input.diameter_m + 2 * e) *
        ((rows - 1) * spacing + input.diameter_m + 2 * e) *
        t
      : 0
  const Nserv = input.N_kN * toService + capW
  const pileLoads_kN = coords.map((p) => {
    let Ni = Nserv / n
    if (sumY2 > 1e-12) Ni += (input.Mx_kNm * toService * p.y) / sumY2
    if (sumX2 > 1e-12) Ni += (input.My_kNm * toService * p.x) / sumX2
    return Ni
  })

  const maxPileLoad_kN = Math.max(...pileLoads_kN)
  const minPileLoad_kN = Math.min(...pileLoads_kN)
  const hasTension = minPileLoad_kN < -1e-6
  const eta = input.efficiency
  const groupPadm_kN =
    eta != null && eta > 0 ? n * input.singlePadm_kN * eta : n * input.singlePadm_kN

  const capacityOk = maxPileLoad_kN <= input.singlePadm_kN + 1e-6
  const groupOk = eta == null ? capacityOk : Nserv <= groupPadm_kN + 1e-6

  let ok = capacityOk && minSpacingOk && !hasTension
  if (eta != null) ok = ok && groupOk

  const parts: string[] = []
  if (!minSpacingOk) {
    parts.push(`Espaçamento ${spacing.toFixed(2)} m < mínimo ${k}Ø (${minSpacing_m.toFixed(2)} m).`)
  }
  if (hasTension) {
    parts.push(`Estaca tracionada: Nmín = ${minPileLoad_kN.toFixed(1)} kN — verificar tração.`)
  }
  if (!capacityOk) {
    parts.push(
      `Nmáx ${maxPileLoad_kN.toFixed(1)} kN > Padm individual ${input.singlePadm_kN.toFixed(1)} kN.`,
    )
  }
  if (eta == null) {
    parts.push('η do grupo não informada — capacidade de grupo apenas indicativa (η=1).')
  }
  if (ok) parts.push('Grupo atende verificações de compressão, espaçamento e ausência de tração.')

  return {
    nPiles: n,
    rows,
    cols,
    spacing_m: spacing,
    maxPileLoad_kN,
    minPileLoad_kN,
    hasTension,
    efficiency: eta,
    groupPadm_kN: eta == null ? n * input.singlePadm_kN : groupPadm_kN,
    ok,
    message: parts.join(' '),
    pileLoads_kN,
    minSpacingOk,
    minSpacing_m,
  }
}

/** Sugere menor n (grade) que atende N ≤ n·Padm (sem momentos) — ponto de partida. */
export function suggestMinPileCount(N_kN: number, padm_kN: number, maxN = 16): number {
  if (!(padm_kN > 0) || !(N_kN > 0)) return 1
  for (let n = 1; n <= maxN; n++) {
    if (N_kN <= n * padm_kN) return n
  }
  return maxN
}

export function suggestRectLayout(n: number): { rows: number; cols: number } {
  if (n <= 1) return { rows: 1, cols: 1 }
  if (n === 2) return { rows: 1, cols: 2 }
  if (n === 3) return { rows: 1, cols: 3 }
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { rows, cols }
}

export interface SuggestPileGroupLayoutInput {
  N_kN: number
  Mx_kNm?: number
  My_kNm?: number
  singlePadm_kN: number
  diameter_m: number
  /** Se omitido/≤0, usa 3Ø (como designPileGroup). */
  spacing_m?: number | null
  efficiency?: number | null
  maxN?: number
  pileTypeId?: number | null
  loadIsDesign?: boolean
  capThickness_m?: number | null
  capEdge_m?: number | null
}

/**
 * Menor grade retangular que atende estática rígida (Nmáx ≤ Padm, sem tração, s ≥ 2,5Ø)
 * e, se η informada, N ≤ n·Padm·η. Considera Mx/My — não é só N/Padm.
 */
export function suggestPileGroupLayout(input: SuggestPileGroupLayoutInput): {
  rows: number
  cols: number
  nPiles: number
  trial: PileGroupResult
} {
  const maxN = input.maxN ?? 16
  const Mx = input.Mx_kNm ?? 0
  const My = input.My_kNm ?? 0
  const spacing =
    input.spacing_m != null && input.spacing_m > 0
      ? input.spacing_m
      : 3 * input.diameter_m

  let last: PileGroupResult | null = null
  const seen = new Set<string>()
  for (let n = 1; n <= maxN; n++) {
    const { rows, cols } = suggestRectLayout(n)
    const key = `${rows}x${cols}`
    if (seen.has(key)) continue
    seen.add(key)
    if (rows * cols > maxN) continue
    const trial = designPileGroup({
      rows,
      cols,
      spacing_m: spacing,
      diameter_m: input.diameter_m,
      N_kN: input.N_kN,
      Mx_kNm: Mx,
      My_kNm: My,
      singlePadm_kN: input.singlePadm_kN,
      efficiency: input.efficiency ?? null,
      pileTypeId: input.pileTypeId,
      loadIsDesign: input.loadIsDesign,
      capThickness_m: input.capThickness_m,
      capEdge_m: input.capEdge_m,
    })
    last = trial
    if (trial.ok) {
      return { rows, cols, nPiles: trial.nPiles, trial }
    }
  }
  const fallbackN = Math.min(maxN, last?.nPiles ?? maxN)
  const layout = suggestRectLayout(fallbackN)
  const trial =
    last ??
    designPileGroup({
      rows: layout.rows,
      cols: layout.cols,
      spacing_m: spacing,
      diameter_m: input.diameter_m,
      N_kN: input.N_kN,
      Mx_kNm: Mx,
      My_kNm: My,
      singlePadm_kN: input.singlePadm_kN,
      efficiency: input.efficiency ?? null,
      pileTypeId: input.pileTypeId,
      loadIsDesign: input.loadIsDesign,
      capThickness_m: input.capThickness_m,
      capEdge_m: input.capEdge_m,
    })
  return { rows: trial.rows, cols: trial.cols, nPiles: trial.nPiles, trial }
}
