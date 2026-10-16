import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { calculate } from '@engine/index'
import type {
  CalculationResult,
  CalculationMode,
  GoverningRule,
  MethodId,
} from '@engine/types'
import { PILE_TYPES } from '@engine/catalogs'
import { flatStoreToGeotechnicalInput } from '@domain/adapters/from-flat-ui'
import { resolvePileDatum, suggestPileLengthForSpt } from '@domain/pileDatum'
import { designPileReinforcement } from '@structural/design'
import type { StructuralDesignResult } from '@structural/design'
import {
  designPileCap,
  defaultSpacing_m,
  minSpacingFactorForPileType,
  suggestEfficiencyConverseLabarre,
} from '@block/index'
import type { BlockDesignResult } from '@block/index'
import { designFooting } from '@footing/index'
import type { FootingAdmMode, FootingDesignResult, FootingShape } from '@footing/index'
import { designCaisson } from '@caisson/index'
import type { CaissonAdmMode, CaissonDesignResult, CaissonShaftMode } from '@caisson/index'
import { designRaft } from '@raft/index'
import type { RaftDesignResult } from '@raft/index'
import { designPileGroup, suggestPileGroupLayout } from '@group/index'
import {
  canEnterStep,
  canRunCalculation,
  flowForKind,
  type FlowGateInput,
} from './wizardFlow'
import {
  classifyPatchKeys,
  patchTouchesBlockLayout,
  patchTouchesLoads,
} from './patchPolicy'
import {
  columnToLoad,
  createColumn,
  emptyColumnLoad,
  ensureColumnsFromLegacy,
  hasAnyColumnLoad,
  resizeColumns,
  upsertColumn,
  type ColumnLoadInput,
  type ColumnRecord,
} from './columns'
import {
  defaultColumnLayout,
  designColumnCap,
  missingLoadSummary,
  summarizeCap,
  withCapOnColumn,
} from './columnCaps'
import type { FoundationKindUi, LayerRow, WizardStep } from './wizardTypes'
import type { FoundationSuggestResult } from '@assist/index'
import { suggestFoundationKind } from '@assist/index'
import {
  optimizePileSolution,
  standardizeDiameterCm,
  type ConceptionPileResult,
  type ConceptionRole,
  type PileSolutionCandidate,
} from '@conception/index'
import { categoryOfPileType } from '@engine/pile-catalog'
import { RECOMMENDED_METHOD_CONFIG } from './methodDefaults'
import { buildOptimizeBase, governingLoadForConception } from './conceptionInput'

export type { FoundationKindUi, LayerRow, WizardStep } from './wizardTypes'
export type { ColumnLoadInput, ColumnRecord } from './columns'
export type { ColumnCapLayout, ColumnCapSummary } from './columnCaps'
export type { FoundationSuggestResult } from '@assist/index'

/** Debounce de auto-dimensionamento após patch (DEC-33). */
const AUTO_DESIGN_DEBOUNCE_MS = 320
let autoDesignTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutoDesign(run: () => void) {
  if (autoDesignTimer != null) clearTimeout(autoDesignTimer)
  autoDesignTimer = setTimeout(() => {
    autoDesignTimer = null
    run()
  }, AUTO_DESIGN_DEBOUNCE_MS)
}

export interface TipSweepRow {
  tipDepth_m: number
  padmAverage_kN: number
  padmMinimum_kN: number
  padmGoverning_kN: number
}

export interface GroupDesignSummary {
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
}

interface ProjectState {
  step: WizardStep
  theme: 'light' | 'dark'
  foundationKind: FoundationKindUi
  projectName: string
  projectCode: string
  client: string
  location: string
  /** Responsável técnico (DEC-37 / dados da obra). */
  responsibleEngineer: string
  /** CREA/CAU do responsável técnico. */
  engineerCrea?: string
  /** Logotipo da empresa em Base64 (PNG/JPG) para personalização white-label dos carimbos. */
  companyLogoBase64?: string
  /** Cota do terreno (m) — referência. */
  groundElevation_m: number | null
  /** Cota do topo da estaca (m). */
  pileTopElevation_m: number | null
  /** Sistema de unidades na UI (motor sempre SI). */
  unitSystem: 'SI'
  waterLevel_m: number | null
  waterLevelDate: string
  waterLevelNotes: string
  pileTypeId: number
  /** Categoria UI: moldada | pre_moldada | metalica */
  pileCategory: 'moldada_in_loco' | 'pre_moldada' | 'metalica' | null
  diameterCm: number
  tipDepth_m: number
  areaCm2: string
  perimeterCm: string
  enlargedBaseVolumeLiters: string
  layers: LayerRow[]
  designLoad_kN: number | null
  /** Cargas do pilar ativo (espelho de `columns[activeColumnId]`). */
  columnLoad: ColumnLoadInput
  /** Pilares cadastrados (DEC-44). Dimensionamento usa o ativo. */
  columns: ColumnRecord[]
  activeColumnId: string
  mode: CalculationMode
  governingRule: GoverningRule
  /** Obrigatório se governingRule === user_selected */
  selectedMethod: MethodId
  aokiFs: number
  aokiPctTip: number
  aokiPctShaft: number
  decourtAlphaPct: number | null
  decourtBetaPct: number | null
  teixeiraFs: number
  teixeiraPctTip: number
  teixeiraPctShaft: number
  fck_MPa: number | null
  fyk_MPa: number
  cover_mm: number
  loadIsDesign: boolean
  transverseKind: 'stirrup' | 'spiral'
  blockRows: number
  blockCols: number
  blockSpacing_m: number | null
  blockEdge_m: number
  blockThickness_m: number
  /** Embutimento da estaca no bloco (m) — DEC-54 default 0,10 */
  blockEmbedment_m: number
  /** η do grupo; null = não informado → Padm_g apenas indicativo (DEC-17) */
  blockEfficiency: number | null
  /** Última sugestão de Converse-Labarre (só informação UI) */
  blockEfficiencyHint: number | null
  /** Resultado da análise heurística DEC-54 */
  foundationSuggestion: FoundationSuggestResult | null
  /** Engenheiro aceitou/avançou a análise */
  analysisAccepted: boolean
  /** Concepção automática Ø×L×n (não persiste). */
  conceptionResult: ConceptionPileResult | null
  footingShape: FootingShape
  footingAdmMode: FootingAdmMode
  footingSigmaAdm_kPa: number
  footingAspect: number
  footingThickness_m: number | null
  footingC_kPa: number
  footingPhi_deg: number
  footingGamma_kN_m3: number
  footingDf_m: number
  footingFs: number
  footingMx_kNm: number | null
  footingMy_kNm: number | null
  caissonShaftDia_m: number
  caissonBaseDia_m: number | null
  caissonLength_m: number
  caissonAdmMode: CaissonAdmMode
  caissonSigmaAdm_kPa: number
  caissonC_kPa: number
  caissonPhi_deg: number
  caissonGamma_kN_m3: number
  caissonFsTip: number
  /** Atrito lateral unitário (kPa) — STX-CAI-001 */
  caissonUnitFriction_kPa: number
  /** FS do fuste (adimensional) */
  caissonShaftFS: number
  /** user = fs informado; spt_aoki = α·NSPT (DEC-22) */
  caissonShaftMode: CaissonShaftMode
  raftAspect: number
  raftAdmMode: FootingAdmMode
  raftSigmaAdm_kPa: number
  raftThickness_m: number | null
  raftC_kPa: number
  raftPhi_deg: number
  raftGamma_kN_m3: number
  raftDf_m: number
  raftFs: number
  raftMx_kNm: number | null
  raftMy_kNm: number | null
  result: CalculationResult | null
  structural: StructuralDesignResult | null
  blockResult: BlockDesignResult | null
  footingResult: FootingDesignResult | null
  caissonResult: CaissonDesignResult | null
  raftResult: RaftDesignResult | null
  groupResult: GroupDesignSummary | null
  tipSweepRows: TipSweepRow[]
  /** Cenário ativo (onda 7 scaffold). */
  scenarioId: string
  calcError: string | null
  navError: string | null
  showTraces: boolean
  showStructuralTraces: boolean
  setStep: (s: WizardStep) => void
  setTheme: (t: 'light' | 'dark') => void
  patch: (p: Partial<ProjectState>) => void
  loadReferenceExample: () => void
  /** Projeto em branco (sem sondagem demonstrativa). */
  resetBlankProject: () => void
  /** Restaura inputs de um snapshot da biblioteca (DEC-50). */
  hydrateFromPayload: (payload: Record<string, unknown>) => void
  /**
   * @param opts.preserveStep — atualiza Padm/veredito sem ir para Capacidade (C1).
   * @param opts.skipArrangement — não redimensiona n estacas (evita loop após snap de ponta).
   */
  runCalculation: (opts?: { preserveStep?: boolean; skipArrangement?: boolean }) => void
  addColumn: () => void
  removeColumn: (id: string) => void
  setActiveColumn: (id: string) => void
  setColumnCount: (n: number) => void
  patchColumnById: (id: string, partial: Partial<ColumnLoadInput>) => void
  /** Sugere e dimensiona bloco/grupo para todos os pilares (DEC-45). */
  runAllColumnCaps: () => void
  runFoundationAnalysis: () => void
  acceptFoundationSuggestion: () => void
  /** Recalcula concepção Ø×L×n sem aplicar. */
  runConception: () => void
  /** Aplica Ø e propõe L/arranjo coerentes com aquele diâmetro. */
  suggestGeometryForDiameter: (diameterCm: number) => void
  /** Aplica candidato (recomendado, papel, ou opção da exploração). */
  applyConception: (roleOrCandidate?: ConceptionRole | PileSolutionCandidate) => void
  /** Concepção + aplicação automática do recomendado. */
  runConceptionAndApply: () => void
  runStructural: (opts?: { preserveStep?: boolean }) => void
  /** Roda bloco/armadura pendentes para o caderno de pranchas sair completo. */
  prepareDrawings: () => void
  runBlockDesign: () => void
  runFootingDesign: (opts?: { preserveStep?: boolean }) => void
  runCaissonDesign: (opts?: { preserveStep?: boolean }) => void
  runRaftDesign: (opts?: { preserveStep?: boolean }) => void
  runTipSweep: (from_m: number, to_m: number, step_m: number) => void
  runGroupDesign: () => void
  /** Preenche blockEfficiency com η de Converse-Labarre (DEC-21). */
  applyConverseLabarreEfficiency: () => void
  /** Carga por estaca para armadura (nunca a carga bruta do bloco). */
  resolvePileNk_kN: () => number | null
  /** Momento resultante por estaca (DEC-51). */
  resolvePileMk_kNm: () => number
  /** Cortante resultante por estaca (DEC-51). */
  resolvePileVk_kN: () => number
  /** Muda pile↔pile_cap sem invalidar Padm (arranjo). */
  applyPileLayout: (rows: number, cols: number) => void
  toGateInput: () => FlowGateInput
}

