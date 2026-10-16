import { useEffect, useState } from 'react'
import { foundationKindLabelPt } from '@assist/index'
import { PILE_TYPES } from '@engine/catalogs'
import type { PileSolutionCandidate } from '@conception/index'
import { ColumnReviewTable } from '../ColumnReviewTable'
import { useProjectStore } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'

function typeName(id: number): string {
  return PILE_TYPES.find((p) => p.id === id)?.name ?? `tipo ${id}`
}

function optionKey(c: PileSolutionCandidate): string {
  return `${c.pileTypeId}|${c.diameterCm}|${c.tipDepth_m}|${c.nPiles}`
}

export function StepAnalysis() {
  const columns = useProjectStore((s) => s.columns)
  const layers = useProjectStore((s) => s.layers)
  const waterLevel_m = useProjectStore((s) => s.waterLevel_m)
  const activeColumnId = useProjectStore((s) => s.activeColumnId)
  const loadIsDesign = useProjectStore((s) => s.loadIsDesign)
  const footingSigmaAdm_kPa = useProjectStore((s) => s.footingSigmaAdm_kPa)
  const suggestion = useProjectStore((s) => s.foundationSuggestion)
  const conception = useProjectStore((s) => s.conceptionResult)
  const runFoundationAnalysis = useProjectStore((s) => s.runFoundationAnalysis)
  const acceptFoundationSuggestion = useProjectStore((s) => s.acceptFoundationSuggestion)
  const applyConception = useProjectStore((s) => s.applyConception)
  const setActiveColumn = useProjectStore((s) => s.setActiveColumn)
  const patchColumnById = useProjectStore((s) => s.patchColumnById)
  const foundationKind = useProjectStore((s) => s.foundationKind)
  const pileTypeId = useProjectStore((s) => s.pileTypeId)
  const diameterCm = useProjectStore((s) => s.diameterCm)
  const tipDepth_m = useProjectStore((s) => s.tipDepth_m)

  const [exploreOpen, setExploreOpen] = useState(false)

  const loadKey = columns.map((c) => `${c.id}:${c.N_kN}:${c.Mx_kNm}:${c.My_kNm}`).join('|')
  const soilKey = layers.map((l) => `${l.depth_m}:${l.nspt}`).join('|') + `|${waterLevel_m}`

  useEffect(() => {
    runFoundationAnalysis()
  }, [loadKey, soilKey, loadIsDesign, footingSigmaAdm_kPa, runFoundationAnalysis])

  const rec = conception?.recommended
  // Só diz "aplicada" quando o projeto está mesmo com essa estaca; senão a concepção é referência.
  const recApplied =
    rec != null &&
    (foundationKind === 'pile' || foundationKind === 'pile_cap') &&
    pileTypeId === rec.pileTypeId &&
    diameterCm === rec.diameterCm &&
    tipDepth_m === rec.tipDepth_m
  const topOptions = conception?.topOptions ?? []

  return (
    <section className="panel" data-testid="step-analysis">
      <h2>Análise de solução</h2>
      <p className="lead">
        O motor cruza cargas com a sondagem e sugere tipo de fundação. Em seguida dimensiona
        automaticamente Ø (≥ 25 cm), comprimento e quantidade de estacas. Confirme na próxima
        etapa — não é ART.
      </p>

      {suggestion == null ? (
        <p className="hint">Calculando sugestão…</p>
      ) : (
        <>
          <div className="scope-banner" role="status" data-testid="analysis-soil" style={{ marginBottom: '0.75rem' }}>
            <strong>Perfil raso (sondagem)</strong>
            <ul className="hint" style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
              <li>
                Camadas: {suggestion.soil.layerCount}
                {suggestion.soil.shallowMeanNspt != null
                  ? ` · N̄ raso ≈ ${suggestion.soil.shallowMeanNspt.toFixed(1)}`
                  : ''}
                {suggestion.soil.shallowMinNspt != null
                  ? ` · Nmín ≈ ${suggestion.soil.shallowMinNspt}`
                  : ''}
              </li>
              <li>
                σadm efetivo: {suggestion.soil.sigmaAdmEffective_kPa.toFixed(0)} kPa
                {suggestion.soil.sigmaAdmFromSpt_kPa != null
                  ? ` (SPT~${suggestion.soil.sigmaAdmFromSpt_kPa.toFixed(0)} kPa)`
                  : ''}
              </li>
              {suggestion.soil.softShallow && <li>Alerta: solo raso fraco — sapata desfavorecida.</li>}
              {suggestion.soil.highWaterTable && <li>Alerta: nível d&apos;água raso (&lt; 2 m).</li>}
            </ul>
          </div>

          <div className="scope-banner" role="status" data-testid="analysis-suggestion">
            <strong>
              Sugestão do projeto:{' '}
              {foundationKindLabelPt[suggestion.suggestedKind] ?? suggestion.suggestedKind}
            </strong>
            <ul className="hint" style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
              {suggestion.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {conception != null && (
            <div
              className="scope-banner"
              role="status"
              data-testid="analysis-conception"
              style={{ marginTop: '0.75rem' }}
            >
              <strong>Concepção automática (Ø × L × n)</strong>
              {rec ? (
                <p className="hint" style={{ margin: '0.4rem 0 0' }}>
                  {conception.summary}
                </p>
              ) : (
                <div className="error-box" role="status" style={{ marginTop: '0.5rem' }}>
                  {conception.summary}
                </div>
              )}
              {conception.shallowNote && (
                <p className="hint" style={{ margin: '0.35rem 0 0' }}>
                  {conception.shallowNote}
                </p>
              )}
              {conception.profile.zones.length > 0 && (
                <p className="hint" style={{ margin: '0.35rem 0 0' }}>
                  Zonas:{' '}
                  {conception.profile.zones
                    .map((z) => `${z.from_m.toFixed(0)}–${z.to_m.toFixed(0)} m ${z.label}`)
                    .join(' · ')}
                  {' · '}confiança {conception.confidence}
                  {conception.evaluatedCount > 0 ? ` · ${conception.evaluatedCount} candidatos` : ''}
                </p>
              )}
              {rec && (
                <ul className="hint" style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
                  <li>
                    Recomendado: {rec.nPiles}× {typeName(rec.pileTypeId)} Ø{rec.diameterCm} cm ×{' '}
                    {rec.tipDepth_m.toFixed(1)} m · Padm {rec.padmGoverning_kN.toFixed(0)} kN ·
                    utilização {(rec.utilization * 100).toFixed(0)}% · score {rec.score}
                  </li>
                </ul>
              )}

              {rec && (
                <p className="hint" style={{ margin: '0.5rem 0 0', fontWeight: 600 }}>
                  {recApplied
                    ? 'Esta solução já está aplicada no projeto. Só mexa se quiser outra.'
                    : `O projeto está com ${foundationKindLabelPt[foundationKind] ?? foundationKind}; esta concepção fica como referência.`}
                </p>
              )}

              <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="btn"
                  data-testid="conception-explore"
                  disabled={topOptions.length === 0}
                  onClick={() => setExploreOpen((o) => !o)}
                >
                  {exploreOpen ? 'Ocultar opções' : `Explorar mais opções (${topOptions.length})`}
                </button>
                {rec && (
                  <button
                    type="button"
                    className="btn"
                    data-testid="conception-apply-recommended"
                    onClick={() => applyConception('recommended')}
                  >
                    Restaurar recomendada
                  </button>
                )}
              </div>

              {exploreOpen && topOptions.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: '0.75rem' }} data-testid="conception-explore-table">
                  <p className="hint" style={{ marginTop: 0 }}>
                    Opções ranqueadas (Ø ≥ 25 cm). Escolha uma para aplicar no projeto.
                  </p>
                  <table className="loads-table" aria-label="Opções de concepção">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tipo</th>
                        <th>Ø</th>
                        <th>L (m)</th>
                        <th>n</th>
                        <th>Padm</th>
                        <th>Util.</th>
                        <th>Vol. m³</th>
                        <th>Score</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {topOptions.map((c, i) => {
                        const isRec = rec != null && optionKey(c) === optionKey(rec)
                        return (
                          <tr key={optionKey(c)} className={isRec ? 'loads-row-active' : undefined}>
                            <td>{i + 1}{isRec ? ' ★' : ''}</td>
                            <td>{typeName(c.pileTypeId)}</td>
                            <td>{c.diameterCm}</td>
                            <td>{c.tipDepth_m.toFixed(1)}</td>
                            <td>{c.nPiles}</td>
                            <td>{c.padmGoverning_kN.toFixed(0)}</td>
                            <td>{(c.utilization * 100).toFixed(0)}%</td>
                            <td>{c.pileConcrete_m3.toFixed(2)}</td>
                            <td>{c.score.toFixed(2)}</td>
                            <td>
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                data-testid={`conception-pick-${i}`}
                                onClick={() => applyConception(c)}
                              >
                                Aplicar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <h3 style={{ marginTop: '1.25rem', fontSize: '1rem' }}>Revisão por pilar</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Clique no pilar para ativá-lo e edite N (kN) na célula. A análise e a concepção
            recalculam automaticamente. Diâmetro padronizado pela maioria quando há vários pilares.
          </p>
          <ColumnReviewTable
            columns={columns}
            activeColumnId={activeColumnId}
            probes={suggestion.probes}
            showCaps={false}
            editableN
            onSelect={setActiveColumn}
            onChangeN={(id, N_kN) => patchColumnById(id, { N_kN })}
            testId="analysis-column-review"
          />

          <p className="hint" style={{ marginTop: '0.75rem' }}>
            Alternativas globais:{' '}
            {suggestion.alternatives.map((k) => foundationKindLabelPt[k] ?? k).join(', ')}.
          </p>
        </>
      )}

      <FlowNavButtons
        primaryLabel="Continuar · Fundação e geometria"
        onPrimary={() => {
          if (suggestion == null) return false
          acceptFoundationSuggestion()
          return false
        }}
        extra={
          <button
            type="button"
            className="btn"
            data-testid="analysis-rerun"
            onClick={() => runFoundationAnalysis()}
          >
            Recalcular análise
          </button>
        }
      />
    </section>
  )
}
