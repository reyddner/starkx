import { useProjectStore } from '../../store/projectStore'
import type { FootingAdmMode } from '@footing/index'
import { RaftPlan2D } from '../../viz/RaftPlan2D'
import { ScopeBanner, SHALLOW_MVP_TEXT } from '../ScopeBanner'
import { FlowNavButtons } from '../FlowNavButtons'

export function StepRaft({ embedded = false }: { embedded?: boolean } = {}) {
  const s = useProjectStore()
  const r = s.raftResult
  const Wrapper = embedded ? 'div' : 'section'

  return (
    <Wrapper className={embedded ? undefined : 'panel'}>
      <h3 style={{ marginBottom: '0.25rem' }}>Radier</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Dimensionamento geotécnico retangular (σadm / Vesic). Espessura sugerida B/10. Esforços na
        placa ficam fora do escopo. Ver <code>docs/METHODS.md</code>.
      </p>
      <ScopeBanner>{SHALLOW_MVP_TEXT}</ScopeBanner>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="rasp">Razão L/B</label>
          <input
            id="rasp"
            type="number"
            min={1}
            step="0.1"
            value={s.raftAspect}
            onChange={(e) => s.patch({ raftAspect: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="radm">Modo de σadm</label>
          <select
            id="radm"
            value={s.raftAdmMode}
            onChange={(e) => s.patch({ raftAdmMode: e.target.value as FootingAdmMode })}
          >
            <option value="user">σadm informado</option>
            <option value="bearing">Capacidade Vesic (c′, φ′, γ)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="rt">Espessura t (m) — vazio = sugerida</label>
          <input
            id="rt"
            type="number"
            step="0.05"
            placeholder="auto"
            value={s.raftThickness_m ?? ''}
            onChange={(e) =>
              s.patch({
                raftThickness_m: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      {s.raftAdmMode === 'user' ? (
        <div className="grid-3" style={{ marginTop: '0.75rem' }}>
          <div className="field">
            <label htmlFor="rsig">σadm (kPa)</label>
            <input
              id="rsig"
              type="number"
              value={s.raftSigmaAdm_kPa}
              onChange={(e) => s.patch({ raftSigmaAdm_kPa: Number(e.target.value) })}
            />
          </div>
        </div>
      ) : (
        <div className="grid-3" style={{ marginTop: '0.75rem' }}>
          <div className="field">
            <label htmlFor="rc">c′ (kPa)</label>
            <input
              id="rc"
              type="number"
              value={s.raftC_kPa}
              onChange={(e) => s.patch({ raftC_kPa: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="rphi">φ′ (°)</label>
            <input
              id="rphi"
              type="number"
              value={s.raftPhi_deg}
              onChange={(e) => s.patch({ raftPhi_deg: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="rg">γ (kN/m³)</label>
            <input
              id="rg"
              type="number"
              value={s.raftGamma_kN_m3}
              onChange={(e) => s.patch({ raftGamma_kN_m3: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="rdf">Df (m)</label>
            <input
              id="rdf"
              type="number"
              step="0.01"
              value={s.raftDf_m}
              onChange={(e) => s.patch({ raftDf_m: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="rfs">FS capacidade</label>
            <input
              id="rfs"
              type="number"
              step="0.1"
              value={s.raftFs}
              onChange={(e) => s.patch({ raftFs: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="grid-3" style={{ marginTop: '0.75rem' }}>
        <div className="field">
          <label htmlFor="rmx">Mx (kN·m) — opcional</label>
          <input
            id="rmx"
            type="number"
            placeholder="0"
            value={s.raftMx_kNm ?? ''}
            onChange={(e) =>
              s.patch({ raftMx_kNm: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="rmy">My (kN·m) — opcional</label>
          <input
            id="rmy"
            type="number"
            placeholder="0"
            value={s.raftMy_kNm ?? ''}
            onChange={(e) =>
              s.patch({ raftMy_kNm: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
      </div>

      {r && (
        <div style={{ marginTop: '1rem' }}>
          <RaftPlan2D raft={r} />
        </div>
      )}
      {s.calcError && <div className="error-box">{s.calcError}</div>}

      {!embedded && <FlowNavButtons primaryLabel="Voltar à fundação" />}
    </Wrapper>
  )
}
