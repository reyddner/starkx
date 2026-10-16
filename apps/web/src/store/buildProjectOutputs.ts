/**
 * Monta entradas de prancha + memorial a partir de TODOS os pilares cadastrados.
 * Origem do bug “só 1 elemento”: StepDrawings lia só blockResult do ativo.
 */
import type { BlockDesignResult } from '@block/index'
import type { DrawingBookInput } from '@drawing'
import { aggregateProjectTakeoff, computeFootingTakeoff } from '@structural/takeoff'
import type { ElementTakeoff } from '@structural/takeoff'
import type { StructuralDesignResult } from '@structural/design'
import type { FootingDesignResult } from '@footing/index'
import {
  columnToLoad,
  type ColumnRecord,
} from './columns'
import {
  defaultColumnLayout,
  designColumnCap,
  type ColumnCapLayout,
} from './columnCaps'
import type { FoundationKindUi } from './wizardTypes'

export interface ProjectOutputsSource {
  projectName: string
  projectCode: string
  client: string
  location: string
  responsibleEngineer: string
  engineerCrea: string
  companyLogoBase64: string | null
  foundationKind: FoundationKindUi
  columns: ColumnRecord[]
  activeColumnId: string
  diameterCm: number
  tipDepth_m: number
  blockRows: number
  blockCols: number
  blockSpacing_m: number | null
  blockEdge_m: number
  blockThickness_m: number
  blockEfficiency: number | null
  blockEmbedment_m: number
  padm_kN: number | null
  blockResult: BlockDesignResult | null
  structural: StructuralDesignResult | null
  footingResult: FootingDesignResult | null
  fck_MPa: number | null
  fyk_MPa: number
  /** Tipo de estaca (espaçamento mínimo do grupo); opcional. */
  pileTypeId?: number
  /** Cargas dos pilares já de cálculo? */
  loadIsDesign?: boolean
  cover_mm: number
  designLoad_kN: number | null
}

export interface ColumnBlockOutput {
  columnId: string
  columnLabel: string
  N_kN: number
  Mx_kNm: number
  My_kNm: number
  layout: ColumnCapLayout
  block: BlockDesignResult
  pileCount: number
}

export interface ProjectOutputsValidation {
  registeredCount: number
  processedCount: number
  missingLabels: string[]
  ok: boolean
  messages: string[]
}

export interface ProjectOutputs {
  columnBlocks: ColumnBlockOutput[]
  drawingInput: DrawingBookInput
  takeoffElements: ElementTakeoff[]
  validation: ProjectOutputsValidation
}

function columnsWithLoad(columns: ColumnRecord[]): ColumnRecord[] {
  return columns.filter((c) => c.N_kN != null && c.N_kN > 0)
}

/** Dimensiona bloco de cada pilar com Padm já conhecido. */
export function designAllColumnBlocks(
  s: ProjectOutputsSource,
): ColumnBlockOutput[] {
  if (s.foundationKind !== 'pile' && s.foundationKind !== 'pile_cap') return []

  const diameter_m = s.diameterCm / 100
  const baseLayout = defaultColumnLayout({
    blockRows: s.blockRows,
    blockCols: s.blockCols,
    blockSpacing_m: s.blockSpacing_m,
    blockEdge_m: s.blockEdge_m,
    blockThickness_m: s.blockThickness_m,
    blockEfficiency: s.blockEfficiency,
  })

  const activeFallback = (): ColumnBlockOutput[] => {
    if (!s.blockResult) return []
    const active = s.columns.find((c) => c.id === s.activeColumnId)
    return [
      {
        columnId: active?.id ?? 'active',
        columnLabel: active?.columnLabel || 'P01',
        N_kN: s.designLoad_kN ?? active?.N_kN ?? 0,
        Mx_kNm: active?.Mx_kNm ?? 0,
        My_kNm: active?.My_kNm ?? 0,
        layout: baseLayout,
        block: s.blockResult,
        pileCount: s.blockResult.pileCount,
      },
    ]
  }

  const padm = s.padm_kN
  if (padm == null || !(padm > 0)) {
    // Sem Padm (ex.: memorial de teste com blockResult já montado) — usa o bloco ativo.
    return activeFallback()
  }

  const loaded = columnsWithLoad(s.columns)
  if (loaded.length === 0) {
    return activeFallback()
  }

  const out: ColumnBlockOutput[] = []
  for (const col of loaded) {
    try {
      const layout = col.layout
        ? defaultColumnLayout({
            ...baseLayout,
            ...col.layout,
            blockEfficiency: col.layout.blockEfficiency ?? baseLayout.blockEfficiency,
            blockEdge_m: col.layout.blockEdge_m ?? baseLayout.blockEdge_m,
            blockThickness_m: col.layout.blockThickness_m ?? baseLayout.blockThickness_m,
            blockSpacing_m: col.layout.blockSpacing_m ?? baseLayout.blockSpacing_m,
          })
        : baseLayout
      const designed = designColumnCap({
        load: columnToLoad(col),
        padm_kN: padm,
        diameter_m,
        layout,
        autoSuggest: true,
        fck_MPa: s.fck_MPa,
        fyk_MPa: s.fyk_MPa,
        pileTypeId: s.pileTypeId,
        loadIsDesign: s.loadIsDesign,
      })
      out.push({
        columnId: col.id,
        columnLabel: col.columnLabel || 'Pilar',
        N_kN: col.N_kN!,
        Mx_kNm: col.Mx_kNm ?? 0,
        My_kNm: col.My_kNm ?? 0,
        layout: designed.layout,
        block: designed.block,
        pileCount: designed.block.pileCount,
      })
    } catch {
      // Pilar com erro fica para a validação (missing).
    }
  }
  return out
}

