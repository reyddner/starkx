import { useProjectStore } from '../../store/projectStore'
import type { FootingAdmMode, FootingShape } from '@footing/index'
import { FootingPlan2D } from '../../viz/FootingPlan2D'
import { ScopeBanner, SHALLOW_MVP_TEXT } from '../ScopeBanner'
import { FlowNavButtons } from '../FlowNavButtons'

export function StepFooting({ embedded = false }: { embedded?: boolean } = {}) {
  const s = useProjectStore()
  const r = s.footingResult
  const Wrapper = embedded ? 'div' : 'section'

  return (
    <Wrapper className={embedded ? undefined : 'panel'}>
      <h3 style={{ marginBottom: '0.25rem' }}>Sapata isolada</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Geotecnia em serviço (σadm informado ou Vesic, 1975) e estrutural com fck: sapata rígida,
        flexão CEB-70, biela e punção (NBR 6118). Ver <code>docs/METHODS.md</code>.
      </p>
      <ScopeBanner>{SHALLOW_MVP_TEXT}</ScopeBanner>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="fshape">Forma</label>
          <select
            id="fshape"
            value={s.footingShape}
            onChange={(e) => s.patch({ footingShape: e.target.value as FootingShape })}
          >
            <option value="square">Quadrada</option>
            <option value="rectangular">Retangular</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="fadm">Modo de σadm</label>
          <select
            id="fadm"
            value={s.footingAdmMode}
            onChange={(e) => s.patch({ footingAdmMode: e.target.value as FootingAdmMode })}
          >
            <option value="user">σadm informado</option>
            <option value="bearing">Capacidade Vesic (c′, φ′, γ)</option>
          </select>
        </div>
        {s.footingShape === 'rectangular' && (
          <div className="field">
            <label htmlFor="fasp">Razão L/B</label>
            <input
              id="fasp"
              type="number"
              min={1}
              step="0.1"
              value={s.footingAspect}
              onChange={(e) => s.patch({ footingAspect: Number(e.target.value) })}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="ft">Espessura t (m) — vazio = sugerida</label>
          <input
            id="ft"
            type="number"
            step="0.05"
            placeholder="auto"
            value={s.footingThickness_m ?? ''}
            onChange={(e) =>
              s.patch({
                footingThickness_m: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      {s.footingAdmMode === 'user' ? (
        <div className="grid-3" style={{ marginTop: '0.75rem' }}>
          <div className="field">
            <label htmlFor="fsig">σadm (kPa)</label>
            <input
              id="fsig"
              type="number"
              value={s.footingSigmaAdm_kPa}
              onChange={(e) => s.patch({ footingSigmaAdm_kPa: Number(e.target.value) })}
            />
          </div>
        </div>
      ) : (
        <div className="grid-3" style={{ marginTop: '0.75rem' }}>
          <div className="field">
            <label htmlFor="fc">c′ (kPa)</label>
            <input
              id="fc"
              type="number"
              value={s.footingC_kPa}
              onChange={(e) => s.patch({ footingC_kPa: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="fphi">φ′ (°)</label>
            <input
              id="fphi"
              type="number"
              value={s.footingPhi_deg}
              onChange={(e) => s.patch({ footingPhi_deg: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="fg">γ (kN/m³)</label>
            <input
              id="fg"
              type="number"
              value={s.footingGamma_kN_m3}
              onChange={(e) => s.patch({ footingGamma_kN_m3: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="fdf">Df (m)</label>
            <input
              id="fdf"
              type="number"
              step="0.01"
              value={s.footingDf_m}
              onChange={(e) => s.patch({ footingDf_m: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="ffs">FS capacidade</label>
            <input
              id="ffs"
              type="number"
              step="0.1"
              value={s.footingFs}
              onChange={(e) => s.patch({ footingFs: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="grid-3" style={{ marginTop: '0.75rem' }}>
        <div className="field">
          <label htmlFor="fmx">Mx (kN·m) — opcional</label>
          <input
            id="fmx"
            type="number"
            placeholder="0"
            value={s.footingMx_kNm ?? ''}
            onChange={(e) =>
              s.patch({ footingMx_kNm: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="fmy">My (kN·m) — opcional</label>
          <input
            id="fmy"
            type="number"
            placeholder="0"
            value={s.footingMy_kNm ?? ''}
            onChange={(e) =>
              s.patch({ footingMy_kNm: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
      </div>

      {r && (
        <div style={{ marginTop: '1rem' }}>
          <FootingPlan2D footing={r} />
        </div>
      )}

      {s.calcError && <div className="error-box">{s.calcError}</div>}

      {!embedded && <FlowNavButtons primaryLabel="Voltar à fundação" />}
    </Wrapper>
  )
}
