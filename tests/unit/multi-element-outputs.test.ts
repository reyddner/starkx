import { describe, expect, it, beforeEach } from 'vitest'
import { useProjectStore } from '../../apps/web/src/store/projectStore'
import { buildProjectOutputs } from '../../apps/web/src/store/buildProjectOutputs'
import { createColumn } from '../../apps/web/src/store/columns'
import { designColumnCap, defaultColumnLayout } from '../../apps/web/src/store/columnCaps'
import { emptyColumnLoad } from '../../apps/web/src/store/columns'
import { buildProjectDrawingBook } from '../../drawing-engine'
import { storeToMemorialInput } from '../../apps/web/src/memorial/fromStore'
import { buildMemorialDocument } from '../../memorial-engine'

describe('multi-elemento: prancha + memorial + bloco 1E', () => {
  beforeEach(() => {
    useProjectStore.getState().resetBlankProject()
  })

  it('designColumnCap gera bloco mesmo com 1 estaca (não apoia pilar no fuste)', () => {
    const out = designColumnCap({
      load: { ...emptyColumnLoad(), N_kN: 80, columnLabel: 'P01' },
      padm_kN: 200,
      diameter_m: 0.3,
      layout: defaultColumnLayout(),
      autoSuggest: true,
    })
    expect(out.foundationKind).toBe('pile_cap')
    expect(out.block.pileCount).toBe(1)
    expect(out.block.cap.width_m).toBeGreaterThan(0)
  })

  it('3 pilares → 3 blocos na prancha e no memorial', () => {
    const store = useProjectStore.getState()
    store.loadReferenceExample()

    // Sai do exemplo (estaca isolada) para o fluxo de produto com pilares.
    const c1 = createColumn({ columnLabel: 'P01', N_kN: 120 })
    const c2 = createColumn({ columnLabel: 'P02', N_kN: 180 }, [c1])
    const c3 = createColumn({ columnLabel: 'P03', N_kN: 90 }, [c1, c2])

    useProjectStore.setState({
      mode: 'engineering',
      foundationKind: 'pile_cap',
      columns: [c1, c2, c3],
      activeColumnId: c1.id,
      columnLoad: {
        N_kN: 120,
        Mx_kNm: 0,
        My_kNm: 0,
        Qx_kN: 0,
        Qy_kN: 0,
        T_kNm: 0,
        columnWidth_m: 0.3,
        columnDepth_m: 0.5,
        columnLabel: 'P01',
      },
      designLoad_kN: 120,
    })

    useProjectStore.getState().runCalculation({ preserveStep: true, skipArrangement: true })
    useProjectStore.getState().prepareDrawings()

    const s = useProjectStore.getState()
    expect(s.result).not.toBeNull()
    expect(s.foundationKind).toBe('pile_cap')

    const outputs = buildProjectOutputs({
      projectName: s.projectName,
      projectCode: s.projectCode,
      client: s.client,
      location: s.location,
      responsibleEngineer: s.responsibleEngineer,
      engineerCrea: s.engineerCrea ?? '',
      companyLogoBase64: s.companyLogoBase64 ?? null,
      foundationKind: s.foundationKind,
      columns: s.columns,
      activeColumnId: s.activeColumnId,
      diameterCm: s.diameterCm,
      tipDepth_m: s.tipDepth_m,
      blockRows: s.blockRows,
      blockCols: s.blockCols,
      blockSpacing_m: s.blockSpacing_m,
      blockEdge_m: s.blockEdge_m,
      blockThickness_m: s.blockThickness_m,
      blockEfficiency: s.blockEfficiency,
      blockEmbedment_m: s.blockEmbedment_m,
      padm_kN: s.result!.atTip.governingPadm_kN,
      blockResult: s.blockResult,
      structural: s.structural,
      footingResult: s.footingResult,
      fck_MPa: s.fck_MPa,
      fyk_MPa: s.fyk_MPa,
      cover_mm: s.cover_mm,
      designLoad_kN: s.designLoad_kN,
    })

    expect(outputs.columnBlocks).toHaveLength(3)
    expect(outputs.validation.ok).toBe(true)
    expect(outputs.validation.processedCount).toBe(3)
    expect(outputs.drawingInput.blocks).toHaveLength(3)
    expect(outputs.drawingInput.piles!.length).toBeGreaterThanOrEqual(1)

    const book = buildProjectDrawingBook(outputs.drawingInput)
    // Folha de rosto + 3 blocos + ≥1 estaca
    expect(book.sheets.length).toBeGreaterThanOrEqual(5)

    const memorialInput = storeToMemorialInput({
      ...s,
      columns: s.columns,
      activeColumnId: s.activeColumnId,
    })
    expect(memorialInput.columnBlocks).toHaveLength(3)
    const doc = buildMemorialDocument(memorialInput)
    const bloco = doc.sections.find((sec) => sec.id === 'bloco')
    expect(bloco).toBeDefined()
    expect(bloco!.title).toMatch(/3/)
    expect(bloco!.table?.rows).toHaveLength(3)
  })

  it('fluxo de bloco com N coberta por 1 estaca gera bloco 1E', () => {
    useProjectStore.getState().loadReferenceExample()
    // patch (como a UI): ao virar bloco, o comprimento é ajustado à sondagem.
    useProjectStore.getState().patch({
      foundationKind: 'pile_cap',
      designLoad_kN: 50,
      columnLoad: {
        ...useProjectStore.getState().columnLoad,
        N_kN: 50,
      },
    })
    useProjectStore.getState().runCalculation({ preserveStep: true })
    const s = useProjectStore.getState()
    expect(s.foundationKind).toBe('pile_cap')
    expect(s.blockRows * s.blockCols).toBe(1)
    expect(s.blockResult).not.toBeNull()
    expect(s.blockResult!.pileCount).toBe(1)
  })

  it('estaca isolada escolhida pelo usuário permanece isolada quando 1 estaca basta', () => {
    useProjectStore.getState().loadReferenceExample()
    useProjectStore.setState({
      foundationKind: 'pile',
      designLoad_kN: 50,
      columnLoad: { ...useProjectStore.getState().columnLoad, N_kN: 50 },
    })
    useProjectStore.getState().runCalculation({ preserveStep: true })
    expect(useProjectStore.getState().foundationKind).toBe('pile')
  })
})
