import { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { buildMemorialFromStore } from '../../memorial/fromStore'
import { FlowNavButtons } from '../FlowNavButtons'
import memorialFontUrl from '@memorial/fonts/Roboto-Regular.ttf?url'

export function StepMemorial() {
  const s = useProjectStore()
  const kind = s.foundationKind
  const isOther = kind === 'footing' || kind === 'caisson' || kind === 'raft'
  const { doc, markdown, html } = buildMemorialFromStore({
    projectName: s.projectName,
    projectCode: s.projectCode,
    client: s.client,
    location: s.location,
    pileTypeId: s.pileTypeId,
    diameterCm: s.diameterCm,
    tipDepth_m: s.tipDepth_m,
    blockThickness_m: s.blockThickness_m,
    blockEmbedment_m: s.blockEmbedment_m,
    pileTopElevation_m: s.pileTopElevation_m,
    areaCm2: s.areaCm2,
    perimeterCm: s.perimeterCm,
    waterLevel_m: s.waterLevel_m,
    layers: s.layers,
    designLoad_kN: s.designLoad_kN,
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
    blockRows: s.blockRows,
    blockCols: s.blockCols,
    blockEdge_m: s.blockEdge_m,
    result: s.result,
    structural: s.structural,
    blockResult: s.blockResult,
    footingResult: s.footingResult,
    caissonResult: s.caissonResult,
    raftResult: s.raftResult,
    footingShape: s.footingShape,
    footingAdmMode: s.footingAdmMode,
    foundationKind: s.foundationKind,
    fck_MPa: s.fck_MPa,
    cover_mm: s.cover_mm,
    columns: s.columns,
    activeColumnId: s.activeColumnId,
    columnLoad: s.columnLoad,
    blockSpacing_m: s.blockSpacing_m,
    blockEfficiency: s.blockEfficiency,
    responsibleEngineer: s.responsibleEngineer,
    engineerCrea: s.engineerCrea,
    companyLogoBase64: s.companyLogoBase64,
    fyk_MPa: s.fyk_MPa,
  })

  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${s.projectCode || 'memorial'}-memorial.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPdf = async () => {
    setPdfBusy(true)
    setPdfError(null)
    try {
      const [{ memorialToPdf }, fontRes] = await Promise.all([
        import('@memorial/toPdf'),
        fetch(memorialFontUrl),
      ])
      if (!fontRes.ok) throw new Error('Fonte do memorial indisponível')
      const fontBytes = new Uint8Array(await fontRes.arrayBuffer())
      const bytes = await memorialToPdf(doc, { fontBytes })
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${s.projectCode || 'memorial'}-memorial.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : String(e))
    } finally {
      setPdfBusy(false)
    }
  }

  const printPdf = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${doc.title}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:2rem;line-height:1.45;max-width:800px}
  h1{font-size:1.45rem;margin:0 0 .35rem}
  .subtitle{color:#444;margin:0 0 1.5rem}
  h2{font-size:1.1rem;margin:1.4rem 0 .5rem;border-bottom:1px solid #ccc;padding-bottom:.25rem}
  p{margin:.35rem 0}
  table{border-collapse:collapse;width:100%;margin:.6rem 0 1rem;font-size:.9rem}
  th,td{border:1px solid #bbb;padding:.35rem .5rem;text-align:left}
  th{background:#E6DCC8;color:#2F2F30}
  @media print{body{margin:12mm}}
</style></head><body>${html}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const incomplete =
    kind === 'footing'
      ? !s.footingResult
      : kind === 'caisson'
        ? !s.caissonResult
        : kind === 'raft'
          ? !s.raftResult
          : !s.result

  return (
    <section className="panel memorial-panel" data-testid="step-memorial">
      <h2>Memorial de cálculo</h2>
      <p className="lead">
        Documento gerado a partir dos resultados dos motores (sem recalcular). Baixe PDF nativo,
        Markdown, ou use impressão do navegador.
      </p>

      {incomplete && (
        <div className="error-box">
          {isOther
            ? 'Execute o dimensionamento antes de emitir o memorial completo.'
            : 'Execute o cálculo geotécnico antes de emitir o memorial completo.'}
        </div>
      )}
      {pdfError && <div className="error-box">{pdfError}</div>}

      <FlowNavButtons
        hidePrimary
        extra={
          <>
            <button type="button" className="btn" onClick={downloadMd}>
              Baixar Markdown
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void downloadPdf()}
              disabled={pdfBusy}
            >
              {pdfBusy ? 'Gerando PDF…' : 'Baixar PDF'}
            </button>
            <button type="button" className="btn" onClick={printPdf}>
              Imprimir
            </button>
          </>
        }
      />

      <article className="memorial-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )
}
