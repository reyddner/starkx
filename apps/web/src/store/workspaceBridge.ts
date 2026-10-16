/**
 * Ponte biblioteca ↔ workspace (DEC-50). Sem recalcular motores.
 */
import {
  useLibraryStore,
  type ProjectWorkspacePayload,
  displayProjectName,
} from './projectLibrary'
import { useProjectStore } from './projectStore'
import type { WizardStep } from './wizardTypes'

export function captureWorkspaceSnapshot(): ProjectWorkspacePayload {
  const s = useProjectStore.getState()
  return {
    theme: s.theme,
    foundationKind: s.foundationKind,
    projectName: s.projectName,
    projectCode: s.projectCode,
    client: s.client,
    location: s.location,
    responsibleEngineer: s.responsibleEngineer,
    groundElevation_m: s.groundElevation_m,
    pileTopElevation_m: s.pileTopElevation_m,
    pileTypeId: s.pileTypeId,
    pileCategory: s.pileCategory,
    diameterCm: s.diameterCm,
    tipDepth_m: s.tipDepth_m,
    areaCm2: s.areaCm2,
    perimeterCm: s.perimeterCm,
    enlargedBaseVolumeLiters: s.enlargedBaseVolumeLiters,
    waterLevel_m: s.waterLevel_m,
    waterLevelDate: s.waterLevelDate,
    waterLevelNotes: s.waterLevelNotes,
    layers: s.layers,
    designLoad_kN: s.designLoad_kN,
    columnLoad: s.columnLoad,
    columns: s.columns,
    activeColumnId: s.activeColumnId,
    mode: s.mode,
    governingRule: s.governingRule,
    selectedMethod: s.selectedMethod,
    aokiFs: s.aokiFs,
    aokiPctTip: s.aokiPctTip,
    aokiPctShaft: s.aokiPctShaft,
    decourtAlphaPct: s.decourtAlphaPct,
    decourtBetaPct: s.decourtBetaPct,
    teixeiraFs: s.teixeiraFs,
    teixeiraPctTip: s.teixeiraPctTip,
    teixeiraPctShaft: s.teixeiraPctShaft,
    fck_MPa: s.fck_MPa,
    fyk_MPa: s.fyk_MPa,
    cover_mm: s.cover_mm,
    loadIsDesign: s.loadIsDesign,
    transverseKind: s.transverseKind,
    blockRows: s.blockRows,
    blockCols: s.blockCols,
    blockSpacing_m: s.blockSpacing_m,
    blockEdge_m: s.blockEdge_m,
    blockThickness_m: s.blockThickness_m,
    blockEmbedment_m: s.blockEmbedment_m,
    blockEfficiency: s.blockEfficiency,
    footingShape: s.footingShape,
    footingAdmMode: s.footingAdmMode,
    footingSigmaAdm_kPa: s.footingSigmaAdm_kPa,
    footingAspect: s.footingAspect,
    footingThickness_m: s.footingThickness_m,
    footingC_kPa: s.footingC_kPa,
    footingPhi_deg: s.footingPhi_deg,
    footingGamma_kN_m3: s.footingGamma_kN_m3,
    footingDf_m: s.footingDf_m,
    footingFs: s.footingFs,
    footingMx_kNm: s.footingMx_kNm,
    footingMy_kNm: s.footingMy_kNm,
    caissonShaftDia_m: s.caissonShaftDia_m,
    caissonBaseDia_m: s.caissonBaseDia_m,
    caissonLength_m: s.caissonLength_m,
    caissonAdmMode: s.caissonAdmMode,
    caissonSigmaAdm_kPa: s.caissonSigmaAdm_kPa,
    caissonC_kPa: s.caissonC_kPa,
    caissonPhi_deg: s.caissonPhi_deg,
    caissonGamma_kN_m3: s.caissonGamma_kN_m3,
    caissonFsTip: s.caissonFsTip,
    caissonUnitFriction_kPa: s.caissonUnitFriction_kPa,
    caissonShaftFS: s.caissonShaftFS,
    caissonShaftMode: s.caissonShaftMode,
    raftAspect: s.raftAspect,
    raftAdmMode: s.raftAdmMode,
    raftSigmaAdm_kPa: s.raftSigmaAdm_kPa,
    raftThickness_m: s.raftThickness_m,
    raftC_kPa: s.raftC_kPa,
    raftPhi_deg: s.raftPhi_deg,
    raftGamma_kN_m3: s.raftGamma_kN_m3,
    raftDf_m: s.raftDf_m,
    raftFs: s.raftFs,
    raftMx_kNm: s.raftMx_kNm,
    raftMy_kNm: s.raftMy_kNm,
    step: s.step,
    __hasCapacityHint:
      s.result != null ||
      s.footingResult != null ||
      s.caissonResult != null ||
      s.raftResult != null,
  }
}

export function hydrateWorkspace(payload: ProjectWorkspacePayload): void {
  useProjectStore.getState().hydrateFromPayload(payload)
}

export function syncActiveToLibrary(): void {
  const lib = useLibraryStore.getState()
  if (!lib.activeProjectId) return
  lib.saveActivePayload(captureWorkspaceSnapshot())
}

/** Abre projeto da biblioteca no workspace. */
export function openLibraryProject(id: string, opts?: { step?: WizardStep }): boolean {
  syncActiveToLibrary()
  const item = useLibraryStore.getState().openProject(id)
  if (!item) return false
  hydrateWorkspace(item.payload)
  if (opts?.step) {
    // Navegação intencional da biblioteca (ex.: Editar → Dados) — sem gate.
    useProjectStore.setState({ step: opts.step, navError: null })
  }
  return true
}

/** Cria projeto em branco e abre no wizard (etapa Dados). */
export function createAndOpenProject(opts?: {
  name?: string
  client?: string
  location?: string
  code?: string
}): void {
  syncActiveToLibrary()
  useProjectStore.getState().resetBlankProject()
  const name = (opts?.name ?? '').trim()
  if (name) {
    useProjectStore.getState().patch({
      projectName: name,
      client: opts?.client ?? '',
      location: opts?.location ?? '',
      projectCode: opts?.code ?? '',
    })
  }
  useLibraryStore.getState().createProject({
    name: name || undefined,
    client: opts?.client,
    location: opts?.location,
    code: opts?.code,
    payload: captureWorkspaceSnapshot(),
  })
  useProjectStore.getState().setStep('project')
}

export function seedLibraryIfNeeded(): void {
  const lib = useLibraryStore.getState()
  if (lib.projects.length > 0) return
  const payload = captureWorkspaceSnapshot()
  const named = displayProjectName(String(payload.projectName ?? ''))
  // Só semeia se houver algo além do blank total
  const layers = Array.isArray(payload.layers) ? payload.layers : []
  if (named === 'Projeto sem nome' && layers.length === 0) {
    lib.setShellView('dashboard')
    return
  }
  lib.ensureSeedFromWorkspace(payload)
}