/**
 * Exemplo de referência (ref-escavada-30): estaca escavada Ø30 cm × 8 m.
 * Perfil sintético — argila mole sobre silte arenoso. Os valores esperados estão em
 * tests/fixtures/ref-escavada-30.json, calculados à mão pelas fórmulas publicadas.
 */
const referenceLayers: LayerRow[] = [
  { depth_m: 1, nspt: 3, soilTypeId: 11 },
  { depth_m: 2, nspt: 4, soilTypeId: 11 },
  { depth_m: 3, nspt: 6, soilTypeId: 12 },
  { depth_m: 4, nspt: 8, soilTypeId: 12 },
  { depth_m: 5, nspt: 10, soilTypeId: 9 },
  { depth_m: 6, nspt: 13, soilTypeId: 9 },
  { depth_m: 7, nspt: 16, soilTypeId: 7 },
  { depth_m: 8, nspt: 20, soilTypeId: 7 },
  { depth_m: 9, nspt: 24, soilTypeId: 7 },
  { depth_m: 10, nspt: 28, soilTypeId: 7 },
]

const initialColumn = createColumn({ columnLabel: 'P01' })

/**
 * Projetos salvos antes da revisão dos métodos podiam usar o modo de compatibilidade
 * (removido). Passam para o modo único; a regra "média" daquele modo vira "mínimo".
 */
