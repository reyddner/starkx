import type { FoundationKindUi, LayerRow, WizardStep } from './wizardTypes'
import { hasSptAtTipDepth, resolvePileDatum } from '@domain/pileDatum'

export type { FoundationKindUi, LayerRow, WizardStep } from './wizardTypes'
export type StepGateStatus = 'done' | 'current' | 'available' | 'blocked'
export { resolvePileDatum, hasSptAtTipDepth } from '@domain/pileDatum'

export interface WizardStepDef {
  id: WizardStep
  label: string
}

/**
 * Prefixo DEC-54/DEC-58: dados → sondagem (com NA) → cargas → análise.
 * O NA deixou de ser etapa própria e passou a ser campo da Sondagem;
 * `groundwater` continua existindo como destino válido para links antigos.
 */
const SHARED_PREFIX: WizardStepDef[] = [
  { id: 'project', label: 'Dados da obra' },
  { id: 'borehole', label: "Sondagem e nível d'água" },
  { id: 'loads', label: 'Cargas / pilares' },
  { id: 'analysis', label: 'Análise' },
]

/**
 * DEC-58: "Fundação" concentra confirmação do tipo + geometria do elemento.
 * Métodos geotécnicos saíram do caminho principal (ajuste avançado em Capacidade).
 */
const FOUNDATION_STEP: WizardStepDef = { id: 'foundation', label: 'Fundação e geometria' }

/** Ordem canônica DEC-58 — estaca isolada (cota/grupo/armadura ficam no avançado). */
export const PILE_FLOW: WizardStepDef[] = [
  ...SHARED_PREFIX,
  FOUNDATION_STEP,
  { id: 'results', label: 'Capacidade' },
  { id: 'drawings', label: 'Desenhos' },
  { id: 'memorial', label: 'Memorial' },
]

/** Bloco sobre estacas: após capacidade, revisa o bloco e vai aos desenhos. */
export const PILE_CAP_FLOW: WizardStepDef[] = [
  ...SHARED_PREFIX,
  FOUNDATION_STEP,
  { id: 'results', label: 'Capacidade' },
  { id: 'block', label: 'Bloco' },
  { id: 'drawings', label: 'Desenhos' },
  { id: 'memorial', label: 'Memorial' },
]

function shallowFlow(_kind: 'footing' | 'caisson' | 'raft'): WizardStepDef[] {
  return [
    ...SHARED_PREFIX,
    FOUNDATION_STEP,
    { id: 'results', label: 'Capacidade' },
    { id: 'drawings', label: 'Desenhos' },
    { id: 'memorial', label: 'Memorial' },
  ]
}

/**
 * Etapas que existem como destino (deep link, "alterar métodos") mas não
 * aparecem no caminho principal — a navegação Voltar/Continuar as ignora.
 */
const OFF_FLOW_STEPS: readonly WizardStep[] = [
  'groundwater',
  'pile',
  'methods',
  'footing',
  'caisson',
  'raft',
  'tip_sweep',
  'group',
  'rebar',
]

export function isOffFlowStep(step: WizardStep): boolean {
  return OFF_FLOW_STEPS.includes(step)
}

/** Uma etapa fora do fluxo só faz sentido para os tipos de fundação a que serve. */
function offFlowMatchesKind(kind: FoundationKindUi, step: WizardStep): boolean {
  switch (step) {
    case 'pile':
    case 'methods':
    case 'tip_sweep':
    case 'rebar':
      return kind === 'pile' || kind === 'pile_cap'
    case 'group':
      return kind === 'pile' || kind === 'pile_cap'
    case 'footing':
      return kind === 'footing'
    case 'caisson':
      return kind === 'caisson'
    case 'raft':
      return kind === 'raft'
    default:
      return true
  }
}

