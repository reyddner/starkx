import { Suspense, lazy } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { ScopeBanner, SHALLOW_MVP_TEXT } from '../ScopeBanner'
import { FlowNavButtons } from '../FlowNavButtons'
import { AssistPanel } from '../AssistPanel'
import { DesignChecksList } from '../DesignChecksList'
import { ColumnReviewTable } from '../ColumnReviewTable'
import { analyzeAssist } from '@assist/index'
import type { AssistInput } from '@assist/index'

const CapacityCharts = lazy(() =>
  import('../CapacityCharts').then((m) => ({ default: m.CapacityCharts })),
)

const METHOD_LABEL: Record<string, string> = {
  aoki_velloso: 'Aoki-Velloso',
  decourt_quaresma: 'Décourt-Quaresma',
  teixeira: 'Teixeira',
  average: 'Média',
  minimum: 'Mínimo',
}

function fmt(n: number, digits = 2) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function StepResults() {
  const s = useProjectStore()
  const r = s.result
  const fr = s.footingResult

  if (s.foundationKind === 'footing') {
    if (!fr) {
      return (
        <section className="panel">
          <h2>Resultados — sapata</h2>
          <p className="lead">
            A sapata ainda não foi dimensionada. Confira a carga e a geometria e rode o
            dimensionamento.
          </p>
          {s.calcError && <div className="error-box">{s.calcError}</div>}
          <FlowNavButtons
            primaryLabel="Dimensionar sapata"
            onPrimary={() => {
              s.runFootingDesign()
              return false
            }}
          />
        </section>
      )
    }
    const ok = fr.checks.every((c) => c.status !== 'error')
    const shallowFindings = analyzeAssist({
      foundationKind: 'footing',
      shallow: {
        kind: 'footing',
        Nd_kN: fr.Nd_kN,
        qadm_kPa: fr.qadm_kPa,
        sigmaMax_kPa: fr.sigmaMax_kPa,
        hasErrors: fr.checks.some((c) => c.status === 'error'),
        hasWarnings: fr.checks.some((c) => c.status === 'warning') || fr.warnings.length > 0,
        rebarMessage: fr.rebar?.message ?? null,
      },
    })
    const applyShallowPatch = (patch: Record<string, number | string | boolean | null>) => {
      s.patch(patch as Parameters<typeof s.patch>[0])
      s.runFootingDesign()
    }
    return (
      <>
        <AssistPanel findings={shallowFindings} onApply={applyShallowPatch} />
        <section className="panel">
          <ScopeBanner>{SHALLOW_MVP_TEXT}</ScopeBanner>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2>Resultados — sapata</h2>
              <p className="lead" style={{ marginBottom: 0 }}>
                {s.projectName} · Vesic / σadm · Nd = {fmt(fr.Nd_kN)} kN
              </p>
            </div>
            <span className={`badge ${ok ? 'badge-ok' : 'badge-fail'}`}>
              {ok ? 'VERIFICAÇÕES OK' : 'VERIFICAR'}
            </span>
          </div>
          <div className="kpi-row" style={{ marginTop: '1rem' }}>
            <div className="kpi">
              <div className="label">B × L</div>
              <div className="value" style={{ fontSize: '1.05rem' }}>
                {fmt(fr.B_m)}×{fmt(fr.L_m)} m
              </div>
            </div>
            <div className="kpi">
              <div className="label">Área</div>
              <div className="value">
                {fmt(fr.area_m2)}
                <span className="unit">m²</span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">qadm</div>
              <div className="value">
                {fmt(fr.qadm_kPa, 1)}
                <span className="unit">kPa</span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">σméd / σmáx</div>
              <div className="value" style={{ fontSize: '1.05rem' }}>
                {fmt(fr.sigmaAvg_kPa, 1)} / {fmt(fr.sigmaMax_kPa, 1)}
              </div>
            </div>
          </div>
          {fr.warnings.map((w) => (
            <div
              key={w}
              className="error-box"
              style={{ background: 'var(--warn-soft)', color: 'var(--warn)', marginTop: '0.75rem' }}
            >
              {w}
            </div>
          ))}
          {fr.rebar && (
            <p className="hint" style={{ marginTop: '0.75rem' }}>
              {fr.rebar.message}
            </p>
          )}
          <DesignChecksList checks={fr.checks} />
          <FlowNavButtons
            primaryLabel="Continuar · Desenhos"
            extra={
              <button type="button" className="btn" onClick={() => s.patch({ showTraces: !s.showTraces })}>
                {s.showTraces ? 'Ocultar' : 'Ver'} traços de cálculo
              </button>
            }
          />
          {s.showTraces &&
            fr.traces.map((t, i) => (
              <div className="trace" key={i}>
                <h4>
                  {t.title} <span className="hint">· {t.reference}</span>
                </h4>
                <div>{t.formula}</div>
                <div>
                  → <strong>{typeof t.result === 'number' ? fmt(Number(t.result), 4) : t.result}</strong>{' '}
                  {t.unit}
                </div>
              </div>
            ))}
        </section>
      </>
    )
  }

  if (s.foundationKind === 'caisson') {
    const cr = s.caissonResult
    if (!cr) {
      return (
        <section className="panel">
          <h2>Resultados — tubulão</h2>
          <p className="lead">
            O tubulão ainda não foi dimensionado. Confira a carga e a geometria e rode o
            dimensionamento.
          </p>
          {s.calcError && <div className="error-box">{s.calcError}</div>}
          <FlowNavButtons
            primaryLabel="Dimensionar tubulão"
            onPrimary={() => {
              s.runCaissonDesign()
              return false
            }}
          />
        </section>
      )
    }
    const ok = cr.verdict === 'approved'
    const caissonFindings = analyzeAssist({
      foundationKind: 'caisson',
      shallow: {
        kind: 'caisson',
        Nd_kN: cr.Nd_kN,
        capacity_kN: cr.Padm_kN,
        hasErrors: cr.verdict !== 'approved',
        hasWarnings: cr.warnings.length > 0,
        rebarMessage: cr.rebar?.message ?? null,
      },
    })
    const applyCaissonPatch = (patch: Record<string, number | string | boolean | null>) => {
      s.patch(patch as Parameters<typeof s.patch>[0])
      s.runCaissonDesign()
    }
    return (
      <>
        <AssistPanel findings={caissonFindings} onApply={applyCaissonPatch} />
        <section className="panel">
        <ScopeBanner>{SHALLOW_MVP_TEXT}</ScopeBanner>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2>Resultados — tubulão</h2>
            <p className="lead" style={{ marginBottom: 0 }}>
              {s.projectName} · Nd = {fmt(cr.Nd_kN)} kN · fuste{' '}
              {cr.shaftMode === 'spt_aoki' ? 'α·NSPT' : 'fs informado'}
            </p>
          </div>
          <span className={`badge ${ok ? 'badge-ok' : 'badge-fail'}`}>
            {ok ? 'ATENDE' : 'NÃO ATENDE'}
          </span>
        </div>
        <div className="kpi-row" style={{ marginTop: '1rem' }}>
          <div className="kpi">
            <div className="label">Padm</div>
            <div className="value">
              {fmt(cr.Padm_kN, 1)}
              <span className="unit">kN</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">Rp adm</div>
            <div className="value">
              {fmt(cr.Rp_adm_kN, 1)}
              <span className="unit">kN</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">Rl adm</div>
            <div className="value">
              {fmt(cr.Rl_adm_kN, 1)}
              <span className="unit">kN</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">Db / L</div>
            <div className="value" style={{ fontSize: '1.05rem' }}>
              {fmt(cr.baseDiameter_m)} m / {fmt(cr.length_m)} m
            </div>
          </div>
        </div>
        {cr.rebar && (
          <p className="hint" style={{ marginTop: '0.75rem' }}>
            {cr.rebar.message}
          </p>
        )}
        {cr.warnings.map((w) => (
          <div
            key={w}
            className="error-box"
            style={{ background: 'var(--warn-soft)', color: 'var(--warn)', marginTop: '0.75rem' }}
          >
            {w}
          </div>
        ))}
        <DesignChecksList checks={cr.checks} />
        <FlowNavButtons
          primaryLabel="Continuar · Desenhos"
          extra={
            <button type="button" className="btn" onClick={() => s.patch({ showTraces: !s.showTraces })}>
              {s.showTraces ? 'Ocultar' : 'Ver'} traços de cálculo
            </button>
          }
        />
        {s.showTraces &&
          cr.traces.map((t, i) => (
            <div className="trace" key={i}>
              <h4>
                {t.title} <span className="hint">· {t.reference}</span>
              </h4>
              <div>{t.formula}</div>
              <div>
                → <strong>{typeof t.result === 'number' ? fmt(Number(t.result), 4) : t.result}</strong>{' '}
                {t.unit}
              </div>
            </div>
          ))}
      </section>
      </>
    )
  }

  if (s.foundationKind === 'raft') {
    const rr = s.raftResult
    if (!rr) {
      return (
        <section className="panel">
          <h2>Resultados — radier</h2>
          <p className="lead">
            O radier ainda não foi dimensionado. Confira a carga e a geometria e rode o
            dimensionamento.
          </p>
          {s.calcError && <div className="error-box">{s.calcError}</div>}
          <FlowNavButtons
            primaryLabel="Dimensionar radier"
            onPrimary={() => {
              s.runRaftDesign()
              return false
            }}
          />
        </section>
      )
    }
    const ok = rr.checks.every((c) => c.status !== 'error')
    const raftFindings = analyzeAssist({
      foundationKind: 'raft',
      shallow: {
        kind: 'raft',
        Nd_kN: rr.Nd_kN,
        qadm_kPa: rr.qadm_kPa,
        sigmaMax_kPa: rr.sigmaMax_kPa,
        hasErrors: rr.checks.some((c) => c.status === 'error'),
        hasWarnings: rr.checks.some((c) => c.status === 'warning') || rr.warnings.length > 0,
        rebarMessage: rr.rebar?.message ?? null,
      },
    })
    const applyRaftPatch = (patch: Record<string, number | string | boolean | null>) => {
      s.patch(patch as Parameters<typeof s.patch>[0])
      s.runRaftDesign()
    }
    return (
      <>
        <AssistPanel findings={raftFindings} onApply={applyRaftPatch} />
        <section className="panel">
        <ScopeBanner>{SHALLOW_MVP_TEXT}</ScopeBanner>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2>Resultados — radier</h2>
            <p className="lead" style={{ marginBottom: 0 }}>
              {s.projectName} · Nd = {fmt(rr.Nd_kN)} kN
            </p>
          </div>
          <span className={`badge ${ok ? 'badge-ok' : 'badge-fail'}`}>
            {ok ? 'VERIFICAÇÕES OK' : 'VERIFICAR'}
          </span>
        </div>
        <div className="kpi-row" style={{ marginTop: '1rem' }}>
          <div className="kpi">
            <div className="label">B × L</div>
            <div className="value" style={{ fontSize: '1.05rem' }}>
              {fmt(rr.B_m)}×{fmt(rr.L_m)} m
            </div>
          </div>
          <div className="kpi">
            <div className="label">Área</div>
            <div className="value">
              {fmt(rr.area_m2)}
              <span className="unit">m²</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">qadm</div>
            <div className="value">
              {fmt(rr.qadm_kPa, 1)}
              <span className="unit">kPa</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">σméd / σmáx</div>
            <div className="value" style={{ fontSize: '1.05rem' }}>
              {fmt(rr.sigmaAvg_kPa, 1)} / {fmt(rr.sigmaMax_kPa, 1)}
            </div>
          </div>
        </div>
        {rr.warnings.map((w) => (
          <div
            key={w}
            className="error-box"
            style={{ background: 'var(--warn-soft)', color: 'var(--warn)', marginTop: '0.75rem' }}
          >
            {w}
          </div>
        ))}
        {rr.rebar && (
          <p className="hint" style={{ marginTop: '0.75rem' }}>
            {rr.rebar.message}
          </p>
        )}
        <DesignChecksList checks={rr.checks} />
        <FlowNavButtons
          primaryLabel="Continuar · Desenhos"
          extra={
            <button type="button" className="btn" onClick={() => s.patch({ showTraces: !s.showTraces })}>
              {s.showTraces ? 'Ocultar' : 'Ver'} traços de cálculo
            </button>
          }
        />
        {s.showTraces &&
          rr.traces.map((t, i) => (
            <div className="trace" key={i}>
              <h4>
                {t.title} <span className="hint">· {t.reference}</span>
              </h4>
              <div>{t.formula}</div>
              <div>
                → <strong>{typeof t.result === 'number' ? fmt(Number(t.result), 4) : t.result}</strong>{' '}
                {t.unit}
              </div>
            </div>
          ))}
      </section>
      </>
    )
  }

  if (!r) {
    return (
      <section className="panel">
        <h2>Capacidade</h2>
        <p className="lead">
          A capacidade ainda não foi calculada. Confira o tipo, o diâmetro e o comprimento da estaca
          na etapa anterior e rode o cálculo.
        </p>
        {s.calcError && <div className="error-box">{s.calcError}</div>}
        <FlowNavButtons
          primaryLabel="Calcular capacidade"
          onPrimary={() => {
            s.runCalculation()
            return false
          }}
          extra={
            <button type="button" className="btn" onClick={() => s.setStep('methods')}>
              Alterar métodos
            </button>
          }
        />
      </section>
    )
  }

  const verdictClass =
    r.verdict === 'approved' ? 'badge-ok' : r.verdict === 'not_ok' ? 'badge-fail' : 'badge-na'
  const verdictLabel =
    r.verdict === 'approved' ? 'APROVADO' : r.verdict === 'not_ok' ? 'NÃO ATENDE' : 'SEM VEREDITO'

  const chartData = [...r.profile].map((p) => ({
    depth: p.depth_m,
    nspt: p.nspt,
    aoki: p.aoki?.Padm_kN ?? null,
    decourt: p.decourt?.Padm_kN ?? null,
    teixeira: p.teixeira?.Padm_kN ?? null,
    media: p.averagePadm_kN ?? null,
  }))

  const maxLayerDepth = s.layers.reduce((m, l) => Math.max(m, l.depth_m), 0)
  const assistInput: AssistInput = {
    foundationKind: s.foundationKind === 'pile_cap' ? 'pile_cap' : 'pile',
    pile: {
      tipDepth_m: s.tipDepth_m,
      diameterCm: s.diameterCm,
      designLoad_kN: s.designLoad_kN,
      mode: r.mode,
      governingPadm_kN: r.atTip.governingPadm_kN,
      averagePadm_kN: r.atTip.averagePadm_kN,
      minimumPadm_kN: r.atTip.minimumPadm_kN,
      verdict: r.verdict,
      governingMethodId: String(r.atTip.governingMethodId),
      layerCount: s.layers.length,
      maxLayerDepth_m: maxLayerDepth,
      warnings: r.warnings,
      nominal_kN: r.nominalStructural?.nominal_kN ?? null,
      nominalExceeded: r.nominalStructural?.exceeded ?? false,
    },
    block:
      s.foundationKind === 'pile_cap' && s.blockResult
        ? {
            efficiencyUserProvided: s.blockResult.efficiencyUserProvided,
            groupCapacityIndicative: s.blockResult.groupCapacityIndicative,
            capacityOk: s.blockResult.capacityOk,
            punchingOk: s.blockResult.punching?.ok ?? null,
            strutOk: s.blockResult.strutTie?.ok ?? null,
          }
        : null,
  }
  // Só Assist pós-cálculo — projectAlerts ficam no banner global (sem duplicar).
  const assistFindings = analyzeAssist(assistInput)

  const applyAssistPatch = (patch: Record<string, number | string | boolean | null>) => {
    s.patch(patch as Parameters<typeof s.patch>[0])
    s.runCalculation({ preserveStep: true })
    if (s.foundationKind === 'pile_cap') s.runBlockDesign()
  }

  return (
    <>
      <AssistPanel findings={assistFindings} onApply={applyAssistPatch} />
      <section className="panel" data-testid="results-dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2>Dashboard de resultados</h2>
            <p className="lead" style={{ marginBottom: 0 }}>
              {s.projectName} · governante {METHOD_LABEL[r.atTip.governingMethodId] ?? r.atTip.governingMethodId}
            </p>
          </div>
          <span className={`badge ${verdictClass}`}>{verdictLabel}</span>
        </div>

        {s.columns.length > 0 && (
          <div
            className="scope-banner"
            style={{ marginTop: '1rem' }}
            data-testid="results-columns-summary"
            role="region"
            aria-label="Pilares cadastrados"
          >
            <strong>Revisão dos pilares</strong>
            <p className="hint" style={{ margin: '0.35rem 0 0' }}>
              Clique para ativar · «Revisar» abre o bloco/arranjo daquele pilar (DEC-55). Padm da
              estaca é compartilhado.
            </p>
            <ColumnReviewTable
              columns={s.columns}
              activeColumnId={s.activeColumnId}
              probes={s.foundationSuggestion?.probes}
              showCaps
              onSelect={(id) => s.setActiveColumn(id)}
              onReview={(id) => {
                s.setActiveColumn(id)
                if (s.foundationKind === 'pile_cap') s.setStep('block')
                else s.setStep('foundation')
              }}
              testId="results-columns-caps"
            />
            {s.foundationKind === 'pile_cap' && s.result != null && (
              <div style={{ marginTop: '0.65rem' }}>
                <button
                  type="button"
                  className="btn"
                  data-testid="dimension-all-columns-results"
                  onClick={() => s.runAllColumnCaps()}
                >
                  Dimensionar blocos de todos
                </button>
              </div>
            )}
          </div>
        )}

        <div className="kpi-row" style={{ marginTop: '1rem' }} data-testid="results-kpi-row">
          <div className="kpi" data-testid="results-padm-governing">
            <div className="label">Padm governante</div>
            <div className="value">
              {fmt(r.atTip.governingPadm_kN)}
              <span className="unit">kN</span>
            </div>
          </div>
          {s.foundationKind === 'pile_cap' && s.blockResult?.groupPadm_kN != null && (
            <div className="kpi">
              <div className="label">
                Padm grupo
                {s.blockResult.groupCapacityIndicative ? ' (indicativo)' : ''}
              </div>
              <div className="value">
                {fmt(s.blockResult.groupPadm_kN)}
                <span className="unit">kN</span>
              </div>
            </div>
          )}
          <div className="kpi" data-testid="results-padm-average">
            <div className="label">Média dos métodos</div>
            <div className="value">
              {fmt(r.atTip.averagePadm_kN)}
              <span className="unit">kN</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">Mínimo</div>
            <div className="value">
              {fmt(r.atTip.minimumPadm_kN)}
              <span className="unit">kN</span>
            </div>
          </div>
          {r.nominalStructural && (
            <div className="kpi" data-testid="results-nominal">
              <div className="label">
                carga estrutural usual{r.nominalStructural.exceeded ? ' ⚠' : ''}
              </div>
              <div className="value">
                {fmt(r.nominalStructural.nominal_kN, 0)}
                <span className="unit">kN</span>
              </div>
            </div>
          )}
          {r.nominalStructural && (
            <div className="kpi" data-testid="results-governing-adopted">
              <div className="label">min(Padm, Q nom.) — só alerta</div>
              <div className="value">
                {fmt(
                  Math.min(r.atTip.governingPadm_kN, r.nominalStructural.nominal_kN),
                  1,
                )}
                <span className="unit">kN</span>
              </div>
            </div>
          )}
          <div className="kpi">
            <div className="label">Geometria</div>
            <div className="value" style={{ fontSize: '1.05rem' }}>
              Ø {r.geometry.diameter_cm} cm
              {s.foundationKind === 'pile_cap' && s.blockResult
                ? ` · ${s.blockResult.pileCount} est.`
                : ''}
            </div>
          </div>
        </div>

        {r.nominalStructural?.exceeded && (
          <div
            className="error-box"
            style={{ background: 'var(--warn-soft)', color: 'var(--warn)', marginTop: '0.75rem' }}
            role="status"
          >
            {r.nominalStructural.message}
          </div>
        )}
        {r.nominalStructural && (
          <p className="hint" style={{ marginTop: '0.5rem' }}>
            O valor min(Padm, carga estrutural usual) é apenas comparativo (DEC-09). Grupo, bloco e
            armadura usam o <strong>Padm governante</strong> geotécnico — não este mínimo.
          </p>
        )}

        {s.foundationKind === 'pile_cap' && s.blockResult && (
          <div className="scope-banner" role="status" style={{ marginTop: '0.75rem' }}>
            {s.blockResult.capacityOk === false && 'Carga do bloco supera Padm do grupo (η informada).'}
            {s.blockResult.capacityOk === true &&
              'Carga do bloco ≤ Padm do grupo com η informada pelo usuário (não calculada pelo STARKX).'}
            {s.blockResult.groupCapacityIndicative &&
              s.blockResult.capacityOk == null &&
              'Padm do grupo indicativo (η=1). Informe η na etapa Bloco para veredito de projeto.'}
          </div>
        )}

        {(() => {
          const hard = r.warnings.filter(
            (w) => !/2 m abaixo|~2 m abaixo|DEC-47|INDICATIVO|η\s*=/i.test(w),
          )
          if (hard.length === 0) return null
          return (
            <div className="error-box" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              {hard.join(' ')}
            </div>
          )
        })()}
      </section>

      <section className="panel">
        <h2>Comparação de métodos (cota de apoio)</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="left">Método</th>
                <th>Qs / Rl (kN)</th>
                <th>Qp / Rp (kN)</th>
                <th>Qult (kN)</th>
                <th>Qadm (kN)</th>
              </tr>
            </thead>
            <tbody>
              {r.atTip.methods.map((m) => (
                <tr
                  key={m.methodId}
                  className={
                    r.atTip.governingMethodId === m.methodId ||
                    (r.atTip.governingMethodId === 'minimum' &&
                      m.Padm_kN === r.atTip.minimumPadm_kN)
                      ? 'governing'
                      : undefined
                  }
                >
                  <td className="left">{METHOD_LABEL[m.methodId]}</td>
                  <td>{fmt(m.Rl_acum_kN)}</td>
                  <td>{fmt(m.Rp_kN)}</td>
                  <td>{fmt(m.Rult_kN)}</td>
                  <td>{fmt(m.Padm_kN)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Suspense fallback={<section className="panel"><p className="hint">Carregando gráficos…</p></section>}>
        <CapacityCharts chartData={chartData} />
      </Suspense>

      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Ver cálculo</h2>
          <button type="button" className="btn" onClick={() => s.patch({ showTraces: !s.showTraces })}>
            {s.showTraces ? 'Ocultar' : 'Mostrar'} traces
          </button>
        </div>
        <p className="lead">Transparência do motor determinístico (fórmulas + valores).</p>
        {s.showTraces &&
          r.traces.map((t) => (
            <div className="trace" key={t.stepId}>
              <h4>
                {t.title}{' '}
                <span className="hint">
                  · {t.methodId} · {t.reference}
                </span>
              </h4>
              <div>{t.formula}</div>
              <div>
                {Object.entries(t.substitutions)
                  .map(([k, v]) => `${k}=${typeof v === 'number' ? fmt(v, 4) : v}`)
                  .join(' · ')}
              </div>
              <div>
                → <strong>{typeof t.result === 'number' ? fmt(t.result, 4) : t.result}</strong> {t.unit}
              </div>
            </div>
          ))}

        <FlowNavButtons
          extra={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => s.setStep('methods')}
                data-testid="results-change-methods"
              >
                Alterar métodos
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => s.setStep('rebar')}
                data-testid="results-open-rebar"
              >
                Ver armadura
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => s.setStep('tip_sweep')}
                data-testid="results-tip-sweep"
              >
                Cota de apoio
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => s.runCalculation({ preserveStep: true })}
              >
                Recalcular
              </button>
            </>
          }
        />
      </section>
    </>
  )
}
