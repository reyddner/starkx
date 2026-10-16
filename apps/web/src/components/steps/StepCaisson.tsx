import { useProjectStore } from '../../store/projectStore'
import type { CaissonAdmMode, CaissonShaftMode } from '@caisson/index'
import { CaissonSection2D } from '../../viz/CaissonSection2D'
import { ScopeBanner, SHALLOW_MVP_TEXT } from '../ScopeBanner'
import { FlowNavButtons } from '../FlowNavButtons'

export function StepCaisson({ embedded = false }: { embedded?: boolean } = {}) {
  const s = useProjectStore()
  const r = s.caissonResult
  const Wrapper = embedded ? 'div' : 'section'

  return (
    <Wrapper className={embedded ? undefined : 'panel'}>
      <h3 style={{ marginBottom: '0.25rem' }}>Tubulão</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Capacidade geotécnica — ponta (σadm ou Vesic) + fuste (fs informado ou Aoki-Velloso, sem
        atrito no alargamento) e compressão do fuste de concreto. Ver <code>docs/METHODS.md</code>.
      </p>
      <ScopeBanner>{SHALLOW_MVP_TEXT}</ScopeBanner>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="cds">Diâmetro fuste Ds (m)</label>
          <input
            id="cds"
            type="number"
            step="0.05"
            value={s.caissonShaftDia_m}
            onChange={(e) => s.patch({ caissonShaftDia_m: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="cdb">Diâmetro base Db (m) — vazio = Ds</label>
          <input
            id="cdb"
            type="number"
            step="0.05"
            placeholder="= Ds"
            value={s.caissonBaseDia_m ?? ''}
            onChange={(e) =>
              s.patch({
                caissonBaseDia_m: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="cl">Comprimento L (m)</label>
          <input
            id="cl"
            type="number"
            step="0.5"
            value={s.caissonLength_m}
            onChange={(e) => s.patch({ caissonLength_m: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="cadm">Modo ponta</label>
          <select
            id="cadm"
            value={s.caissonAdmMode}
            onChange={(e) => s.patch({ caissonAdmMode: e.target.value as CaissonAdmMode })}
          >
            <option value="user">σadm informado</option>
            <option value="bearing">Vesic (c′, φ′, γ)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="cshaft">Modo fuste</label>
          <select
            id="cshaft"
            value={s.caissonShaftMode}
            onChange={(e) =>
              s.patch({ caissonShaftMode: e.target.value as CaissonShaftMode })
            }
          >
            <option value="user">fs informado</option>
            <option value="spt_aoki">α·NSPT (Aoki / escavada)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="cfss">FS do fuste (adimensional)</label>
          <input
            id="cfss"
            type="number"
            step="0.1"
            value={s.caissonShaftFS}
            onChange={(e) => s.patch({ caissonShaftFS: Number(e.target.value) })}
          />
        </div>
        {s.caissonShaftMode === 'user' ? (
          <div className="field">
            <label htmlFor="cfs">Atrito unitário fuste (kPa)</label>
            <input
              id="cfs"
              type="number"
              value={s.caissonUnitFriction_kPa}
              onChange={(e) =>
                s.patch({ caissonUnitFriction_kPa: Number(e.target.value) })
              }
            />
          </div>
        ) : (
          <p className="hint" style={{ gridColumn: '1 / -1', margin: 0 }}>
            Modo SPT: usa as camadas da etapa Sondagem (1 m em 1 m até L). F1/F2 e α,K do catálogo
            Aoki com analogia à estaca escavada.
          </p>
        )}
      </div>

      {s.caissonAdmMode === 'user' ? (
        <div className="grid-3" style={{ marginTop: '0.75rem' }}>
          <div className="field">
            <label htmlFor="csig">σadm ponta (kPa)</label>
            <input
              id="csig"
              type="number"
              value={s.caissonSigmaAdm_kPa}
              onChange={(e) => s.patch({ caissonSigmaAdm_kPa: Number(e.target.value) })}
            />
          </div>
        </div>
      ) : (
        <div className="grid-3" style={{ marginTop: '0.75rem' }}>
          <div className="field">
            <label htmlFor="cc">c′ (kPa)</label>
            <input
              id="cc"
              type="number"
              value={s.caissonC_kPa}
              onChange={(e) => s.patch({ caissonC_kPa: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="cphi">φ′ (°)</label>
            <input
              id="cphi"
              type="number"
              value={s.caissonPhi_deg}
              onChange={(e) => s.patch({ caissonPhi_deg: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="cg">γ (kN/m³)</label>
            <input
              id="cg"
              type="number"
              value={s.caissonGamma_kN_m3}
              onChange={(e) => s.patch({ caissonGamma_kN_m3: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="cft">FS ponta</label>
            <input
              id="cft"
              type="number"
              step="0.1"
              value={s.caissonFsTip}
              onChange={(e) => s.patch({ caissonFsTip: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {r && (
        <div style={{ marginTop: '1rem' }}>
          <CaissonSection2D caisson={r} />
          <p className="hint">
            Fuste: {r.shaftMode === 'spt_aoki' ? 'α·NSPT (Aoki)' : 'fs informado'}
            {r.avgFsShaft_kPa != null ? ` · fs méd ≈ ${r.avgFsShaft_kPa.toFixed(1)} kPa` : ''}
          </p>
        </div>
      )}
      {s.calcError && <div className="error-box">{s.calcError}</div>}

      {!embedded && <FlowNavButtons primaryLabel="Voltar à fundação" />}
    </Wrapper>
  )
}
