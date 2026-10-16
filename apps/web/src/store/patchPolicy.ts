/**
 * Política de invalidação do store (Fase B / C1).
 *
 * - safe: só UI/metadados — não toca resultados
 * - keep_padm: cargas / arranjo / armadura params — preserva Padm (result + tipSweep)
 * - invalidate_all: insumos geotécnicos — zera tudo
 */

/** Campos de UI/navegação / resultados explícitos que NÃO invalidam cálculos. */
export const PATCH_SAFE_KEYS = new Set([
  'step',
  'theme',
  'projectName',
  'projectCode',
  'client',
  'location',
  'responsibleEngineer',
  'engineerCrea',
  'companyLogoBase64',
  'groundElevation_m',
  'unitSystem',
  'waterLevelDate',
  'waterLevelNotes',
  'showTraces',
  'showStructuralTraces',
  'calcError',
  'navError',
  'result',
  'structural',
  'blockResult',
  'footingResult',
  'caissonResult',
  'raftResult',
  'groupResult',
  'tipSweepRows',
  'scenarioId',
  'blockEfficiencyHint',
  'foundationSuggestion',
  'analysisAccepted',
])

/**
 * Mudanças que NÃO alteram Padm geotécnico da estaca.
 * NA (DEC-06) e categoria UI entram aqui: só viz/memorial ou filtro.
 * DEC-57: blockThickness/embedment e pileTopElevation afetam datum SPT → invalidam Padm.
 */
export const PATCH_KEEP_PADM_KEYS = new Set([
  'columnLoad',
  'columns',
  'activeColumnId',
  'designLoad_kN',
  'loadIsDesign',
  'blockRows',
  'blockCols',
  'blockSpacing_m',
  'blockEdge_m',
  'blockEfficiency',
  'footingMx_kNm',
  'footingMy_kNm',
  'raftMx_kNm',
  'raftMy_kNm',
  'fck_MPa',
  'fyk_MPa',
  'cover_mm',
  'transverseKind',
  'waterLevel_m',
  'pileCategory',
])

const LOAD_TOUCH_KEYS = new Set([
  'columnLoad',
  'columns',
  'activeColumnId',
  'designLoad_kN',
  'loadIsDesign',
  'footingMx_kNm',
  'footingMy_kNm',
  'raftMx_kNm',
  'raftMy_kNm',
])

const BLOCK_TOUCH_KEYS = new Set([
  'blockRows',
  'blockCols',
  'blockSpacing_m',
  'blockEdge_m',
  'blockThickness_m',
  'blockEmbedment_m',
  'blockEfficiency',
])

export type PatchEffect = 'safe' | 'keep_padm' | 'invalidate_all'

export function classifyPatchKeys(keys: string[]): PatchEffect {
  if (keys.length === 0) return 'safe'
  if (keys.every((k) => PATCH_SAFE_KEYS.has(k))) return 'safe'
  if (keys.every((k) => PATCH_SAFE_KEYS.has(k) || PATCH_KEEP_PADM_KEYS.has(k))) {
    return 'keep_padm'
  }
  return 'invalidate_all'
}

export function patchTouchesLoads(keys: string[]): boolean {
  return keys.some((k) => LOAD_TOUCH_KEYS.has(k))
}

export function patchTouchesBlockLayout(keys: string[]): boolean {
  return keys.some((k) => BLOCK_TOUCH_KEYS.has(k))
}