function validateOutputs(
  s: ProjectOutputsSource,
  columnBlocks: ColumnBlockOutput[],
  pilesCount: number,
  footingsCount: number,
): ProjectOutputsValidation {
  const messages: string[] = []
  const loaded = columnsWithLoad(s.columns)
  const registeredCount = loaded.length
  const processedIds = new Set(columnBlocks.map((c) => c.columnId))
  const missingLabels = loaded
    .filter((c) => !processedIds.has(c.id))
    .map((c) => c.columnLabel || c.id)

  let processedCount = columnBlocks.length
  if (s.foundationKind === 'footing') {
    processedCount = footingsCount
  }

  if (s.foundationKind === 'pile' || s.foundationKind === 'pile_cap') {
    if (registeredCount === 0) {
      messages.push('Nenhum pilar com carga N > 0 cadastrado.')
    }
    if (missingLabels.length > 0) {
      messages.push(
        `Pilares sem bloco dimensionado: ${missingLabels.join(', ')}.`,
      )
    }
    if (columnBlocks.length > 0 && pilesCount === 0) {
      messages.push('Há blocos, mas nenhuma prancha de estaca foi gerada.')
    }
    if (s.padm_kN == null || !(s.padm_kN > 0)) {
      messages.push('Capacidade da estaca (Padm) ausente — calcule antes de gerar o caderno.')
    }
  }

  if (s.foundationKind === 'footing' && footingsCount === 0) {
    messages.push('Sapata não dimensionada — nada a imprimir.')
  }

  const ok =
    messages.length === 0 &&
    (s.foundationKind === 'footing'
      ? footingsCount > 0
      : registeredCount === 0
        ? columnBlocks.length > 0
        : missingLabels.length === 0 && columnBlocks.length === registeredCount)

  return {
    registeredCount,
    processedCount,
    missingLabels,
    ok,
    messages: ok
      ? [
          `Validação OK: ${processedCount} elemento(s) processado(s)` +
            (registeredCount > 0 ? ` de ${registeredCount} pilar(es) com carga.` : '.'),
        ]
      : messages,
  }
}