export function normalizeLegacyMode<T extends Record<string, unknown>>(p: T): T {
  if (p.mode !== 'excel_legacy') return p
  return {
    ...p,
    mode: 'engineering',
    governingRule: p.governingRule === 'average' ? 'minimum' : p.governingRule,
  }
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      step: 'project',
      theme: 'light',
      foundationKind: 'pile_cap',
      projectName: '',
      projectCode: '',
      client: '',
      location: '',
      responsibleEngineer: '',
      engineerCrea: '',
      companyLogoBase64: undefined,
      groundElevation_m: 0,
      pileTopElevation_m: 0,
      unitSystem: 'SI',
      pileTypeId: 6,
      pileCategory: 'moldada_in_loco',
      diameterCm: 30,
      tipDepth_m: 4,
      areaCm2: '',
      perimeterCm: '',
      enlargedBaseVolumeLiters: '',
      waterLevel_m: null,
      waterLevelDate: '',
      waterLevelNotes: '',
      layers: [],
      designLoad_kN: null,
      columnLoad: columnToLoad(initialColumn),
      columns: [initialColumn],
      activeColumnId: initialColumn.id,
      ...RECOMMENDED_METHOD_CONFIG,
      fck_MPa: null,
      fyk_MPa: 500,
      cover_mm: 30,
      loadIsDesign: false,
      transverseKind: 'spiral',
      blockRows: 1,
      blockCols: 1,
      blockSpacing_m: null,
      blockEdge_m: 0.25,
      blockThickness_m: 0.5,
      blockEmbedment_m: 0.1,
      blockEfficiency: null,
      blockEfficiencyHint: null,
      foundationSuggestion: null,
      analysisAccepted: false,
      conceptionResult: null,
      footingShape: 'square',
      footingAdmMode: 'user',
      footingSigmaAdm_kPa: 200,
      footingAspect: 1.5,
      footingThickness_m: null,
      footingC_kPa: 0,
      footingPhi_deg: 30,
      footingGamma_kN_m3: 18,
      footingDf_m: 1.5,
      footingFs: 3,
      footingMx_kNm: null,
      footingMy_kNm: null,
      caissonShaftDia_m: 1.2,
      caissonBaseDia_m: null,
      caissonLength_m: 8,
      caissonAdmMode: 'user',
      caissonSigmaAdm_kPa: 400,
      caissonC_kPa: 0,
      caissonPhi_deg: 30,
      caissonGamma_kN_m3: 18,
      caissonFsTip: 3,
      caissonUnitFriction_kPa: 0,
      caissonShaftFS: 1.5,
      caissonShaftMode: 'user',
      raftAspect: 1.5,
      raftAdmMode: 'user',
      raftSigmaAdm_kPa: 150,
      raftThickness_m: null,
      raftC_kPa: 0,
      raftPhi_deg: 30,
      raftGamma_kN_m3: 18,
      raftDf_m: 1.5,
      raftFs: 3,
      raftMx_kNm: null,
      raftMy_kNm: null,
      result: null,
      structural: null,
      blockResult: null,
      footingResult: null,
      caissonResult: null,
      raftResult: null,
      groupResult: null,
      tipSweepRows: [],
      scenarioId: 'default',
      calcError: null,
      navError: null,
      showTraces: false,
      showStructuralTraces: false,
      toGateInput: (): FlowGateInput => {
        const s = get()
        return {
          step: s.step,
          foundationKind: s.foundationKind,
          projectName: s.projectName,
          layers: s.layers,
          waterLevel_m: s.waterLevel_m,
          pileTypeId: s.pileTypeId,
          diameterCm: s.diameterCm,
          tipDepth_m: s.tipDepth_m,
          blockThickness_m: s.blockThickness_m,
          blockEmbedment_m: s.blockEmbedment_m,
          pileTopElevation_m: s.pileTopElevation_m,
          mode: s.mode,
          governingRule: s.governingRule,
          designLoad_kN: s.designLoad_kN,
          hasColumnLoad: hasAnyColumnLoad(s.columns, s.designLoad_kN),
          analysisAccepted: s.analysisAccepted,
          result: s.result,
          structural: s.structural,
          blockResult: s.blockResult,
          footingResult: s.footingResult,
          caissonResult: s.caissonResult,
          raftResult: s.raftResult,
          blockRows: s.blockRows,
          blockCols: s.blockCols,
        }
      },
      setStep: (step) => {
        const gate = canEnterStep(get().toGateInput(), step)
        if (!gate.ok) {
          set({ navError: gate.reason ?? 'Etapa bloqueada.' })
          return
        }
        set({ step, navError: null })
      },
      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme
        set({ theme })
      },
      patch: (p) => {
        const keys = Object.keys(p)
        const effect = classifyPatchKeys(keys)
        const s0 = get()

        // Mantém lista `columns` alinhada ao pilar ativo quando `columnLoad` muda.
        let synced: Partial<ProjectState> = { ...p }
        if (p.columnLoad != null) {
          const activeId = p.activeColumnId ?? s0.activeColumnId
          synced = {
            ...synced,
            columns: upsertColumn(s0.columns, activeId, p.columnLoad),
            activeColumnId: activeId,
          }
        }
        if (p.columns != null && p.columnLoad == null && p.activeColumnId != null) {
          const active = p.columns.find((c) => c.id === p.activeColumnId)
          if (active) {
            synced = {
              ...synced,
              columnLoad: columnToLoad(active),
              designLoad_kN: active.N_kN,
            }
          }
        }

        // DEC-57: se o datum mudou e L não foi editado nesta patch, alinha L a uma camada SPT.
        const tipExplicit = Object.prototype.hasOwnProperty.call(p, 'tipDepth_m')
        const nextKind = synced.foundationKind ?? s0.foundationKind
        if (
          !tipExplicit &&
          (nextKind === 'pile' || nextKind === 'pile_cap') &&
          (Object.prototype.hasOwnProperty.call(p, 'foundationKind') ||
            Object.prototype.hasOwnProperty.call(p, 'blockThickness_m') ||
            Object.prototype.hasOwnProperty.call(p, 'blockEmbedment_m') ||
            Object.prototype.hasOwnProperty.call(p, 'pileTopElevation_m') ||
            Object.prototype.hasOwnProperty.call(p, 'layers'))
        ) {
          const snap = suggestPileLengthForSpt({
            foundationKind: nextKind,
            tipDepth_m: synced.tipDepth_m ?? s0.tipDepth_m,
            blockThickness_m: synced.blockThickness_m ?? s0.blockThickness_m,
            blockEmbedment_m: synced.blockEmbedment_m ?? s0.blockEmbedment_m,
            pileTopElevation_m:
              synced.pileTopElevation_m !== undefined
                ? synced.pileTopElevation_m
                : s0.pileTopElevation_m,
            layers: synced.layers ?? s0.layers,
          })
          if (snap.snapped) {
            synced = { ...synced, tipDepth_m: snap.tipDepth_m }
          }
        }


        if (effect === 'safe') {
          set(synced)
          return
        }

        if (effect === 'keep_padm') {
          const loadTouched = patchTouchesLoads(keys)
          set({
            ...synced,
            structural: null,
            blockResult: null,
            footingResult: null,
            caissonResult: null,
            raftResult: null,
            groupResult: null,
            calcError: null,
            showStructuralTraces: false,
            ...(loadTouched
              ? { foundationSuggestion: null, analysisAccepted: false, conceptionResult: null }
              : {}),
          })
          scheduleAutoDesign(() => {
            const next = get()
            const blockTouched = patchTouchesBlockLayout(keys)

            if (
              next.result &&
              (next.foundationKind === 'pile' || next.foundationKind === 'pile_cap')
            ) {
              if (loadTouched) {
                // Recalcula Padm se necessário e SEMPRE reajusta n estacas automaticamente.
                next.runCalculation({ preserveStep: true })
              } else if (next.foundationKind === 'pile_cap' && blockTouched) {
                next.runGroupDesign()
              } else if (next.foundationKind === 'pile_cap') {
                next.runBlockDesign()
              }
            }

            // Redimensionamento automático não deve roubar a etapa do usuário.
            if (next.foundationKind === 'footing' && next.designLoad_kN != null && loadTouched) {
              next.runFootingDesign({ preserveStep: true })
            }
            if (next.foundationKind === 'caisson' && next.designLoad_kN != null && loadTouched) {
              next.runCaissonDesign({ preserveStep: true })
            }
            if (next.foundationKind === 'raft' && next.designLoad_kN != null && loadTouched) {
              next.runRaftDesign({ preserveStep: true })
            }
          })
          return
        }

        set({
          ...synced,
          result: null,
          structural: null,
          blockResult: null,
          footingResult: null,
          caissonResult: null,
          raftResult: null,
          groupResult: null,
          tipSweepRows: [],
          calcError: null,
          showTraces: false,
          showStructuralTraces: false,
          foundationSuggestion: null,
          analysisAccepted: false,
          conceptionResult: null,
        })
        scheduleAutoDesign(() => {
          const next = get()
          if (next.foundationKind === 'pile_cap') {
            next.runBlockDesign()
          }
          if (next.foundationKind === 'footing' && next.designLoad_kN != null) {
            next.runFootingDesign({ preserveStep: true })
          }
          if (next.foundationKind === 'caisson' && next.designLoad_kN != null) {
            next.runCaissonDesign({ preserveStep: true })
          }
          if (next.foundationKind === 'raft' && next.designLoad_kN != null) {
            next.runRaftDesign({ preserveStep: true })
          }
        })
      },
      addColumn: () => {
        const s = get()
        const col = createColumn({}, s.columns)
        set({
          columns: [...s.columns, col],
          activeColumnId: col.id,
          columnLoad: columnToLoad(col),
          designLoad_kN: col.N_kN,
          structural: null,
          blockResult: null,
          groupResult: null,
          footingResult: null,
          caissonResult: null,
          raftResult: null,
          calcError: null,
        })
      },
      removeColumn: (id) => {
        const s = get()
        if (s.columns.length <= 1) {
          set({ calcError: 'É necessário manter ao menos um pilar cadastrado.' })
          return
        }
        const columns = s.columns.filter((c) => c.id !== id)
        const nextActive =
          s.activeColumnId === id ? columns[0]! : columns.find((c) => c.id === s.activeColumnId) ?? columns[0]!
        set({
          columns,
          activeColumnId: nextActive.id,
          columnLoad: columnToLoad(nextActive),
          designLoad_kN: nextActive.N_kN,
          structural: null,
          blockResult: null,
          groupResult: null,
          footingResult: null,
          caissonResult: null,
          raftResult: null,
          calcError: null,
        })
        scheduleAutoDesign(() => {
          const next = get()
          if (next.foundationKind === 'pile_cap' && next.result) {
            next.runBlockDesign()
            next.runGroupDesign()
          }
        })
      },
      setActiveColumn: (id) => {
        const s = get()
        const target = s.columns.find((c) => c.id === id)
        if (!target) return
        const activeLayout = defaultColumnLayout({
          blockRows: s.blockRows,
          blockCols: s.blockCols,
          blockSpacing_m: s.blockSpacing_m,
          blockEdge_m: s.blockEdge_m,
          blockThickness_m: s.blockThickness_m,
          blockEfficiency: s.blockEfficiency,
        })
        const activeSummary =
          s.groupResult || s.blockResult
            ? summarizeCap(s.groupResult, s.blockResult)
            : (s.columns.find((c) => c.id === s.activeColumnId)?.capSummary ?? null)
        const columns = upsertColumn(s.columns, s.activeColumnId, {
          ...s.columnLoad,
          layout: activeLayout,
          capSummary: activeSummary,
        })
        const active = columns.find((c) => c.id === id) ?? target
        const layout = active.layout ?? defaultColumnLayout()
        const nextKind: FoundationKindUi =
          s.foundationKind === 'pile' || s.foundationKind === 'pile_cap'
            ? 'pile_cap'
            : s.foundationKind
        set({
          columns,
          activeColumnId: active.id,
          columnLoad: columnToLoad(active),
          designLoad_kN: active.N_kN,
          blockRows: layout.blockRows,
          blockCols: layout.blockCols,
          blockSpacing_m: layout.blockSpacing_m,
          blockEdge_m: layout.blockEdge_m,
          blockThickness_m: layout.blockThickness_m,
          blockEfficiency: layout.blockEfficiency,
          foundationKind: nextKind,
          structural: null,
          blockResult: null,
          groupResult: null,
          footingResult: null,
          caissonResult: null,
          raftResult: null,
          calcError: null,
        })
        scheduleAutoDesign(() => {
          const next = get()
          if (next.result && (next.foundationKind === 'pile' || next.foundationKind === 'pile_cap')) {
            if (next.foundationKind === 'pile') {
              next.runCalculation({ preserveStep: true })
            }
            if (next.foundationKind === 'pile_cap') {
              next.runBlockDesign()
              next.runGroupDesign()
            }
          }
          if (next.foundationKind === 'footing' && next.designLoad_kN != null) {
            next.runFootingDesign({ preserveStep: true })
          }
          if (next.foundationKind === 'caisson' && next.designLoad_kN != null) {
            next.runCaissonDesign({ preserveStep: true })
          }
          if (next.foundationKind === 'raft' && next.designLoad_kN != null) {
            next.runRaftDesign({ preserveStep: true })
          }
        })
      },
      setColumnCount: (n) => {
        const s = get()
        const resized = resizeColumns(s.columns, n, s.activeColumnId)
        const active =
          resized.columns.find((c) => c.id === resized.activeColumnId) ?? resized.columns[0]!
        set({
          columns: resized.columns,
          activeColumnId: resized.activeColumnId,
          columnLoad: columnToLoad(active),
          designLoad_kN: active.N_kN,
          structural: null,
          blockResult: null,
          groupResult: null,
          footingResult: null,
          caissonResult: null,
          raftResult: null,
          foundationSuggestion: null,
          analysisAccepted: false,
          conceptionResult: null,
          calcError: null,
        })
      },
      patchColumnById: (id, partial) => {
        const s = get()
        const columns = upsertColumn(s.columns, id, partial)
        const active = columns.find((c) => c.id === s.activeColumnId) ?? columns[0]!
        const isActive = id === s.activeColumnId
        const loadKeys = new Set([
          'N_kN',
          'Mx_kNm',
          'My_kNm',
          'Qx_kN',
          'Qy_kN',
          'T_kNm',
        ])
        const touchesLoad = Object.keys(partial).some((k) => loadKeys.has(k))
        set({
          columns,
          ...(isActive
            ? {
                columnLoad: columnToLoad({ ...active, ...partial, id: active.id }),
                designLoad_kN:
                  partial.N_kN !== undefined ? partial.N_kN : active.N_kN,
              }
            : {}),
          ...(touchesLoad
            ? {
                structural: null,
                blockResult: null,
                groupResult: null,
                footingResult: null,
                caissonResult: null,
                raftResult: null,
                foundationSuggestion: null,
                analysisAccepted: false,
                conceptionResult: null,
              }
            : {}),
          calcError: null,
        })
        if (touchesLoad) {
          scheduleAutoDesign(() => {
            const next = get()
            if (
              next.result &&
              (next.foundationKind === 'pile' || next.foundationKind === 'pile_cap')
            ) {
              if (next.foundationKind === 'pile') {
                next.runCalculation({ preserveStep: true })
              }
              if (next.foundationKind === 'pile_cap') {
                next.runBlockDesign()
                next.runGroupDesign()
              }
            }
            if (next.foundationKind === 'footing' && next.designLoad_kN != null) {
              next.runFootingDesign({ preserveStep: true })
            }
            if (next.foundationKind === 'caisson' && next.designLoad_kN != null) {
              next.runCaissonDesign({ preserveStep: true })
            }
            if (next.foundationKind === 'raft' && next.designLoad_kN != null) {
              next.runRaftDesign({ preserveStep: true })
            }
          })
        }
      },
      runFoundationAnalysis: () => {
        const s = get()
        const suggestion = suggestFoundationKind({
          columns: s.columns.map((c) => ({
            id: c.id,
            columnLabel: c.columnLabel,
            N_kN: c.N_kN,
            Mx_kNm: c.Mx_kNm,
            My_kNm: c.My_kNm,
          })),
          loadIsDesign: s.loadIsDesign,
          sigmaAdm_kPa: s.footingSigmaAdm_kPa > 0 ? s.footingSigmaAdm_kPa : 200,
          footingAspect: s.footingAspect,
          layers: s.layers.map((l) => ({ depth_m: l.depth_m, nspt: l.nspt })),
          waterLevel_m: s.waterLevel_m,
        })
        // Remount da Análise não desfaz aceite já confirmado (Bugbot DEC-54).
        set({
          foundationSuggestion: suggestion,
          analysisAccepted: s.analysisAccepted,
          calcError: null,
        })
        get().runConception()

        // DEC-58: a recomendada já entra aplicada. Enquanto o usuário não
        // confirmou nada, seguimos o tipo sugerido; após o aceite, respeitamos
        // a escolha dele e apenas mantemos a concepção como referência.
        if (s.analysisAccepted) return
        const kind = suggestion.suggestedKind
        if (kind === 'pile' || kind === 'pile_cap') {
          get().applyConception('recommended')
        } else {
          set({
            foundationKind: kind,
            result: null,
            tipSweepRows: [],
            groupResult: null,
            structural: null,
            blockResult: null,
            ...(kind !== 'footing' ? { footingResult: null } : {}),
            ...(kind !== 'caisson' ? { caissonResult: null } : {}),
            ...(kind !== 'raft' ? { raftResult: null } : {}),
          })
        }
      },
      acceptFoundationSuggestion: () => {
        const s = get()
        const kind = s.foundationSuggestion?.suggestedKind ?? s.foundationKind
        const leavingPile = kind !== 'pile' && kind !== 'pile_cap'
        const leavingCap = kind !== 'pile_cap'
        set({
          foundationKind: kind,
          analysisAccepted: true,
          ...(leavingPile
            ? { result: null, tipSweepRows: [], groupResult: null, structural: null }
            : {}),
          ...(leavingCap ? { blockResult: null, groupResult: null } : {}),
          ...(kind !== 'footing' ? { footingResult: null } : {}),
          ...(kind !== 'caisson' ? { caissonResult: null } : {}),
          ...(kind !== 'raft' ? { raftResult: null } : {}),
        })
        // Aplica concepção automática para estaca/bloco (Ø, L, n, η Converse-Labarre).
        if (kind === 'pile' || kind === 'pile_cap') {
          get().runConceptionAndApply()
        }
        get().setStep('foundation')
      },
      runConception: () => {
        const s = get()
        const source = { ...s, softShallowHint: s.foundationSuggestion?.soil.softShallow }
        const optBase = buildOptimizeBase(source)
        const { N_kN, Mx_kNm, My_kNm, loadedColumns } = governingLoadForConception(source)

        let fixedDiameterCm: number | undefined
        if (loadedColumns.length > 1) {
          const diameters: number[] = []
          for (const col of loadedColumns) {
            const partial = optimizePileSolution({
              ...optBase,
              N_kN: col.N_kN!,
              Mx_kNm: col.Mx_kNm ?? 0,
              My_kNm: col.My_kNm ?? 0,
            })
            if (partial.recommended) diameters.push(partial.recommended.diameterCm)
          }
          fixedDiameterCm = standardizeDiameterCm(diameters) ?? undefined
        }

        const result = optimizePileSolution({
          ...optBase,
          N_kN,
          Mx_kNm,
          My_kNm,
          fixedDiameterCm,
        })
        set({ conceptionResult: result })
      },
      /**
       * Ao escolher um Ø, o STARKX propõe o L (e o arranjo) coerente com aquele
       * diâmetro — o usuário não precisa adivinhar comprimento (DEC-58).
       */
      suggestGeometryForDiameter: (diameterCm) => {
        const s = get()
        if (!(diameterCm > 0) || s.layers.length === 0) {
          set({ diameterCm })
          return
        }
        const source = {
          ...s,
          diameterCm,
          softShallowHint: s.foundationSuggestion?.soil.softShallow,
        }
        const { N_kN, Mx_kNm, My_kNm } = governingLoadForConception(source)
        if (!(N_kN > 0)) {
          set({ diameterCm })
          return
        }

        const result = optimizePileSolution({
          ...buildOptimizeBase(source),
          N_kN,
          Mx_kNm,
          My_kNm,
          fixedDiameterCm: diameterCm,
          searchCategory: false,
        })
        const candidate = result.recommended
        if (candidate != null && candidate.diameterCm === diameterCm) {
          set({ diameterCm, navError: null })
          get().applyConception(candidate)
          return
        }

        // Sem Padm viável nesse Ø: manda a ponta para a última camada SPT.
        const datum = resolvePileDatum({
          foundationKind: s.foundationKind,
          tipDepth_m: s.tipDepth_m,
          blockThickness_m: s.blockThickness_m,
          blockEmbedment_m: s.blockEmbedment_m,
          pileTopElevation_m: s.pileTopElevation_m,
        })
        const maxSpt = s.layers.reduce((m, l) => Math.max(m, l.depth_m), 0)
        const maxL = Math.max(1, Number((maxSpt - datum.pileTopDepth_m).toFixed(3)))
        set({
          diameterCm,
          tipDepth_m: maxL,
          navError: `Ø ${diameterCm} cm não fecha a carga sozinho neste perfil — L foi até a última camada (${maxL.toFixed(2)} m). Ajuste L ou volte à Análise.`,
        })
      },
      applyConception: (roleOrCandidate) => {
        const s = get()
        let candidate: PileSolutionCandidate | null = s.conceptionResult?.recommended ?? null
        if (roleOrCandidate != null && typeof roleOrCandidate === 'object') {
          candidate = roleOrCandidate
        } else if (
          roleOrCandidate != null &&
          roleOrCandidate !== 'recommended' &&
          s.conceptionResult
        ) {
          const alt = s.conceptionResult.alternatives.find((a) => a.role === roleOrCandidate)
          if (alt) candidate = alt.candidate
        }
        if (candidate == null) return

        const n = candidate.nPiles
        // Pilar → sempre bloco (1E+). Não apoiar fuste direto sob o pilar.
        const kind: FoundationKindUi = 'pile_cap'
        const spacing =
          s.blockSpacing_m != null && s.blockSpacing_m > 0
            ? s.blockSpacing_m
            : defaultSpacing_m(candidate.diameterCm / 100, minSpacingFactorForPileType(s.pileTypeId))

        const snap = suggestPileLengthForSpt({
          foundationKind: kind,
          tipDepth_m: candidate.tipDepth_m,
          blockThickness_m: s.blockThickness_m,
          blockEmbedment_m: s.blockEmbedment_m,
          pileTopElevation_m: s.pileTopElevation_m,
          layers: s.layers,
        })
        const tipDepth_m = snap.snapped ? snap.tipDepth_m : candidate.tipDepth_m

        set({
          pileTypeId: candidate.pileTypeId,
          pileCategory: categoryOfPileType(candidate.pileTypeId),
          diameterCm: candidate.diameterCm,
          tipDepth_m,
          blockRows: candidate.rows,
          blockCols: candidate.cols,
          blockEfficiency: n > 1 ? candidate.efficiency : null,
          foundationKind: kind,
          mode: 'engineering',
          calcError: null,
          navError: null,
        })

        get().runCalculation({ preserveStep: true, skipArrangement: true })

        const after = get()
        if (after.result == null) return

        get().runBlockDesign()

        const padm = after.result.atTip.governingPadm_kN
        const eta = n > 1 ? candidate.efficiency : 1
        const groupPadm_kN = n * padm * eta
        const N = after.columnLoad.N_kN ?? after.designLoad_kN ?? 0
        set({
          groupResult: {
            nPiles: n,
            rows: candidate.rows,
            cols: candidate.cols,
            spacing_m: spacing,
            maxPileLoad_kN: N / Math.max(1, n),
            minPileLoad_kN: N / Math.max(1, n),
            hasTension: false,
            efficiency: n > 1 ? eta : null,
            groupPadm_kN,
            ok: N <= groupPadm_kN + 1e-6,
            message: `Concepção aplicada: bloco ${candidate.rows}×${candidate.cols} (${n} estaca(s)) Ø${candidate.diameterCm} cm × ${tipDepth_m.toFixed(1)} m.`,
            pileLoads_kN: Array.from({ length: n }, () => N / Math.max(1, n)),
          },
        })
      },
      runConceptionAndApply: () => {
        get().runConception()
        get().applyConception('recommended')
      },
      runAllColumnCaps: () => {
        const s = get()
        const padm = s.result?.atTip.governingPadm_kN
        if (padm == null || !(padm > 0)) {
          set({ calcError: 'Calcule a capacidade da estaca (Padm) antes de dimensionar os blocos.' })
          return
        }
        const diameter_m = s.diameterCm / 100
        const baseLayout = defaultColumnLayout({
          blockRows: s.blockRows,
          blockCols: s.blockCols,
          blockSpacing_m: s.blockSpacing_m,
          blockEdge_m: s.blockEdge_m,
          blockThickness_m: s.blockThickness_m,
          blockEfficiency: s.blockEfficiency,
        })

        const nextColumns: ColumnRecord[] = s.columns.map((col) => {
          if (col.N_kN == null || !(col.N_kN > 0)) {
            return { ...col, capSummary: missingLoadSummary(col.columnLabel || '?') }
          }
          try {
            const out = designColumnCap({
              load: columnToLoad(col),
              padm_kN: padm,
              diameter_m,
              layout: col.layout
                ? defaultColumnLayout({
                    ...baseLayout,
                    ...col.layout,
                    // Sugestão usa η/beiral globais se o pilar ainda não tiver.
                    blockEfficiency: col.layout.blockEfficiency ?? baseLayout.blockEfficiency,
                    blockEdge_m: col.layout.blockEdge_m ?? baseLayout.blockEdge_m,
                    blockThickness_m: col.layout.blockThickness_m ?? baseLayout.blockThickness_m,
                    blockSpacing_m: col.layout.blockSpacing_m ?? baseLayout.blockSpacing_m,
                  })
                : baseLayout,
              autoSuggest: true,
              fck_MPa: s.fck_MPa,
              fyk_MPa: s.fyk_MPa,
              pileTypeId: s.pileTypeId,
              loadIsDesign: s.loadIsDesign,
            })
            return withCapOnColumn(col, out.layout, out.summary)
          } catch (e) {
            return {
              ...col,
              capSummary: {
                ...missingLoadSummary(col.columnLabel || '?'),
                message: e instanceof Error ? e.message : String(e),
              },
            }
          }
        })

        const active = nextColumns.find((c) => c.id === s.activeColumnId) ?? nextColumns[0]!
        const layout = active.layout ?? baseLayout
        set({
          columns: nextColumns,
          activeColumnId: active.id,
          columnLoad: columnToLoad(active),
          designLoad_kN: active.N_kN,
          blockRows: layout.blockRows,
          blockCols: layout.blockCols,
          blockSpacing_m: layout.blockSpacing_m,
          blockEdge_m: layout.blockEdge_m,
          blockThickness_m: layout.blockThickness_m,
          blockEfficiency: layout.blockEfficiency,
          foundationKind:
            s.foundationKind === 'pile' || s.foundationKind === 'pile_cap'
              ? 'pile_cap'
              : s.foundationKind,
          calcError: null,
        })
        const next = get()
        if (next.foundationKind === 'pile_cap' && next.result) {
          next.runBlockDesign()
          next.runGroupDesign()
        } else if (next.foundationKind === 'pile' && next.result) {
          next.runGroupDesign()
        }
      },
      resetBlankProject: () => {
        const blank = createColumn({ columnLabel: 'P01' })
        set({
          step: 'project',
          foundationKind: 'pile_cap',
          projectName: '',
          projectCode: '',
          client: '',
          location: '',
          responsibleEngineer: '',
          engineerCrea: '',
          companyLogoBase64: undefined,
          groundElevation_m: 0,
          pileTopElevation_m: 0,
          pileTypeId: 6,
          pileCategory: 'moldada_in_loco',
          diameterCm: 30,
          tipDepth_m: 4,
          areaCm2: '',
          perimeterCm: '',
          enlargedBaseVolumeLiters: '',
          waterLevel_m: null,
          waterLevelDate: '',
          waterLevelNotes: '',
          layers: [],
          designLoad_kN: null,
          columnLoad: columnToLoad(blank),
          columns: [blank],
          activeColumnId: blank.id,
          ...RECOMMENDED_METHOD_CONFIG,
          fck_MPa: null,
          fyk_MPa: 500,
          cover_mm: 30,
          loadIsDesign: false,
          transverseKind: 'spiral',
          blockRows: 1,
          blockCols: 1,
          blockSpacing_m: null,
          blockEdge_m: 0.25,
          blockThickness_m: 0.5,
          blockEmbedment_m: 0.1,
          blockEfficiency: null,
          blockEfficiencyHint: null,
          foundationSuggestion: null,
          analysisAccepted: false,
          conceptionResult: null,
          result: null,
          structural: null,
          blockResult: null,
          footingResult: null,
          caissonResult: null,
          raftResult: null,
          groupResult: null,
          tipSweepRows: [],
          scenarioId: 'default',
          calcError: null,
          navError: null,
          showTraces: false,
          showStructuralTraces: false,
        })
      },
      hydrateFromPayload: (payload) => {
        get().resetBlankProject()
        const step =
          typeof payload.step === 'string' ? (payload.step as WizardStep) : 'project'
        const {
          step: _s,
          __hasCapacityHint: _h,
          result: _r,
          structural: _st,
          blockResult: _b,
          footingResult: _f,
          caissonResult: _c,
          raftResult: _rf,
          groupResult: _g,
          tipSweepRows: _t,
          ...rest
        } = payload
        set({
          ...(normalizeLegacyMode(rest) as Partial<ProjectState>),
          step,
          result: null,
          structural: null,
          blockResult: null,
          footingResult: null,
          caissonResult: null,
          raftResult: null,
          groupResult: null,
          tipSweepRows: [],
          calcError: null,
          navError: null,
          showTraces: false,
          showStructuralTraces: false,
        })
      },
      resolvePileNk_kN: () => {
        const s = get()
        const padm = s.result?.atTip.governingPadm_kN ?? null
        // DEC-51: com grupo calculado, usa Nmáx na estaca (não a média N/n).
        if (s.groupResult?.maxPileLoad_kN != null && s.groupResult.maxPileLoad_kN > 0) {
          return s.groupResult.maxPileLoad_kN
        }
        if (s.foundationKind === 'pile_cap') {
          const n = Math.max(1, Math.floor(s.blockRows) * Math.floor(s.blockCols))
          if (s.designLoad_kN != null) return s.designLoad_kN / n
          return padm
        }
        return s.designLoad_kN ?? padm
      },
      /** Momento resultante na estaca (kN·m) a partir de Mx/My do pilar ativo. */
      resolvePileMk_kNm: () => {
        const s = get()
        const mx = s.columnLoad.Mx_kNm ?? 0
        const my = s.columnLoad.My_kNm ?? 0
        const m = Math.hypot(mx, my)
        if (m < 1e-9) return 0
        // Em bloco sem modelo de engastamento: rateia M pelo nº de estacas (MVP + aviso no motor).
        if (s.foundationKind === 'pile_cap') {
          const n = Math.max(1, Math.floor(s.blockRows) * Math.floor(s.blockCols))
          return m / n
        }
        return m
      },
      resolvePileVk_kN: () => {
        const s = get()
        const qx = s.columnLoad.Qx_kN ?? 0
        const qy = s.columnLoad.Qy_kN ?? 0
        const v = Math.hypot(qx, qy)
        if (v < 1e-9) return 0
        if (s.foundationKind === 'pile_cap') {
          const n = Math.max(1, Math.floor(s.blockRows) * Math.floor(s.blockCols))
          return v / n
        }
        return v
      },
      applyPileLayout: (rows, cols) => {
        const s = get()
        const r = Math.max(1, Math.floor(rows))
        const c = Math.max(1, Math.floor(cols))
        const kind: FoundationKindUi = 'pile_cap'
        const snap = suggestPileLengthForSpt({
          foundationKind: kind,
          tipDepth_m: s.tipDepth_m,
          blockThickness_m: s.blockThickness_m,
          blockEmbedment_m: s.blockEmbedment_m,
          pileTopElevation_m: s.pileTopElevation_m,
          layers: s.layers,
        })
        set({
          blockRows: r,
          blockCols: c,
          foundationKind: kind,
          tipDepth_m: snap.snapped ? snap.tipDepth_m : s.tipDepth_m,
          navError: null,
        })
      },
      loadReferenceExample: () => {
        const prev = get()
        const named = prev.projectName.trim().length > 0
        set({
          foundationKind: 'pile',
          pileCategory: 'moldada_in_loco',
          // Preserva identidade amigável se o usuário já cadastrou (DEC-50).
          projectName: named ? prev.projectName : 'Exemplo — estaca escavada Ø30 cm',
          projectCode: prev.projectCode.trim() || 'EX-01',
          client: prev.client,
          location: prev.location,
          responsibleEngineer: prev.responsibleEngineer.trim() || 'RT demonstração',
          groundElevation_m: prev.groundElevation_m ?? 0,
          pileTopElevation_m: prev.pileTopElevation_m ?? 0,
          pileTypeId: 6,
          diameterCm: 30,
          tipDepth_m: 8,
          layers: referenceLayers,
          waterLevel_m: null,
          waterLevelDate: '',
          waterLevelNotes: 'Exemplo sem nível d’água no perfil.',
          mode: 'engineering',
          governingRule: 'minimum',
          aokiFs: 2,
          aokiPctTip: 100,
          aokiPctShaft: 100,
          decourtAlphaPct: null,
          decourtBetaPct: null,
          teixeiraFs: 2,
          teixeiraPctTip: 100,
          teixeiraPctShaft: 100,
          designLoad_kN: 150,
          ...(() => {
            const exampleCol = createColumn({
              columnLabel: 'P01',
              N_kN: 150,
              Mx_kNm: 0,
              My_kNm: 0,
              Qx_kN: 0,
              Qy_kN: 0,
              T_kNm: 0,
              columnWidth_m: 0.3,
              columnDepth_m: 0.5,
            })
            return {
              columnLoad: columnToLoad(exampleCol),
              columns: [exampleCol],
              activeColumnId: exampleCol.id,
            }
          })(),
          loadIsDesign: false,
          result: null,
          structural: null,
          blockResult: null,
          footingResult: null,
          caissonResult: null,
          raftResult: null,
          groupResult: null,
          tipSweepRows: [],
          calcError: null,
          navError: null,
          scenarioId: 'reference-example',
          blockRows: 1,
          blockCols: 1,
          // Exemplo de validação: estaca isolada é escolha explícita; abrir a Análise
          // não pode trocar o tipo nem apagar o cálculo (DEC-61).
          foundationSuggestion: null,
          analysisAccepted: true,
          conceptionResult: null,
        })
        // Calcula automaticamente o exemplo e abre Capacidade.
        get().runCalculation()
      },
      runCalculation: (opts) => {
        const s = get()
        const gate = canRunCalculation(s.toGateInput())
        if (!gate.ok) {
          set({ calcError: gate.reason ?? 'Dados insuficientes para calcular.', navError: gate.reason ?? null })
          return
        }
        if (s.foundationKind === 'footing') {
          get().runFootingDesign(opts)
          return
        }
        if (s.foundationKind === 'caisson') {
          get().runCaissonDesign(opts)
          return
        }
        if (s.foundationKind === 'raft') {
          get().runRaftDesign(opts)
          return
        }
        const pile = PILE_TYPES.find((p) => p.id === s.pileTypeId)
        try {
          const datum = resolvePileDatum({
            foundationKind: s.foundationKind,
            tipDepth_m: s.tipDepth_m,
            blockThickness_m: s.blockThickness_m,
            blockEmbedment_m: s.blockEmbedment_m,
            pileTopElevation_m: s.pileTopElevation_m,
          })
          const input = flatStoreToGeotechnicalInput(
            {
              pileTypeId: s.pileTypeId,
              diameterCm: s.diameterCm,
              tipDepth_m: s.tipDepth_m,
              pileTopDepth_m: datum.pileTopDepth_m,
              areaCm2: pile?.requiresManualArea ? s.areaCm2 : null,
              perimeterCm: pile?.requiresManualArea ? s.perimeterCm : null,
              enlargedBaseVolumeLiters: pile?.requiresEnlargedBase
                ? s.enlargedBaseVolumeLiters
                : null,
              waterLevel_m: s.waterLevel_m,
              layers: s.layers,
              designLoad_kN: s.foundationKind === 'pile_cap' ? null : s.designLoad_kN,
            },
            {
              mode: s.mode,
              governingRule: s.governingRule,
              selectedMethod:
                s.governingRule === 'user_selected' ? s.selectedMethod : undefined,
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
              pileTopDepth_m: datum.pileTopDepth_m,
            },
          )
          const result = calculate(input)
          set({
            result,
            structural: null,
            footingResult: null,
            caissonResult: null,
            raftResult: null,
            calcError: null,
            showTraces: false,
            ...(opts?.preserveStep ? {} : { step: 'results' as const }),
          })
          // Arranjo automático: se N > Padm, sobe para 2–3+ estacas (bloco).
          if (!opts?.skipArrangement) {
            get().runGroupDesign()
          } else if (s.foundationKind === 'pile_cap') {
            get().runBlockDesign()
          } else {
            set({ blockResult: null })
          }
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
            result: null,
            blockResult: null,
          })
        }
      },
      runFootingDesign: (opts) => {
        const s = get()
        if (s.foundationKind !== 'footing') {
          set({ footingResult: null })
          return
        }
        if (s.designLoad_kN == null || !(s.designLoad_kN > 0)) {
          set({
            calcError: 'Informe a carga vertical (kN) na etapa Cargas antes de dimensionar a sapata.',
            footingResult: null,
          })
          return
        }
        try {
          const footingResult = designFooting({
            Nk_kN: s.designLoad_kN,
            loadIsDesign: s.loadIsDesign,
            Mx_kNm: s.footingMx_kNm ?? undefined,
            My_kNm: s.footingMy_kNm ?? undefined,
            shape: s.footingShape,
            aspectRatio: s.footingAspect,
            admMode: s.footingAdmMode,
            sigmaAdm_kPa: s.footingAdmMode === 'user' ? s.footingSigmaAdm_kPa : null,
            soil:
              s.footingAdmMode === 'bearing'
                ? {
                    c_kPa: s.footingC_kPa,
                    phi_deg: s.footingPhi_deg,
                    gamma_kN_m3: s.footingGamma_kN_m3,
                    embedment_m: s.footingDf_m,
                    fsBearing: s.footingFs,
                  }
                : null,
            thickness_m: s.footingThickness_m,
            gammaConcrete_kN_m3: 25,
            fck_MPa: s.fck_MPa ?? undefined,
            fyk_MPa: s.fyk_MPa,
            columnWidth_m: s.columnLoad?.columnWidth_m ?? null,
            columnDepth_m: s.columnLoad?.columnDepth_m ?? null,
          })
          set({
            footingResult,
            result: null,
            blockResult: null,
            structural: null,
            caissonResult: null,
            raftResult: null,
            calcError: null,
            showTraces: false,
            ...(opts?.preserveStep ? {} : { step: 'results' as const }),
          })
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
            footingResult: null,
          })
        }
      },
      runCaissonDesign: (opts) => {
        const s = get()
        if (s.foundationKind !== 'caisson') {
          set({ caissonResult: null })
          return
        }
        if (s.designLoad_kN == null || !(s.designLoad_kN > 0)) {
          set({
            calcError:
              'Informe a carga vertical (kN) na etapa Cargas antes de dimensionar o tubulão.',
            caissonResult: null,
          })
          return
        }
        try {
          const caissonResult = designCaisson({
            Nk_kN: s.designLoad_kN,
            loadIsDesign: s.loadIsDesign,
            shaftDiameter_m: s.caissonShaftDia_m,
            baseDiameter_m: s.caissonBaseDia_m,
            length_m: s.caissonLength_m,
            admMode: s.caissonAdmMode,
            sigmaAdm_kPa: s.caissonAdmMode === 'user' ? s.caissonSigmaAdm_kPa : null,
            soil:
              s.caissonAdmMode === 'bearing'
                ? {
                    c_kPa: s.caissonC_kPa,
                    phi_deg: s.caissonPhi_deg,
                    gamma_kN_m3: s.caissonGamma_kN_m3,
                    fsTip: s.caissonFsTip,
                  }
                : null,
            shaftMode: s.caissonShaftMode,
            unitFriction_kPa: s.caissonUnitFriction_kPa,
            shaftFS: s.caissonShaftFS,
            fck_MPa: s.fck_MPa ?? undefined,
            sptLayers:
              s.caissonShaftMode === 'spt_aoki'
                ? s.layers.map((l) => ({
                    depth_m: l.depth_m,
                    nspt: l.nspt,
                    soilTypeId: l.soilTypeId,
                  }))
                : null,
          })
          set({
            caissonResult,
            result: null,
            blockResult: null,
            footingResult: null,
            raftResult: null,
            structural: null,
            calcError: null,
            showTraces: false,
            ...(opts?.preserveStep ? {} : { step: 'results' as const }),
          })
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
            caissonResult: null,
          })
        }
      },
      runRaftDesign: (opts) => {
        const s = get()
        if (s.foundationKind !== 'raft') {
          set({ raftResult: null })
          return
        }
        if (s.designLoad_kN == null || !(s.designLoad_kN > 0)) {
          set({
            calcError:
              'Informe a carga vertical (kN) na etapa Cargas antes de dimensionar o radier.',
            raftResult: null,
          })
          return
        }
        try {
          const raftResult = designRaft({
            Nk_kN: s.designLoad_kN,
            loadIsDesign: s.loadIsDesign,
            Mx_kNm: s.raftMx_kNm ?? undefined,
            My_kNm: s.raftMy_kNm ?? undefined,
            aspectRatio: s.raftAspect,
            admMode: s.raftAdmMode,
            sigmaAdm_kPa: s.raftAdmMode === 'user' ? s.raftSigmaAdm_kPa : null,
            soil:
              s.raftAdmMode === 'bearing'
                ? {
                    c_kPa: s.raftC_kPa,
                    phi_deg: s.raftPhi_deg,
                    gamma_kN_m3: s.raftGamma_kN_m3,
                    embedment_m: s.raftDf_m,
                    fsBearing: s.raftFs,
                  }
                : null,
            thickness_m: s.raftThickness_m,
            gammaConcrete_kN_m3: 25,
            fck_MPa: s.fck_MPa ?? undefined,
          })
          set({
            raftResult,
            result: null,
            blockResult: null,
            footingResult: null,
            caissonResult: null,
            structural: null,
            calcError: null,
            showTraces: false,
            ...(opts?.preserveStep ? {} : { step: 'results' as const }),
          })
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
            raftResult: null,
          })
        }
      },
      runBlockDesign: () => {
        const s = get()
        if (s.foundationKind !== 'pile_cap') {
          set({ blockResult: null })
          return
        }
        try {
          const blockResult = designPileCap({
            rows: s.blockRows,
            cols: s.blockCols,
            spacing_m: s.blockSpacing_m,
            diameter_m: s.diameterCm / 100,
            edge_m: s.blockEdge_m,
            thickness_m: s.blockThickness_m,
            singlePadm_kN: s.result?.atTip.governingPadm_kN ?? null,
            groupLoad_kN: s.designLoad_kN,
            Mx_kNm: s.columnLoad?.Mx_kNm ?? 0,
            My_kNm: s.columnLoad?.My_kNm ?? 0,
            loadIsDesign: s.loadIsDesign,
            columnWidth_m: s.columnLoad?.columnWidth_m ?? null,
            columnDepth_m: s.columnLoad?.columnDepth_m ?? null,
            pileTypeId: s.pileTypeId,
            efficiency: s.blockEfficiency,
            fck_MPa: s.fck_MPa ?? undefined,
            fyk_MPa: s.fyk_MPa,
          })
          const spacing =
            s.blockSpacing_m != null && s.blockSpacing_m > 0
              ? s.blockSpacing_m
              : defaultSpacing_m(s.diameterCm / 100, minSpacingFactorForPileType(s.pileTypeId))
          let hint: number | null = null
          try {
            hint = suggestEfficiencyConverseLabarre({
              rows: s.blockRows,
              cols: s.blockCols,
              diameter_m: s.diameterCm / 100,
              spacing_m: spacing,
            }).eta
          } catch {
            hint = null
          }
          set({ blockResult, blockEfficiencyHint: hint, calcError: null })
          const after = get()
          const layout = defaultColumnLayout({
            blockRows: after.blockRows,
            blockCols: after.blockCols,
            blockSpacing_m: after.blockSpacing_m,
            blockEdge_m: after.blockEdge_m,
            blockThickness_m: after.blockThickness_m,
            blockEfficiency: after.blockEfficiency,
          })
          set({
            columns: upsertColumn(after.columns, after.activeColumnId, {
              layout,
              capSummary: summarizeCap(after.groupResult, blockResult),
            }),
          })
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
            blockResult: null,
          })
        }
      },
      applyConverseLabarreEfficiency: () => {
        const s = get()
        const spacing =
          s.blockSpacing_m != null && s.blockSpacing_m > 0
            ? s.blockSpacing_m
            : defaultSpacing_m(s.diameterCm / 100, minSpacingFactorForPileType(s.pileTypeId))
        try {
          const { eta } = suggestEfficiencyConverseLabarre({
            rows: s.blockRows,
            cols: s.blockCols,
            diameter_m: s.diameterCm / 100,
            spacing_m: spacing,
          })
          get().patch({ blockEfficiency: Number(eta.toFixed(3)) })
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
          })
        }
      },
      runTipSweep: (from_m, to_m, step_m) => {
        const s = get()
        const gate = canRunCalculation(s.toGateInput())
        if (!gate.ok) {
          set({ calcError: gate.reason ?? 'Dados insuficientes.' })
          return
        }
        const pile = PILE_TYPES.find((p) => p.id === s.pileTypeId)
        const datum = resolvePileDatum({
          foundationKind: s.foundationKind,
          tipDepth_m: s.tipDepth_m,
          blockThickness_m: s.blockThickness_m,
          blockEmbedment_m: s.blockEmbedment_m,
          pileTopElevation_m: s.pileTopElevation_m,
        })
        const rows: TipSweepRow[] = []
        const start = Math.min(from_m, to_m)
        const end = Math.max(from_m, to_m)
        const step = Math.max(0.01, step_m)
        try {
          // Candidatas = camadas SPT cuja cota implica L = d − pileTopDepth no intervalo
          const candidates = s.layers
            .map((l) => l.depth_m)
            .filter((d) => {
              const L = d - datum.pileTopDepth_m
              if (L < 1 - 1e-9) return false
              if (d < start - 1e-9 || d > end + 1e-9) return false
              // Filtra por grade aproximada do incremento (ainda exige camada SPT)
              const k = Math.round((d - start) / step)
              return Math.abs(d - (start + k * step)) <= Math.max(1e-6, step * 0.51)
            })
            .sort((a, b) => a - b)

          const seen = new Set<number>()
          for (const sptTip of candidates) {
            const L = Math.round((sptTip - datum.pileTopDepth_m) * 1e6) / 1e6
            if (seen.has(L)) continue
            seen.add(L)
            const input = flatStoreToGeotechnicalInput(
              {
                pileTypeId: s.pileTypeId,
                diameterCm: s.diameterCm,
                tipDepth_m: L,
                pileTopDepth_m: datum.pileTopDepth_m,
                areaCm2: pile?.requiresManualArea ? s.areaCm2 : null,
                perimeterCm: pile?.requiresManualArea ? s.perimeterCm : null,
                enlargedBaseVolumeLiters: pile?.requiresEnlargedBase
                  ? s.enlargedBaseVolumeLiters
                  : null,
                waterLevel_m: s.waterLevel_m,
                layers: s.layers,
                designLoad_kN: s.designLoad_kN,
              },
              {
                mode: s.mode,
                governingRule: s.governingRule,
                selectedMethod:
                  s.governingRule === 'user_selected' ? s.selectedMethod : undefined,
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
                pileTopDepth_m: datum.pileTopDepth_m,
              },
            )
            const r = calculate(input)
            rows.push({
              tipDepth_m: L,
              padmAverage_kN: r.atTip.averagePadm_kN,
              padmMinimum_kN: r.atTip.minimumPadm_kN,
              padmGoverning_kN: r.atTip.governingPadm_kN,
            })
          }
          set({ tipSweepRows: rows, calcError: null })
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
            tipSweepRows: [],
          })
        }
      },
      runGroupDesign: () => {
        const s = get()
        const N = s.columnLoad.N_kN ?? s.designLoad_kN
        const Mx = s.columnLoad.Mx_kNm ?? 0
        const My = s.columnLoad.My_kNm ?? 0
        if (N == null || !(N > 0) || s.result == null) {
          set({
            groupResult: null,
            ...(N == null || !(N > 0)
              ? {}
              : { calcError: 'Calcule a capacidade antes do grupo.' }),
          })
          return
        }
        try {
          const diameter_m = s.diameterCm / 100
          const spacing =
            s.blockSpacing_m != null && s.blockSpacing_m > 0
              ? s.blockSpacing_m
              : defaultSpacing_m(diameter_m, minSpacingFactorForPileType(s.pileTypeId))
          const padm = s.result.atTip.governingPadm_kN

          // Sempre recalcula o menor arranjo que atende N (e Mx/My) — automático.
          let suggested = suggestPileGroupLayout({
            N_kN: N,
            Mx_kNm: Mx,
            My_kNm: My,
            singlePadm_kN: padm,
            diameter_m,
            spacing_m: spacing,
            efficiency: s.blockEfficiency,
          })

          let rows = suggested.rows
          let cols = suggested.cols
          // "Estaca isolada" é estudo de capacidade: fica assim enquanto 1 estaca basta.
          // Se a carga pede grupo, vira bloco de coroamento (pilar nunca apoia direto no fuste).
          let kind: 'pile' | 'pile_cap' =
            s.foundationKind === 'pile' && rows * cols === 1 ? 'pile' : 'pile_cap'
          const tipBefore = s.tipDepth_m
          const snap = suggestPileLengthForSpt({
            foundationKind: kind,
            tipDepth_m: s.tipDepth_m,
            blockThickness_m: s.blockThickness_m,
            blockEmbedment_m: s.blockEmbedment_m,
            pileTopElevation_m: s.pileTopElevation_m,
            layers: s.layers,
          })
          const tipDepth_m = snap.snapped ? snap.tipDepth_m : s.tipDepth_m

          set({
            blockRows: rows,
            blockCols: cols,
            foundationKind: kind,
            tipDepth_m,
            navError: null,
            calcError: null,
          })

          // Se a ponta mudou (pile ↔ pile_cap / DEC-57), recalcula Padm e re-sugere n.
          if (tipDepth_m !== tipBefore || (kind === 'pile_cap' && s.foundationKind === 'pile')) {
            get().runCalculation({ preserveStep: true, skipArrangement: true })
            const mid = get()
            if (mid.result == null) return
            suggested = suggestPileGroupLayout({
              N_kN: N,
              Mx_kNm: Mx,
              My_kNm: My,
              singlePadm_kN: mid.result.atTip.governingPadm_kN,
              diameter_m,
              spacing_m: spacing,
              efficiency: mid.blockEfficiency,
            })
            rows = suggested.rows
            cols = suggested.cols
            if (rows * cols > 1) kind = 'pile_cap'
            set({
              blockRows: rows,
              blockCols: cols,
              foundationKind: kind,
            })
          }

          const after = get()
          if (after.result == null) return

          const groupResult = designPileGroup({
            rows,
            cols,
            spacing_m: spacing,
            diameter_m,
            N_kN: N,
            Mx_kNm: Mx,
            My_kNm: My,
            singlePadm_kN: after.result.atTip.governingPadm_kN,
            efficiency: after.blockEfficiency,
          })

          set({
            groupResult,
            blockRows: groupResult.rows,
            blockCols: groupResult.cols,
            calcError: null,
          })

          if (kind === 'pile_cap') {
            get().runBlockDesign()
          } else {
            const cur = get()
            set({
              blockResult: null,
              columns: upsertColumn(cur.columns, cur.activeColumnId, {
                layout: defaultColumnLayout({
                  blockRows: cur.blockRows,
                  blockCols: cur.blockCols,
                  blockSpacing_m: cur.blockSpacing_m,
                  blockEdge_m: cur.blockEdge_m,
                  blockThickness_m: cur.blockThickness_m,
                  blockEfficiency: cur.blockEfficiency,
                }),
                capSummary: summarizeCap(groupResult, null),
              }),
            })
          }
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
            groupResult: null,
          })
        }
      },
      runStructural: (opts) => {
        const s = get()
        const Nk = s.resolvePileNk_kN()
        if (Nk == null) {
          set({
            calcError: 'Informe a carga de projeto ou calcule a geotécnica antes da armadura.',
            structural: null,
          })
          return
        }
        try {
          const Mk = s.resolvePileMk_kNm()
          const Vk = s.resolvePileVk_kN()
          const structural = designPileReinforcement({
            pileTypeId: s.pileTypeId,
            diameter_m: s.diameterCm / 100,
            tipDepth_m: s.tipDepth_m,
            Nk_kN: Nk,
            loadIsDesign: s.loadIsDesign,
            fck_MPa: s.fck_MPa ?? undefined,
            fyk_MPa: s.fyk_MPa,
            cover_mm: s.cover_mm,
            transverseKind: s.transverseKind,
            Mk_kNm: Mk > 0 ? Mk : undefined,
            Vk_kN: Vk > 0 ? Vk : undefined,
          })
          set({
            structural,
            calcError: null,
            showStructuralTraces: false,
            ...(opts?.preserveStep ? {} : { step: 'rebar' as const }),
          })
        } catch (e) {
          set({
            calcError: e instanceof Error ? e.message : String(e),
            structural: null,
          })
        }
      },
      /**
       * Roda o que falta para o caderno de pranchas sair completo (DEC-58).
       * Antes, quem pulasse "Bloco"/"Armadura" imprimia um caderno sem bloco e
       * sem estaca; aqui os motores são acionados sem trocar a etapa atual.
       */
      prepareDrawings: () => {
        const s = get()
        const isPile = s.foundationKind === 'pile' || s.foundationKind === 'pile_cap'
        if (!isPile) return

        if (s.result == null) {
          get().runCalculation({ preserveStep: true })
          if (get().result == null) return
        }

        // Com pilares e carga no modo produto: garante bloco (não deixa pile sem coroamento).
        const hasColumnLoads = s.columns.some((c) => c.N_kN != null && c.N_kN > 0)
        if (hasColumnLoads) {
          set({ foundationKind: 'pile_cap' })
          get().runAllColumnCaps()
        } else if (get().foundationKind === 'pile_cap' && get().blockResult == null) {
          get().runBlockDesign()
        }

        if (get().structural?.takeoff == null) {
          get().runStructural({ preserveStep: true })
        }
      },
    }),
    {
      name: 'starkx-project-v2',
      version: 8,
      migrate: (persisted, version) => {
        const p = normalizeLegacyMode(persisted as Record<string, unknown>)
        if (version < 3) {
          if (p.caissonUnitFriction_kPa == null && p.caissonFsShaft_kPa != null) {
            p.caissonUnitFriction_kPa = p.caissonFsShaft_kPa
          }
          if (p.caissonShaftFS == null && p.caissonFsShaft != null) {
            p.caissonShaftFS = p.caissonFsShaft
          }
        }
        if (version < 4) {
          if (p.teixeiraPctTip == null) p.teixeiraPctTip = 100
          if (p.teixeiraPctShaft == null) p.teixeiraPctShaft = 100
        }
        if (version < 5) {
          const designLoad =
            typeof p.designLoad_kN === 'number' ? (p.designLoad_kN as number) : null
          if (p.columnLoad == null || typeof p.columnLoad !== 'object') {
            p.columnLoad = {
              N_kN: designLoad,
              Mx_kNm: null,
              My_kNm: null,
              Qx_kN: null,
              Qy_kN: null,
              T_kNm: null,
              columnWidth_m: 0.3,
              columnDepth_m: 0.5,
              columnLabel: 'P01',
            }
          }
        }
        if (version < 6) {
          const load =
            p.columnLoad != null && typeof p.columnLoad === 'object'
              ? (p.columnLoad as ColumnLoadInput)
              : emptyColumnLoad()
          const migrated = ensureColumnsFromLegacy(
            load,
            p.columns as ColumnRecord[] | undefined,
            p.activeColumnId as string | undefined,
          )
          p.columns = migrated.columns
          p.activeColumnId = migrated.activeColumnId
          const active = migrated.columns.find((c) => c.id === migrated.activeColumnId)
          if (active) p.columnLoad = columnToLoad(active)
        }
        if (version < 7) {
          if (p.blockEmbedment_m == null) p.blockEmbedment_m = 0.1
          if (p.analysisAccepted == null) p.analysisAccepted = false
          if (p.foundationSuggestion === undefined) p.foundationSuggestion = null
        }
        return p as typeof persisted
      },
      partialize: (s) => ({
        theme: s.theme,
        foundationKind: s.foundationKind,
        projectName: s.projectName,
        projectCode: s.projectCode,
        client: s.client,
        location: s.location,
        responsibleEngineer: s.responsibleEngineer,
        engineerCrea: s.engineerCrea,
        companyLogoBase64: s.companyLogoBase64,
        groundElevation_m: s.groundElevation_m,
        pileTopElevation_m: s.pileTopElevation_m,
        pileTypeId: s.pileTypeId,
        diameterCm: s.diameterCm,
        tipDepth_m: s.tipDepth_m,
        areaCm2: s.areaCm2,
        perimeterCm: s.perimeterCm,
        enlargedBaseVolumeLiters: s.enlargedBaseVolumeLiters,
        waterLevel_m: s.waterLevel_m,
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
        analysisAccepted: s.analysisAccepted,
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
      }),
    },
  ),
)

export const STEPS: { id: WizardStep; label: string }[] = flowForKind('pile_cap').map((s) => ({
  id: s.id,
  label: s.label,
}))

export function visibleSteps(kind: FoundationKindUi): { id: WizardStep; label: string }[] {
  return flowForKind(kind).map((s) => ({ id: s.id, label: s.label }))
}
