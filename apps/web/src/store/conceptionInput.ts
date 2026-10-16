import { resolvePileDatum } from '@domain/pileDatum'
import type { OptimizePileInput } from '@conception/index'
import type { CalculationMode, GoverningRule, MethodId } from '@engine/types'
import type { ColumnRecord } from './columns'
import type { LayerRow } from './wizardTypes'

/**
 * Recorte do store necessário para montar a entrada da concepção (DEC-58).
 * Mantido fora do `projectStore` para não duplicar o mapeamento em cada ação.
 */
export interface ConceptionSourceState {
  layers: LayerRow[]
  columns: ColumnRecord[]
  columnLoad: { N_kN: number | null; Mx_kNm: number | null; My_kNm: number | null }
  designLoad_kN: number | null
  pileTypeId: number
  tipDepth_m: number
  blockThickness_m: number
  blockEmbedment_m: number
  pileTopElevation_m: number | null
  mode: CalculationMode
  governingRule: GoverningRule
  selectedMethod: MethodId
  aokiFs: number
  aokiPctTip: number
  aokiPctShaft: number
  decourtAlphaPct: number | null
  decourtBetaPct: number | null
  teixeiraFs: number
  teixeiraPctTip: number
  teixeiraPctShaft: number
  waterLevel_m: number | null
  softShallowHint?: boolean
}

/** Base comum (perfil, métodos, cotas de topo) sem as cargas do pilar. */
export type OptimizeBase = Omit<OptimizePileInput, 'N_kN' | 'Mx_kNm' | 'My_kNm'>

export function buildOptimizeBase(s: ConceptionSourceState): OptimizeBase {
  const datumIsolated = resolvePileDatum({
    foundationKind: 'pile',
    tipDepth_m: s.tipDepth_m,
    blockThickness_m: s.blockThickness_m,
    blockEmbedment_m: s.blockEmbedment_m,
    pileTopElevation_m: s.pileTopElevation_m,
  })
  const datumCap = resolvePileDatum({
    foundationKind: 'pile_cap',
    tipDepth_m: s.tipDepth_m,
    blockThickness_m: s.blockThickness_m,
    blockEmbedment_m: s.blockEmbedment_m,
    pileTopElevation_m: s.pileTopElevation_m,
  })

  return {
    layers: s.layers,
    preferredPileTypeId: s.pileTypeId,
    mode: s.mode,
    governingRule: s.governingRule,
    selectedMethod: s.selectedMethod,
    aoki: { fs: s.aokiFs, pctTip: s.aokiPctTip, pctShaft: s.aokiPctShaft },
    decourt: {
      alphaPct: s.decourtAlphaPct ?? undefined,
      betaPct: s.decourtBetaPct ?? undefined,
    },
    teixeira: {
      fs: s.teixeiraFs,
      pctTip: s.teixeiraPctTip,
      pctShaft: s.teixeiraPctShaft,
    },
    waterLevel_m: s.waterLevel_m,
    pileTopDepth_m: datumIsolated.pileTopDepth_m,
    pileTopDepthCap_m: datumCap.pileTopDepth_m,
    softShallowHint: s.softShallowHint,
  }
}

/** Carga governante do projeto: maior N entre pilares com carga informada. */
export function governingLoadForConception(s: ConceptionSourceState): {
  N_kN: number
  Mx_kNm: number
  My_kNm: number
  loadedColumns: ColumnRecord[]
} {
  const loadedColumns = s.columns.filter((c) => c.N_kN != null && c.N_kN > 0)
  const N_kN =
    loadedColumns.length > 0
      ? Math.max(...loadedColumns.map((c) => c.N_kN!))
      : (s.columnLoad.N_kN ?? s.designLoad_kN ?? 0)
  return {
    N_kN,
    Mx_kNm: s.columnLoad.Mx_kNm ?? 0,
    My_kNm: s.columnLoad.My_kNm ?? 0,
    loadedColumns,
  }
}