/** Consolida caderno A4 + takeoff + validação para TODOS os pilares. */
export function buildProjectOutputs(s: ProjectOutputsSource): ProjectOutputs {
  const columnBlocks = designAllColumnBlocks(s)
  const diameter_m = s.diameterCm / 100
  const tipDepth_m = s.tipDepth_m

  const blocks: DrawingBookInput['blocks'] = columnBlocks.map((cb) => ({
    result: cb.block,
    pileDiameter_m: diameter_m,
    pierWidth_m: s.columns.find((c) => c.id === cb.columnId)?.columnWidth_m ?? 0.3,
    pierLength_m: s.columns.find((c) => c.id === cb.columnId)?.columnDepth_m ?? 0.5,
    // Corte mostra o L real (limitado visualmente no sheet, mas cotado).
    pileShaftLength_m: tipDepth_m,
    ref: `Bloco ${cb.columnLabel}`,
    takeoff: cb.block.takeoff
      ? { ...cb.block.takeoff, elementRef: `Bloco ${cb.columnLabel}` }
      : undefined,
  }))

  const totalPiles = columnBlocks.reduce((sum, cb) => sum + cb.pileCount, 0)
  const piles: DrawingBookInput['piles'] = []
  if (
    (s.foundationKind === 'pile' || s.foundationKind === 'pile_cap') &&
    diameter_m > 0 &&
    tipDepth_m > 0 &&
    (totalPiles > 0 || columnBlocks.length === 0)
  ) {
    const n = Math.max(1, totalPiles)
    const detail = s.structural?.detail
    const takeoff = s.structural?.takeoff
    piles.push({
      diameter_m,
      length_m: tipDepth_m,
      pileCount: n,
      ref: n > 1 ? `Estaca típica (×${n})` : 'Estaca E-01',
      takeoff: takeoff
        ? { ...takeoff, elementRef: n > 1 ? `Estaca típica (×${n})` : 'Estaca E-01' }
        : undefined,
      longitudinalCount: detail?.longitudinal.count,
      longitudinalDia_mm: detail?.longitudinal.diameter_mm,
      cageLength_m: detail?.cageLength_m,
      transverseKind: detail?.transverse.kind,
    })
  }

  const footings: DrawingBookInput['footings'] = []
  if (s.foundationKind === 'footing' && s.footingResult) {
    for (const col of columnsWithLoad(s.columns).length > 0
      ? columnsWithLoad(s.columns)
      : s.columns.slice(0, 1)) {
      const label = col.columnLabel || 'S-01'
      const r = s.footingResult
      footings.push({
        result: r,
        pierWidth_m: col.columnWidth_m ?? 0.3,
        pierLength_m: col.columnDepth_m ?? 0.5,
        ref: `Sapata ${label}`,
        takeoff:
          r.rebar != null
            ? computeFootingTakeoff({
                elementRef: `Sapata ${label}`,
                B_m: r.B_m,
                L_m: r.L_m,
                thickness_m: r.thickness_m,
                bar_mm: r.rebar.suggestBar_mm,
                spacing_cm: r.rebar.suggestSpacing_cm,
                cover_m: s.cover_mm / 1000,
                concreteGrade: s.fck_MPa != null ? `C${s.fck_MPa}` : undefined,
              })
            : undefined,
      })
    }
  }

  const takeoffElements: ElementTakeoff[] = []
  for (const cb of columnBlocks) {
    if (cb.block.takeoff) {
      takeoffElements.push({
        ...cb.block.takeoff,
        elementRef: `Bloco ${cb.columnLabel}`,
      })
    }
    if (s.structural?.takeoff) {
      for (let i = 1; i <= cb.pileCount; i++) {
        takeoffElements.push({
          ...s.structural.takeoff,
          elementRef: `Estaca ${cb.columnLabel}${cb.pileCount > 1 ? ` #${i}` : ''}`,
        })
      }
    }
  }
  for (const f of footings) {
    if (f.takeoff) takeoffElements.push(f.takeoff)
  }

  const takeoffSummary =
    takeoffElements.length > 0 ? aggregateProjectTakeoff(takeoffElements) : undefined

  const validation = validateOutputs(s, columnBlocks, piles.length, footings.length)

  const drawingInput: DrawingBookInput = {
    projectName: s.projectName.trim() || 'Projeto de Fundações',
    projectCode: s.projectCode,
    client: s.client,
    location: s.location,
    engineerName: s.responsibleEngineer,
    crea: s.engineerCrea,
    companyLogoBase64: s.companyLogoBase64 ?? undefined,
    blocks,
    piles,
    footings,
    takeoffSummary,
    generalNotes: validation.ok
      ? [
          'Caderno esquemático STARKX — não substitui prancha executiva nem ART.',
          validation.messages[0] ?? '',
        ].filter(Boolean)
      : [
          'ATENÇÃO: caderno incompleto.',
          ...validation.messages,
        ],
  }

  return {
    columnBlocks,
    drawingInput,
    takeoffElements,
    validation,
  }
}