export function flowForKind(kind: FoundationKindUi): WizardStepDef[] {
  if (kind === 'pile_cap') return PILE_CAP_FLOW
  if (kind === 'footing' || kind === 'caisson' || kind === 'raft') return shallowFlow(kind)
  return PILE_FLOW
}

/** Snapshot mínimo para avaliar gates (evita circularidade com o store completo). */
export interface FlowGateInput {
  step: WizardStep
  foundationKind: FoundationKindUi
  projectName: string
  layers: LayerRow[]
  waterLevel_m: number | null
  pileTypeId: number
  diameterCm: number
  /** Comprimento L da estaca a partir do topo (m). */
  tipDepth_m: number
  blockThickness_m: number
  blockEmbedment_m: number
  pileTopElevation_m: number | null
  mode?: 'engineering'
  governingRule?: 'minimum' | 'average' | 'user_selected'
  designLoad_kN: number | null
  /** Pelo menos um pilar com N > 0 (DEC-54). */
  hasColumnLoad: boolean
  analysisAccepted: boolean
  result: unknown | null
  structural: unknown | null
  blockResult: unknown | null
  footingResult: unknown | null
  caissonResult: unknown | null
  raftResult: unknown | null
  blockRows: number
  blockCols: number
}

export function hasBorehole(s: FlowGateInput): boolean {
  return s.layers.length >= 1 && s.layers.every((l) => l.depth_m > 0 && l.nspt >= 0)
}

export function hasPileGeometry(s: FlowGateInput): boolean {
  return s.pileTypeId > 0 && s.diameterCm > 0 && s.tipDepth_m >= 1
}

export function hasCapacity(s: FlowGateInput): boolean {
  if (s.foundationKind === 'footing') return s.footingResult != null
  if (s.foundationKind === 'caisson') return s.caissonResult != null
  if (s.foundationKind === 'raft') return s.raftResult != null
  return s.result != null
}

export function hasLoads(s: FlowGateInput): boolean {
  return s.hasColumnLoad || (s.designLoad_kN != null && s.designLoad_kN > 0)
}

export function canEnterStep(s: FlowGateInput, target: WizardStep): { ok: boolean; reason?: string } {
  const flow = flowForKind(s.foundationKind)
  if (!flow.some((x) => x.id === target)) {
    // Etapas fora do caminho principal (geometria específica, ajuste de métodos)
    // continuam acessíveis, desde que combinem com o tipo de fundação escolhido.
    if (!isOffFlowStep(target) || !offFlowMatchesKind(s.foundationKind, target)) {
      return { ok: false, reason: 'Etapa não disponível para este tipo de fundação.' }
    }
  }

  switch (target) {
    case 'project':
    case 'borehole':
      return { ok: true }
    case 'groundwater':
      if (!hasBorehole(s)) return { ok: false, reason: 'Cadastre a sondagem (camadas SPT) antes do NA.' }
      return { ok: true }
    case 'loads':
      if (!hasBorehole(s)) return { ok: false, reason: 'Cadastre a sondagem antes das cargas.' }
      return { ok: true }
    case 'analysis':
      if (!hasBorehole(s)) return { ok: false, reason: 'Sondagem obrigatória para a análise.' }
      if (!hasLoads(s)) return { ok: false, reason: 'Informe N (kN) de ao menos um pilar antes da análise.' }
      return { ok: true }
    case 'foundation':
      if (!hasBorehole(s)) return { ok: false, reason: 'Cadastre a sondagem antes de confirmar a fundação.' }
      if (!hasLoads(s)) return { ok: false, reason: 'Informe as cargas antes de confirmar a fundação.' }
      return { ok: true }
    case 'pile':
    case 'footing':
    case 'caisson':
    case 'raft':
      if (!hasBorehole(s)) return { ok: false, reason: 'Cadastre a sondagem antes da geometria.' }
      if (!hasLoads(s)) return { ok: false, reason: 'Informe as cargas antes da geometria.' }
      return { ok: true }
    case 'methods':
      if (!hasBorehole(s) || !hasPileGeometry(s)) {
        return { ok: false, reason: 'Defina sondagem e geometria da estaca antes dos métodos.' }
      }
      return { ok: true }
    case 'results':
      if (s.foundationKind === 'pile' || s.foundationKind === 'pile_cap') {
        if (!hasBorehole(s) || !hasPileGeometry(s)) {
          return { ok: false, reason: 'Sondagem + geometria obrigatórias para calcular capacidade.' }
        }
      } else if (!hasLoads(s)) {
        return { ok: false, reason: 'Informe a carga antes de dimensionar fundação rasa.' }
      }
      return { ok: true }
    case 'tip_sweep':
      if (!hasCapacity(s)) {
        return { ok: false, reason: 'Calcule a capacidade antes de estudar cotas alternativas.' }
      }
      return { ok: true }
    case 'group':
      if (!hasCapacity(s) || !hasLoads(s)) {
        return { ok: false, reason: 'Capacidade e cargas do pilar são pré-requisitos do grupo.' }
      }
      return { ok: true }
    case 'block':
      if (!hasCapacity(s) || !hasLoads(s)) {
        return { ok: false, reason: 'Capacidade e cargas necessárias para o bloco.' }
      }
      return { ok: true }
    case 'rebar':
      if (!hasCapacity(s)) return { ok: false, reason: 'Calcule a capacidade antes da armadura.' }
      return { ok: true }
    case 'drawings':
      if (!hasCapacity(s)) return { ok: false, reason: 'Há capacidade calculada? Desenhos vêm depois do cálculo.' }
      return { ok: true }
    case 'memorial':
      if (!hasCapacity(s)) return { ok: false, reason: 'Execute o cálculo antes do memorial.' }
      return { ok: true }
    default:
      return { ok: true }
  }
}

