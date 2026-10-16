import { useProjectStore } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'

function fmt(n: number, d = 2) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d })
}

export function StepRebar() {
  const s = useProjectStore()
  const r = s.structural
  const padm = s.result?.atTip.governingPadm_kN
  const nPile =
    s.foundationKind === 'pile_cap'
      ? Math.max(1, Math.floor(s.blockRows) * Math.floor(s.blockCols))
      : 1
  const nkUsed = s.resolvePileNk_kN()
  const mkUsed = s.resolvePileMk_kNm()
  const vkUsed = s.resolvePileVk_kN()

  return (
    <section className="panel" data-testid="step-rebar">
      <h2>Dimensionamento da armadura</h2>
      <p className="lead">
        NBR 6122:2019 + detalhamento NBR 6118. Motor em <code>structural-engine</code>.
        Sem M/V → compressão centrada. Com Mx/My ou Qx/Qy nas cargas →{' '}
        <strong>flexo-compressão por integração da seção e cortante pelo Modelo I</strong> (NBR 6118),
        sem efeitos de 2ª ordem.
        {s.foundationKind === 'pile_cap' && (
          <>
            {' '}
            Em bloco, Nk usa <strong>Nmáx do grupo</strong> se calculado; senão N/{nPile}. M e V são
            rateados por {nPile} (MVP).
          </>
        )}
      </p>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="fck">fck (MPa) — vazio = padrão do motor</label>
          <input
            id="fck"
            type="number"
            placeholder="auto"
            value={s.fck_MPa ?? ''}
            onChange={(e) =>
              s.patch({ fck_MPa: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="fyk">fyk (MPa)</label>
          <input
            id="fyk"
            type="number"
            value={s.fyk_MPa}
            onChange={(e) => s.patch({ fyk_MPa: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="cov">Cobrimento (mm)</label>
          <input
            id="cov"
            type="number"
            value={s.cover_mm}
            onChange={(e) => s.patch({ cover_mm: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="tk">Transversal</label>
          <select
            id="tk"
            value={s.transverseKind}
            onChange={(e) =>
              s.patch({ transverseKind: e.target.value as 'stirrup' | 'spiral' })
            }
          >
            <option value="spiral">Espiral</option>
            <option value="stirrup">Estribo</option>
          </select>
        </div>
        <div className="field">
          <label>Natureza da carga</label>
          <p className="hint" style={{ margin: 0 }}>
            {s.loadIsDesign ? 'Nd/Msd/Vsd diretos (γf = 1)' : 'Nk/Mk/Vk × 1,4'} — altere na etapa{' '}
            <strong>Cargas</strong>.
          </p>
        </div>
      </div>

      <p className="hint" style={{ marginTop: '0.75rem' }}>
        Nk:{' '}
        {nkUsed != null
          ? `${fmt(nkUsed)} kN${
              s.groupResult?.maxPileLoad_kN != null
                ? ' (Nmáx grupo)'
                : s.foundationKind === 'pile_cap' && s.designLoad_kN != null
                  ? ` (= ${s.designLoad_kN} / ${nPile})`
                  : s.designLoad_kN != null
                    ? ' (projeto)'
                    : ' (Padm governante)'
            }`
          : '—'}
        {' · '}
        Mk: {fmt(mkUsed)} kN·m · Vk: {fmt(vkUsed)} kN
        {padm != null && nkUsed != null && nkUsed > padm && (
          <>
            {' '}
            · <strong>Aviso:</strong> Nk &gt; Padm geotécnico da estaca
          </>
        )}
      </p>

      {s.calcError && <div className="error-box">{s.calcError}</div>}

      <FlowNavButtons
        primaryLabel="Dimensionar e continuar"
        onPrimary={() => {
          s.runStructural({ preserveStep: true })
          // Só avança se a armadura realmente saiu (evita ir aos desenhos sem prancha).
          return useProjectStore.getState().structural != null
        }}
        extra={
          <button
            type="button"
            className="btn"
            onClick={() => s.runStructural({ preserveStep: true })}
            data-testid="rebar-run"
          >
            Dimensionar armadura
          </button>
        }
      />

      {r && (
        <>
          <div className="kpi-row" style={{ marginTop: '1.25rem' }} data-testid="rebar-kpi-row">
            <div className="kpi" data-testid="rebar-status">
              <div className="label">Status</div>
              <div className="value" style={{ fontSize: '1rem' }}>
                {r.status}
              </div>
            </div>
            <div className="kpi" data-testid="rebar-as-nec">
              <div className="label">As,nec</div>
              <div className="value">
                {fmt(r.As_nec_cm2)}
                <span className="unit">cm²</span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">Nd</div>
              <div className="value">
                {fmt(r.Nd_kN)}
                <span className="unit">kN</span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">Nrd</div>
              <div className="value">
                {fmt(r.Nrd_kN)}
                <span className="unit">kN</span>
              </div>
            </div>
            {r.nm?.mode === 'nm' && (
              <>
                <div className="kpi" data-testid="rebar-msd">
                  <div className="label">Msd</div>
                  <div className="value">
                    {fmt(r.nm.Msd_kNm)}
                    <span className="unit">kN·m</span>
                  </div>
                </div>
                <div className="kpi" data-testid="rebar-vsd">
                  <div className="label">Vsd</div>
                  <div className="value">
                    {fmt(r.nm.Vsd_kN)}
                    <span className="unit">kN</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <p style={{ marginTop: '0.85rem' }}>{r.message}</p>
          {r.params && <p className="hint">{r.params.source}</p>}
          {r.nm?.mode === 'nm' && (
            <p className="hint" data-testid="rebar-nm-summary">
              Flexo-compressão: Md={fmt(r.nm.Md_kNm)} kN·m (e={fmt(r.nm.e_m * 100, 1)} cm) ·
              MRd={fmt(r.nm.MRd_kNm)} kN·m ({r.nm.bendingOk ? 'M ok' : 'M não ok'}) · VRd2=
              {fmt(r.nm.VRd2_kN)} kN · Vc={fmt(r.nm.Vc_kN)} kN · Asw/s={fmt(r.nm.AswPerS_cm2_m)}{' '}
              cm²/m ({r.nm.shearOk ? 'V ok' : 'V não ok'})
            </p>
          )}

          {r.detail && (
            <div className="panel" style={{ marginTop: '1rem', boxShadow: 'none' }}>
              <h2 style={{ fontSize: '1.05rem' }}>Detalhamento sugerido</h2>
              <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.5rem 0' }}>
                {r.detail.detailText}
              </p>
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    <tr>
                      <td className="left">Longitudinal</td>
                      <td>
                        {r.detail.longitudinal.count} φ {r.detail.longitudinal.diameter_mm} mm (
                        {fmt(r.detail.longitudinal.As_cm2)} cm²)
                      </td>
                    </tr>
                    <tr>
                      <td className="left">Transversal</td>
                      <td>
                        {r.detail.transverse.kind === 'spiral' ? 'Espiral' : 'Estribo'} φ{' '}
                        {r.detail.transverse.diameter_mm} mm c/
                        {(r.detail.transverse.spacing_m * 100).toFixed(0)} cm
                      </td>
                    </tr>
                    <tr>
                      <td className="left">Cobrimento</td>
                      <td>{r.detail.cover_mm} mm</td>
                    </tr>
                    <tr>
                      <td className="left">Comprimento da gaiola</td>
                      <td>{fmt(r.detail.cageLength_m)} m</td>
                    </tr>
                    <tr>
                      <td className="left">σ atuante</td>
                      <td>{fmt(r.sigma_MPa)} MPa</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {r.warnings.map((w) => (
            <div
              key={w}
              className="error-box"
              style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
            >
              {w}
            </div>
          ))}

          <FlowNavButtons
            hideBack
            primaryLabel="Continuar · Desenhos"
            extra={
              <button
                type="button"
                className="btn"
                onClick={() => s.patch({ showStructuralTraces: !s.showStructuralTraces })}
              >
                {s.showStructuralTraces ? 'Ocultar' : 'Ver'} cálculo estrutural
              </button>
            }
          />
          {s.showStructuralTraces &&
            r.traces.map((t, i) => (
              <div className="trace" key={i}>
                <h4>
                  {t.title} <span className="hint">· {t.reference}</span>
                </h4>
                <div>{t.formula}</div>
                <div>
                  {Object.entries(t.substitutions)
                    .map(([k, v]) => `${k}=${typeof v === 'number' ? fmt(v, 4) : v}`)
                    .join(' · ')}
                </div>
                <div>
                  → <strong>{typeof t.result === 'number' ? fmt(Number(t.result), 4) : t.result}</strong>{' '}
                  {t.unit}
                </div>
              </div>
            ))}
        </>
      )}
    </section>
  )
}
