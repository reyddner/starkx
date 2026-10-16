import { useEffect, useMemo, useState } from 'react'
import {
  buildProjectDrawingBook,
  exportProjectBookToPdf,
  exportSheetToSvg,
  exportSingleSheetToPdf,
  type A4Sheet,
} from '@drawing'
import { footingDesignBaseFrom, useProjectStore } from '../../store/projectStore'
import { buildProjectOutputs } from '../../store/buildProjectOutputs'
import { progressChecklist } from '../../store/wizardFlow'
import { FlowNavButtons } from '../FlowNavButtons'

export function StepDrawings() {
  const s = useProjectStore()
  const gate = s.toGateInput()
  const checklist = progressChecklist(gate)
  const pending = checklist.filter((c) => !c.done)

  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingSinglePdf, setDownloadingSinglePdf] = useState(false)

  const prepareDrawings = useProjectStore((st) => st.prepareDrawings)
  useEffect(() => {
    prepareDrawings()
  }, [prepareDrawings])

  const outputs = useMemo(() => {
    return buildProjectOutputs({
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
      padm_kN: s.result?.atTip.governingPadm_kN ?? null,
      blockResult: s.blockResult,
      structural: s.structural,
      footingResult: s.footingResult,
      footingDesignBase: footingDesignBaseFrom({
        loadIsDesign: s.loadIsDesign,
        footingShape: s.footingShape,
        footingAspect: s.footingAspect,
        footingAdmMode: s.footingAdmMode,
        footingSigmaAdm_kPa: s.footingSigmaAdm_kPa,
        footingC_kPa: s.footingC_kPa,
        footingPhi_deg: s.footingPhi_deg,
        footingGamma_kN_m3: s.footingGamma_kN_m3,
        footingDf_m: s.footingDf_m,
        footingFs: s.footingFs,
        footingThickness_m: s.footingThickness_m,
        fck_MPa: s.fck_MPa,
        fyk_MPa: s.fyk_MPa,
      }),
      fck_MPa: s.fck_MPa,
      fyk_MPa: s.fyk_MPa,
      pileTypeId: s.pileTypeId,
      loadIsDesign: s.loadIsDesign,
      cover_mm: s.cover_mm,
      designLoad_kN: s.designLoad_kN,
    })
  }, [
    s.projectName,
    s.projectCode,
    s.client,
    s.location,
    s.responsibleEngineer,
    s.engineerCrea,
    s.companyLogoBase64,
    s.foundationKind,
    s.columns,
    s.activeColumnId,
    s.diameterCm,
    s.tipDepth_m,
    s.blockRows,
    s.blockCols,
    s.blockSpacing_m,
    s.blockEdge_m,
    s.blockThickness_m,
    s.blockEfficiency,
    s.blockEmbedment_m,
    s.result,
    s.blockResult,
    s.structural,
    s.footingResult,
    s.footingShape,
    s.footingAspect,
    s.footingAdmMode,
    s.footingSigmaAdm_kPa,
    s.footingC_kPa,
    s.footingPhi_deg,
    s.footingGamma_kN_m3,
    s.footingDf_m,
    s.footingFs,
    s.footingThickness_m,
    s.fck_MPa,
    s.fyk_MPa,
    s.pileTypeId,
    s.loadIsDesign,
    s.cover_mm,
    s.designLoad_kN,
  ])

  const book = useMemo(
    () => buildProjectDrawingBook(outputs.drawingInput),
    [outputs.drawingInput],
  )

  const elementSheetCount =
    (outputs.drawingInput.blocks?.length ?? 0) +
    (outputs.drawingInput.piles?.length ?? 0) +
    (outputs.drawingInput.footings?.length ?? 0)
  const bookIsEmpty = elementSheetCount === 0
  const validation = outputs.validation

  const safeSheetIndex = Math.min(Math.max(0, activeSheetIndex), book.sheets.length - 1)
  const currentSheet = book.sheets[safeSheetIndex] || book.sheets[0]

  const svgMarkup = useMemo(() => {
    if (!currentSheet) return ''
    return exportSheetToSvg(currentSheet)
  }, [currentSheet])

  const assertReadyToExport = (): boolean => {
    if (bookIsEmpty) {
      alert('Nenhuma prancha de elemento foi gerada. Complete sondagem, cargas e capacidade.')
      return false
    }
    if (!validation.ok) {
      const proceed = window.confirm(
        `Validação incompleta:\n\n${validation.messages.join('\n')}\n\n` +
          `Processados: ${validation.processedCount} / cadastrados com carga: ${validation.registeredCount}.\n\n` +
          'Deseja gerar o PDF mesmo assim?',
      )
      return proceed
    }
    return true
  }

  const handleDownloadCompletePdf = async () => {
    if (!assertReadyToExport()) return
    try {
      setDownloadingPdf(true)
      const pdfBytes = await exportProjectBookToPdf(book)
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (s.projectName.trim() || 'Fundacoes').replace(/[^a-zA-Z0-9_\u00C0-\u00FF-]/g, '_')
      a.download = `Caderno_Pranchas_${safeName}_A4.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Falha ao exportar Caderno de Pranchas em PDF:', err)
      alert('Houve uma falha ao gerar o PDF vetorial. Verifique o console.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadCurrentSheetPdf = async () => {
    if (!currentSheet) return
    try {
      setDownloadingSinglePdf(true)
      const pdfBytes = await exportSingleSheetToPdf(currentSheet)
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (currentSheet.elementRef || `Prancha_${safeSheetIndex + 1}`).replace(
        /[^a-zA-Z0-9_\u00C0-\u00FF-]/g,
        '_',
      )
      a.download = `Prancha_${String(safeSheetIndex + 1).padStart(2, '0')}_${safeName}_A4.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Falha ao exportar prancha individual:', err)
      alert('Houve uma falha ao gerar o PDF da prancha.')
    } finally {
      setDownloadingSinglePdf(false)
    }
  }

  const handleDownloadSvg = () => {
    if (!svgMarkup || !currentSheet) return
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Prancha_${String(safeSheetIndex + 1).padStart(2, '0')}_${currentSheet.elementRef || 'Desenho'}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel" data-testid="step-drawings" style={{ maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2>Caderno de Pranchas (A4 Paisagem)</h2>
          <p className="lead" style={{ marginBottom: '0.25rem' }}>
            Uma prancha por bloco/pilar, estaca típica e folha de rosto. Esquemático — não substitui
            prancha executiva nem ART.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadCompletePdf}
            disabled={downloadingPdf || bookIsEmpty}
            style={{ fontWeight: 'bold' }}
            data-testid="btn-download-pdf-book"
          >
            {downloadingPdf ? 'Gerando Caderno PDF...' : 'Baixar Caderno A4 Completo (PDF)'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleDownloadCurrentSheetPdf}
            disabled={downloadingSinglePdf}
            data-testid="btn-download-sheet-pdf"
          >
            {downloadingSinglePdf ? 'Gerando...' : 'Prancha Atual (PDF)'}
          </button>
          <button type="button" className="btn" onClick={handleDownloadSvg} data-testid="btn-download-sheet-svg">
            Prancha Atual (SVG)
          </button>
        </div>
      </div>

      <div
        className={validation.ok ? 'ok-box' : 'error-box'}
        role="status"
        style={{ marginTop: '1rem' }}
        data-testid="drawings-validation"
      >
        <strong>
          Validação:{' '}
          {validation.processedCount}/{Math.max(validation.registeredCount, validation.processedCount)}{' '}
          elemento(s)
        </strong>
        <ul style={{ margin: '0.4rem 0 0 1.1rem' }}>
          {validation.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
          <li>
            Blocos na prancha: {outputs.drawingInput.blocks?.length ?? 0} · Estacas:{' '}
            {outputs.drawingInput.piles?.length ?? 0} · Folhas totais: {book.sheets.length}
          </li>
        </ul>
        {!validation.ok && (
          <button
            type="button"
            className="btn"
            style={{ marginTop: 8 }}
            onClick={() => s.prepareDrawings()}
            data-testid="drawings-generate-missing"
          >
            Recalcular todos os pilares
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg)',
          padding: '0.6rem 1rem',
          borderRadius: '6px',
          margin: '1rem 0',
          flexWrap: 'wrap',
          gap: '0.75rem',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn"
            disabled={safeSheetIndex === 0}
            onClick={() => setActiveSheetIndex((prev) => Math.max(0, prev - 1))}
            style={{ padding: '4px 10px' }}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn"
            disabled={safeSheetIndex >= book.sheets.length - 1}
            onClick={() => setActiveSheetIndex((prev) => Math.min(book.sheets.length - 1, prev + 1))}
            style={{ padding: '4px 10px' }}
          >
            Próxima
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label htmlFor="sheet-select" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            Visualizando:
          </label>
          <select
            id="sheet-select"
            value={safeSheetIndex}
            onChange={(e) => setActiveSheetIndex(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
          >
            {book.sheets.map((sh: A4Sheet, idx: number) => (
              <option key={idx} value={idx}>
                Prancha {String(idx + 1).padStart(2, '0')}: {sh.title}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ({safeSheetIndex + 1} de {book.sheets.length} folhas)
          </span>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Formato: A4 Paisagem (297×210 mm)
        </div>
      </div>

      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          background: 'var(--brand-ink)',
          padding: '1.5rem',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'center',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '960px',
            aspectRatio: '297 / 210',
            backgroundColor: '#ffffff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3>Status de Conclusão do Projeto</h3>
        <ul className="nav-list" data-testid="project-checklist">
          {checklist.map((c) => (
            <li key={c.id}>
              <span>
                {c.done ? '[✓]' : c.blocked ? '[ ]' : '[→]'} {c.label}
              </span>
            </li>
          ))}
        </ul>

        {pending.length > 0 && (
          <div className="error-box" role="status" style={{ marginTop: '0.75rem' }}>
            Atenção: há {pending.length} etapa(s) pendente(s) no checklist.
          </div>
        )}
      </div>

      <FlowNavButtons primaryLabel="Ir ao memorial" />
    </section>
  )
}