export function canRunCalculation(s: FlowGateInput): { ok: boolean; reason?: string } {
  if (s.foundationKind === 'footing' || s.foundationKind === 'caisson' || s.foundationKind === 'raft') {
    if (!hasLoads(s)) return { ok: false, reason: 'Informe a carga vertical (kN).' }
    return { ok: true }
  }
  if (!hasBorehole(s)) return { ok: false, reason: 'Cadastre camadas SPT.' }
  if (!hasPileGeometry(s)) {
    return { ok: false, reason: 'Defina tipo, diâmetro e comprimento da estaca (L).' }
  }
  const datum = resolvePileDatum({
    foundationKind: s.foundationKind,
    tipDepth_m: s.tipDepth_m,
    blockThickness_m: s.blockThickness_m,
    blockEmbedment_m: s.blockEmbedment_m,
    pileTopElevation_m: s.pileTopElevation_m,
  })
  if (!hasSptAtTipDepth(s.layers, datum.sptTipDepth_m)) {
    const tipLabel = datum.sptTipDepth_m.toFixed(2)
    return {
      ok: false,
      reason:
        datum.pileTopDepth_m > 0
          ? `Falta camada SPT na profundidade da ponta (${tipLabel} m). Ajuste o comprimento L ou complete a sondagem até essa cota.`
          : `Falta camada SPT na profundidade da ponta (${tipLabel} m). Ajuste L ou complete a sondagem.`,
    }
  }
  return { ok: true }
}

