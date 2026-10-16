/**
 * Dimensionamento de bloco/grupo por pilar (DEC-45) — orquestra engines existentes.
 * Não recalcula Padm; só usa Padm informado.
 */
import { designPileCap, defaultSpacing_m, minSpacingFactorForPileType } from '@block/index'
import type { BlockDesignResult } from '@block/index'
import { designPileGroup, suggestPileGroupLayout } from '@group/index'
import type { PileGroupResult } from '@group/index'
import type {
  ColumnCapLayout,
  ColumnCapSummary,
  ColumnLoadInput,
  ColumnRecord,
} from './columns'

export type { ColumnCapLayout, ColumnCapSummary }

export function defaultColumnLayout(
  partial?: Partial<ColumnCapLayout>,
): ColumnCapLayout {
  return {
    blockRows: 1,
    blockCols: 1,
    blockSpacing_m: null,
    blockEdge_m: 0.25,
    blockThickness_m: 0.5,
    blockEfficiency: null,
    ...partial,
  }
}

export function summarizeCap(
  group: {
    rows: number
    cols: number
    nPiles: number
    groupPadm_kN: number | null
    ok: boolean
    maxPileLoad_kN: number
    efficiency: number | null
    message: string
  } | null,
  block: BlockDesignResult | null,
): ColumnCapSummary {
  const rows = group?.rows ?? 0
  const cols = group?.cols ?? 0
  return {
    pileCount: block?.pileCount ?? group?.nPiles ?? 0,
    rows,
    cols,
    groupPadm_kN: block?.groupPadm_kN ?? group?.groupPadm_kN ?? null,
    capacityOk: block?.capacityOk ?? null,
    groupOk: group?.ok ?? null,
    maxPileLoad_kN: group?.maxPileLoad_kN ?? null,
    width_m: block?.cap.width_m ?? null,
    length_m: block?.cap.length_m ?? null,
    thickness_m: block?.cap.thickness_m ?? null,
    efficiency: block?.efficiencyUserProvided
      ? block.efficiency
      : (group?.efficiency ?? null),
    indicative: block?.groupCapacityIndicative ?? group?.efficiency == null,
    message: [group?.message, ...(block?.warnings ?? [])].filter(Boolean).join(' '),
  }
}

export interface DesignColumnCapInput {
  load: ColumnLoadInput
  padm_kN: number
  diameter_m: number
  layout: ColumnCapLayout
  autoSuggest: boolean
  fck_MPa?: number | null
  fyk_MPa?: number | null
  pileTypeId?: number | null
  loadIsDesign?: boolean
}

export interface DesignColumnCapOutput {
  layout: ColumnCapLayout
  summary: ColumnCapSummary
  group: PileGroupResult
  /** Sempre presente: pilar nunca apoia direto no fuste (bloco 1E+). */
  block: BlockDesignResult
  foundationKind: 'pile' | 'pile_cap'
}

/** Dimensiona um pilar com Padm já conhecido (sem segundo motor geotécnico). */
export function designColumnCap(input: DesignColumnCapInput): DesignColumnCapOutput {
  const N = input.load.N_kN
  if (N == null || !(N > 0)) {
    throw new Error(`Pilar ${input.load.columnLabel || '?'}: informe N (kN).`)
  }
  if (!(input.padm_kN > 0)) {
    throw new Error('Padm inválido — calcule a capacidade da estaca antes.')
  }

  let rows = Math.max(1, Math.floor(input.layout.blockRows))
  let cols = Math.max(1, Math.floor(input.layout.blockCols))
  const spacing = input.layout.blockSpacing_m
  const eta = input.layout.blockEfficiency

  if (input.autoSuggest) {
    const suggested = suggestPileGroupLayout({
      N_kN: N,
      Mx_kNm: input.load.Mx_kNm ?? 0,
      My_kNm: input.load.My_kNm ?? 0,
      singlePadm_kN: input.padm_kN,
      diameter_m: input.diameter_m,
      spacing_m: spacing,
      efficiency: eta,
      pileTypeId: input.pileTypeId,
      loadIsDesign: input.loadIsDesign,
      capThickness_m: input.layout.blockThickness_m,
      capEdge_m: input.layout.blockEdge_m,
    })
    rows = suggested.rows
    cols = suggested.cols
  }

  const spacingUsed =
    spacing != null && spacing > 0
      ? spacing
      : defaultSpacing_m(input.diameter_m, minSpacingFactorForPileType(input.pileTypeId ?? null))
  // Pilar → sempre bloco de coroamento (mesmo 1×1). Estaca “isolada” no sentido
  // geotécnico (n=1) ainda exige bloco; apoiar o pilar direto no fuste é incorreto.
  const foundationKind: 'pile' | 'pile_cap' = 'pile_cap'

  const group = designPileGroup({
    rows,
    cols,
    spacing_m: spacingUsed,
    diameter_m: input.diameter_m,
    N_kN: N,
    Mx_kNm: input.load.Mx_kNm ?? 0,
    My_kNm: input.load.My_kNm ?? 0,
    singlePadm_kN: input.padm_kN,
    efficiency: eta,
    pileTypeId: input.pileTypeId,
    loadIsDesign: input.loadIsDesign,
    capThickness_m: input.layout.blockThickness_m,
    capEdge_m: input.layout.blockEdge_m,
  })

  const block: BlockDesignResult = designPileCap({
    rows,
    cols,
    spacing_m: spacing,
    diameter_m: input.diameter_m,
    edge_m: input.layout.blockEdge_m,
    thickness_m: input.layout.blockThickness_m,
    singlePadm_kN: input.padm_kN,
    groupLoad_kN: N,
    Mx_kNm: input.load.Mx_kNm ?? 0,
    My_kNm: input.load.My_kNm ?? 0,
    loadIsDesign: input.loadIsDesign,
    columnWidth_m: input.load.columnWidth_m,
    columnDepth_m: input.load.columnDepth_m,
    pileTypeId: input.pileTypeId,
    efficiency: eta,
    fck_MPa: input.fck_MPa ?? undefined,
    fyk_MPa: input.fyk_MPa ?? undefined,
  })

  const layout = defaultColumnLayout({
    ...input.layout,
    blockRows: rows,
    blockCols: cols,
    blockSpacing_m: spacing,
  })

  return {
    layout,
    summary: summarizeCap(group, block),
    group,
    block,
    foundationKind,
  }
}

export function withCapOnColumn(
  col: ColumnRecord,
  layout: ColumnCapLayout,
  summary: ColumnCapSummary,
): ColumnRecord {
  return { ...col, layout, capSummary: summary }
}

export function missingLoadSummary(label: string): ColumnCapSummary {
  return {
    pileCount: 0,
    rows: 0,
    cols: 0,
    groupPadm_kN: null,
    capacityOk: null,
    groupOk: null,
    maxPileLoad_kN: null,
    width_m: null,
    length_m: null,
    thickness_m: null,
    efficiency: null,
    indicative: true,
    message: `Pilar ${label}: N não informado — bloco não dimensionado.`,
  }
}
