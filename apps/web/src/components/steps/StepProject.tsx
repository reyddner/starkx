import { useRef, useState } from 'react'
import {
  exportProjectSnapshot,
  parseProjectSnapshot,
  type ProjectImportPreview,
  type ProjectSnapshotFields,
} from '@assist/index'
import { useProjectStore } from '../../store/projectStore'
import { useLibraryStore } from '../../store/projectLibrary'
import { syncActiveToLibrary } from '../../store/workspaceBridge'
import { ScopeBanner } from '../ScopeBanner'
import { FlowNavButtons } from '../FlowNavButtons'

function snapshotFromStore(): ProjectSnapshotFields {
  const s = useProjectStore.getState()
  return {
    theme: s.theme,
    foundationKind: s.foundationKind,
    projectName: s.projectName,
    projectCode: s.projectCode,
    client: s.client,
    location: s.location,
    pileTypeId: s.pileTypeId,
    diameterCm: s.diameterCm,
    tipDepth_m: s.tipDepth_m,
    areaCm2: s.areaCm2,
    perimeterCm: s.perimeterCm,
    enlargedBaseVolumeLiters: s.enlargedBaseVolumeLiters,
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
  }
}

export function StepProject() {
  const s = useProjectStore()
  const setShellView = useLibraryStore((st) => st.setShellView)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ProjectImportPreview | null>(null)
  const [ioError, setIoError] = useState<string | null>(null)

  const exportProject = () => {
    const json = exportProjectSnapshot(snapshotFromStore())
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = (s.projectName || s.projectCode || 'starkx')
      .trim()
      .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
      .replace(/_+/g, '_')
      .slice(0, 60)
    a.download = `${slug || 'starkx'}-projeto.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImportFile = async (file: File | null) => {
    setIoError(null)
    setPreview(null)
    if (!file) return
    try {
      const text = await file.text()
      setPreview(parseProjectSnapshot(text))
    } catch (e) {
      setIoError(e instanceof Error ? e.message : String(e))
    }
  }

  const confirmImport = () => {
    if (!preview?.ok || !preview.data) return
    const d = preview.data
    s.patch({
      ...(d.theme ? { theme: d.theme } : {}),
      foundationKind: d.foundationKind as typeof s.foundationKind,
      projectName: d.projectName,
      projectCode: d.projectCode,
      client: d.client,
      location: d.location,
      pileTypeId: d.pileTypeId,
      diameterCm: d.diameterCm,
      tipDepth_m: d.tipDepth_m,
      areaCm2: d.areaCm2,
      perimeterCm: d.perimeterCm,
      enlargedBaseVolumeLiters: d.enlargedBaseVolumeLiters,
      waterLevel_m: d.waterLevel_m,
      layers: d.layers,
      designLoad_kN: d.designLoad_kN,
      mode: d.mode as typeof s.mode,
      governingRule: d.governingRule as typeof s.governingRule,
      selectedMethod: d.selectedMethod as typeof s.selectedMethod,
      aokiFs: d.aokiFs,
      aokiPctTip: d.aokiPctTip,
      aokiPctShaft: d.aokiPctShaft,
      decourtAlphaPct: d.decourtAlphaPct,
      decourtBetaPct: d.decourtBetaPct,
      teixeiraFs: d.teixeiraFs,
      teixeiraPctTip: d.teixeiraPctTip,
      teixeiraPctShaft: d.teixeiraPctShaft,
      fck_MPa: d.fck_MPa,
      fyk_MPa: d.fyk_MPa,
      cover_mm: d.cover_mm,
      loadIsDesign: d.loadIsDesign,
      transverseKind: d.transverseKind,
      blockRows: d.blockRows,
      blockCols: d.blockCols,
      blockSpacing_m: d.blockSpacing_m,
      blockEdge_m: d.blockEdge_m,
      blockThickness_m: d.blockThickness_m,
      blockEmbedment_m: typeof d.blockEmbedment_m === 'number' ? d.blockEmbedment_m : 0.1,
      blockEfficiency: d.blockEfficiency,
      footingShape: d.footingShape as typeof s.footingShape,
      footingAdmMode: d.footingAdmMode as typeof s.footingAdmMode,
      footingSigmaAdm_kPa: d.footingSigmaAdm_kPa,
      footingAspect: d.footingAspect,
      footingThickness_m: d.footingThickness_m,
      footingC_kPa: d.footingC_kPa,
      footingPhi_deg: d.footingPhi_deg,
      footingGamma_kN_m3: d.footingGamma_kN_m3,
      footingDf_m: d.footingDf_m,
      footingFs: d.footingFs,
      footingMx_kNm: d.footingMx_kNm,
      footingMy_kNm: d.footingMy_kNm,
      caissonShaftDia_m: d.caissonShaftDia_m,
      caissonBaseDia_m: d.caissonBaseDia_m,
      caissonLength_m: d.caissonLength_m,
      caissonAdmMode: d.caissonAdmMode as typeof s.caissonAdmMode,
      caissonSigmaAdm_kPa: d.caissonSigmaAdm_kPa,
      caissonC_kPa: d.caissonC_kPa,
      caissonPhi_deg: d.caissonPhi_deg,
      caissonGamma_kN_m3: d.caissonGamma_kN_m3,
      caissonFsTip: d.caissonFsTip,
      caissonUnitFriction_kPa: d.caissonUnitFriction_kPa,
      caissonShaftFS: d.caissonShaftFS,
      caissonShaftMode: d.caissonShaftMode as typeof s.caissonShaftMode,
      raftAspect: d.raftAspect,
      raftAdmMode: d.raftAdmMode as typeof s.raftAdmMode,
      raftSigmaAdm_kPa: d.raftSigmaAdm_kPa,
      raftThickness_m: d.raftThickness_m,
      raftC_kPa: d.raftC_kPa,
      raftPhi_deg: d.raftPhi_deg,
      raftGamma_kN_m3: d.raftGamma_kN_m3,
      raftDf_m: d.raftDf_m,
      raftFs: d.raftFs,
      raftMx_kNm: d.raftMx_kNm,
      raftMy_kNm: d.raftMy_kNm,
      result: null,
      structural: null,
      blockResult: null,
      footingResult: null,
      caissonResult: null,
      raftResult: null,
      calcError: null,
    })
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section className="panel" data-testid="step-project">
      <h2>Dados do projeto</h2>
      <p className="lead">
        Identificação da obra. O nome amigável aparece no Dashboard e na biblioteca — use o nome real
        (ex.: Residência Família Silva), não um ID interno.
      </p>
      <ScopeBanner>
        Projeto inicia <strong>em branco</strong>. Para ver um caso pronto, use{' '}
        <strong>Carregar exemplo</strong> (estaca escavada Ø30 cm, abaixo ou na barra lateral) e
        depois confira a Capacidade. Com pilar, o produto usa bloco de coroamento (1E+); sapata/tubulão/radier são
        MVP geotécnicos com disclaimers.
      </ScopeBanner>
      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => s.loadReferenceExample()}
          data-testid="project-load-example"
        >
          Carregar exemplo (estaca escavada Ø30)
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => s.resetBlankProject()}
          data-testid="project-reset-blank"
        >
          Limpar projeto
        </button>
        <button
          type="button"
          className="btn"
          data-testid="project-back-library"
          onClick={() => {
            syncActiveToLibrary()
            setShellView('projects')
          }}
        >
          Voltar a Projetos
        </button>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="name">Nome do projeto</label>
          <input
            id="name"
            value={s.projectName ?? ''}
            onChange={(e) => s.patch({ projectName: e.target.value })}
            placeholder="Ex.: Residência Família Silva"
            data-testid="project-name-input"
          />
        </div>
        <div className="field">
          <label htmlFor="code">Código</label>
          <input id="code" value={s.projectCode ?? ''} onChange={(e) => s.patch({ projectCode: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="client">Cliente</label>
          <input id="client" value={s.client ?? ''} onChange={(e) => s.patch({ client: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="loc">Local</label>
          <input id="loc" value={s.location ?? ''} onChange={(e) => s.patch({ location: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="rt">Responsável técnico</label>
          <input
            id="rt"
            value={s.responsibleEngineer ?? ''}
            onChange={(e) => s.patch({ responsibleEngineer: e.target.value })}
            placeholder="Ex.: Eng. Lucas Stark"
          />
        </div>
        <div className="field">
          <label htmlFor="crea">Registro CREA / CAU</label>
          <input
            id="crea"
            value={s.engineerCrea ?? ''}
            onChange={(e) => s.patch({ engineerCrea: e.target.value })}
            placeholder="Ex.: CREA-SP 506070/D"
          />
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label>Logotipo da Empresa (White-Label para Carimbo das Pranchas e Memorial)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
            {s.companyLogoBase64 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <img src={s.companyLogoBase64} alt="Logotipo da empresa" style={{ height: '36px', maxWidth: '140px', objectFit: 'contain' }} />
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                  onClick={() => s.patch({ companyLogoBase64: undefined })}
                >
                  Remover
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      s.patch({ companyLogoBase64: reader.result });
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            )}
            <span className="hint">Aparece automaticamente no carimbo/selo ABNT de todas as folhas do projeto.</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="z0">Cota do terreno (m)</label>
          <input
            id="z0"
            type="number"
            value={s.groundElevation_m ?? ''}
            onChange={(e) =>
              s.patch({
                groundElevation_m: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="units">Sistema de unidades</label>
          <input id="units" value="SI (kN, m, MPa) — motor interno" readOnly />
          <span className="hint">Conversão centralizada no engine; UI sempre rotulada.</span>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '1rem' }}>
        <div className="field">
          <label htmlFor="proj-import">Importar projeto (JSON)</label>
          <input
            id="proj-import"
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
          />
          <span className="hint">Snapshot de inputs (DEC-29) — preview + confirmação; resultados são limpos.</span>
        </div>
        <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" className="btn" onClick={exportProject}>
            Exportar projeto JSON
          </button>
        </div>
      </div>

      {ioError && <div className="error-box">{ioError}</div>}

      {preview && (
        <div className="scope-banner" role="status" style={{ marginTop: '1rem' }}>
          <strong>
            Preview projeto — {preview.data?.projectName || '(sem nome)'} /{' '}
            {preview.data?.foundationKind || '?'}
            {preview.ok ? '' : ' — com erros'}
          </strong>
          {preview.errors.map((e) => (
            <div key={e} className="error-box" style={{ marginTop: '0.35rem' }}>
              {e}
            </div>
          ))}
          {preview.warnings.map((w) => (
            <div key={w} style={{ marginTop: '0.25rem' }}>
              Aviso: {w}
            </div>
          ))}
          {preview.ok && preview.data && (
            <p className="hint" style={{ marginTop: '0.5rem' }}>
              {preview.data.layers.length} camada(s) · carga{' '}
              {preview.data.designLoad_kN ?? '—'} kN · modo {preview.data.mode}
            </p>
          )}
          <div className="actions" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!preview.ok}
              onClick={confirmImport}
            >
              Confirmar importação
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPreview(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <FlowNavButtons primaryLabel="Continuar · Sondagem" />
    </section>
  )
}
