import type { AssistFinding } from './analyze'

export interface ProjectAlertLayer {
  depth_m: number
  soilTypeId: number
  description?: string
  excludeFromShaftFriction?: boolean
}

export interface ProjectAlertInput {
  foundationKind: 'pile' | 'pile_cap' | 'footing' | 'caisson' | 'raft'
  layers: ProjectAlertLayer[]
  waterLevel_m: number | null
  designLoad_kN: number | null
  tipDepth_m: number
  hasCapacityResult: boolean
  columnLabel?: string
}

/**
 * Alertas de projeto (pré/pós cálculo) — O quê + Por quê + Como corrigir.
 * Não calcula Padm; só interpreta estado do modelo.
 */
export function analyzeProjectAlerts(input: ProjectAlertInput): AssistFinding[] {
  const out: AssistFinding[] = []
  const label = input.columnLabel?.trim() || 'pilar'

  if (input.layers.length === 0) {
    out.push({
      id: 'proj.borehole.empty',
      severity: 'warning',
      title: 'Sondagem ausente',
      message:
        'O quê: nenhuma camada SPT cadastrada. Por quê: sem perfil o motor de estaca não calcula. Como corrigir: preencha a etapa Sondagem ou carregue o exemplo / importe JSON/CSV.',
    })
  }

  const noDesc = input.layers.filter((l) => !(l.description && l.description.trim().length > 0))
  if (input.layers.length > 0 && noDesc.length === input.layers.length) {
    out.push({
      id: 'proj.borehole.nodesc',
      severity: 'tip',
      title: 'Descrição das camadas vazia',
      message:
        'O quê: camadas sem texto de boletim. Por quê: a sugestão de tipo de solo (DEC-40) usa a descrição — sem ela só o seletor manual vale. Como corrigir: preencha a coluna Descrição (ex.: «Argila arenosa»).',
    })
  }

  if (
    (input.foundationKind === 'pile' || input.foundationKind === 'pile_cap') &&
    input.layers.length > 0 &&
    !input.layers.some((l) => l.depth_m === input.tipDepth_m)
  ) {
    // Após cálculo bem-sucedido a ponta já foi validada pelo motor — não repetir.
    if (!input.hasCapacityResult) {
      out.push({
        id: 'proj.tip.mismatch',
        severity: 'warning',
        title: 'Cota de apoio sem camada SPT',
        message: `O quê: não há camada exatamente em ${input.tipDepth_m} m. Por quê: o motor exige NSPT na ponta. Como corrigir: ajuste a cota de apoio para um metro do perfil ou adicione a camada faltante.`,
      })
    }
  }

  if (input.waterLevel_m == null) {
    out.push({
      id: 'proj.na.missing',
      severity: 'tip',
      title: "Nível d'água não informado",
      message:
        "O quê: NA em branco. Por quê: na v1 o NA não altera Padm (DEC-06), mas falta no memorial/viz. Como corrigir: informe a profundidade na etapa Nível d'água, ou deixe em branco se for intencional.",
    })
  }

  if (
    (input.foundationKind === 'pile' || input.foundationKind === 'pile_cap') &&
    input.hasCapacityResult &&
    (input.designLoad_kN == null || !(input.designLoad_kN > 0))
  ) {
    out.push({
      id: 'proj.load.missing',
      severity: 'warning',
      title: 'Carga do pilar não informada',
      message: `O quê: capacidade calculada, mas N do ${label} está vazio. Por quê: grupo/bloco/armadura precisam da solicitação. Como corrigir: preencha N (e Mx/My se houver) na etapa Cargas.`,
    })
  }

  const excluded = input.layers.filter((l) => l.excludeFromShaftFriction)
  if (excluded.length > 0) {
    out.push({
      id: 'proj.nsf.shaft-excluded',
      severity: 'tip',
      title: 'Camadas sem atrito lateral',
      message: `O quê: ${excluded.length} camada(s) com «Sem atrito». Por quê: nesses metros Rl = 0 nos três métodos (Padm reduz). Como corrigir: desmarque se a exclusão não for intencional. Atrito negativo (down-drag) ainda não é calculado.`,
    })
  }

  return out
}