export function stepCompletion(s: FlowGateInput, id: WizardStep): boolean {
  switch (id) {
    case 'project':
      return s.projectName.trim().length > 0
    case 'borehole':
      return hasBorehole(s)
    case 'groundwater':
      return s.waterLevel_m != null
    case 'loads':
      return hasLoads(s)
    case 'analysis':
      return s.analysisAccepted
    case 'foundation':
      // A etapa unificada só está concluída quando a geometria do elemento existe.
      if (s.foundationKind === 'pile' || s.foundationKind === 'pile_cap') return hasPileGeometry(s)
      return hasLoads(s)
    case 'pile':
      return hasPileGeometry(s)
    case 'methods':
      return hasPileGeometry(s)
    case 'results':
      return hasCapacity(s)
    case 'tip_sweep':
      return hasCapacity(s)
    case 'group':
      return hasLoads(s) && hasCapacity(s) && s.blockRows * s.blockCols >= 1
    case 'block':
      return s.blockResult != null
    case 'footing':
      return s.footingResult != null
    case 'caisson':
      return s.caissonResult != null
    case 'raft':
      return s.raftResult != null
    case 'rebar':
      return s.structural != null
    case 'drawings':
      return hasCapacity(s)
    case 'memorial':
      return hasCapacity(s)
    default:
      return false
  }
}

export function progressChecklist(s: FlowGateInput): {
  id: WizardStep
  label: string
  status: StepGateStatus
  done: boolean
  blocked: boolean
  reason?: string
}[] {
  const flow = flowForKind(s.foundationKind)
  return flow.map((def) => {
    const gate = canEnterStep(s, def.id)
    const done = stepCompletion(s, def.id)
    const isCurrent = s.step === def.id
    let status: StepGateStatus = 'available'
    if (!gate.ok) status = 'blocked'
    else if (isCurrent) status = 'current'
    else if (done) status = 'done'
    return {
      id: def.id,
      label: def.label,
      status,
      done,
      blocked: !gate.ok,
      reason: gate.reason,
    }
  })
}

/** Etapa do caminho principal à qual uma etapa fora do fluxo pertence. */
export function flowAnchorFor(step: WizardStep): WizardStep {
  switch (step) {
    case 'groundwater':
      return 'borehole'
    case 'pile':
    case 'footing':
    case 'caisson':
    case 'raft':
    case 'methods':
      return 'foundation'
    case 'tip_sweep':
    case 'group':
      return 'results'
    case 'rebar':
      return 'drawings'
    default:
      return step
  }
}

export function nextStepId(s: FlowGateInput): WizardStep | null {
  const flow = flowForKind(s.foundationKind)
  if (isOffFlowStep(s.step)) {
    switch (s.step) {
      case 'groundwater':
        return 'loads'
      case 'pile':
      case 'methods':
      case 'footing':
      case 'caisson':
      case 'raft':
        return 'results'
      case 'tip_sweep':
      case 'group':
        return s.foundationKind === 'pile_cap' ? 'block' : 'drawings'
      case 'rebar':
        return 'drawings'
      default:
        return flowAnchorFor(s.step)
    }
  }
  const i = flow.findIndex((x) => x.id === s.step)
  if (i < 0 || i >= flow.length - 1) return null
  return flow[i + 1]!.id
}

export function prevStepId(s: FlowGateInput): WizardStep | null {
  const flow = flowForKind(s.foundationKind)
  if (isOffFlowStep(s.step)) {
    if (s.step === 'rebar') {
      return s.foundationKind === 'pile_cap' ? 'block' : 'results'
    }
    return flowAnchorFor(s.step)
  }
  const i = flow.findIndex((x) => x.id === s.step)
  if (i <= 0) return null
  return flow[i - 1]!.id
}

/** Viz de perfil (sondagem) vs viz de projeto completo (após capacidade). */
export function vizModeForStep(step: WizardStep): 'none' | 'profile' | 'project' {
  if (step === 'borehole' || step === 'groundwater') return 'profile'
  if (
    step === 'results' ||
    step === 'tip_sweep' ||
    step === 'group' ||
    step === 'block' ||
    step === 'rebar' ||
    step === 'drawings' ||
    step === 'loads' ||
    step === 'analysis'
  ) {
    return 'project'
  }
  if (
    step === 'foundation' ||
    step === 'pile' ||
    step === 'footing' ||
    step === 'caisson' ||
    step === 'raft'
  ) {
    return 'profile'
  }
  return 'none'
}
