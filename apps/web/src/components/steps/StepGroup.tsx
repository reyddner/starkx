import { suggestPileGroupLayout } from '@group/index'
import { useProjectStore } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function StepGroup() {
  const s = useProjectStore()
  const padm = s.result?.atTip.governingPadm_kN
  const N = s.columnLoad.N_kN ?? s.designLoad_kN
  const nextLabel =
    s.foundationKind === 'pile_cap' ? 'Continuar · Bloco' : 'Continuar · Armadura'

  const suggest = () => {
    if (padm == null || N == null) {
      s.patch({ calcError: 'Informe N do pilar e calcule a capacidade antes de sugerir n.' })
      return
    }
    const { rows, cols, trial } = suggestPileGroupLayout({
      N_kN: N,
      Mx_kNm: s.columnLoad.Mx_kNm ?? 0,
      My_kNm: s.columnLoad.My_kNm ?? 0,
      singlePadm_kN: padm,
      diameter_m: s.diameterCm / 100,
      spacing_m: s.blockSpacing_m,
      efficiency: s.blockEfficiency,
    })
    s.applyPileLayout(rows, cols)
    s.runGroupDesign()
    if (!trial.ok) {
      s.patch({
        calcError: `Sugestão ${rows}×${cols}: ainda não atende todas as verificações. ${trial.message}`,
      })
    }
  }

  return (
    <section className="panel" data-testid="step-group">
      <h2>Número e arranjo de estacas</h2>
      <p className="lead">
        Distribuição N/n ± Mx/My (grupo rígido). Espaçamento mínimo 2,5Ø. «Sugerir n» procura a menor
        grade que atende compressão, momentos, tração e espaçamento — não é só N/Padm.
      </p>
      {s.foundationKind === 'pile' && (
        <p className="hint">Estaca isolada: arranjo 1×1. Use «Sugerir n» se a carga exigir grupo.</p>
      )}
      <div className="grid-3">
        <div className="field">
          <label htmlFor="gr-rows">Linhas</label>
          <input
            id="gr-rows"
            type="number"
            min={1}
            value={s.blockRows}
            onChange={(e) => s.patch({ blockRows: Number(e.target.value) })}
            disabled={s.foundationKind === 'pile'}
          />
        </div>
        <div className="field">
          <label htmlFor="gr-cols">Colunas</label>
          <input
            id="gr-cols"
            type="number"
            min={1}
            value={s.blockCols}
            onChange={(e) => s.patch({ blockCols: Number(e.target.value) })}
            disabled={s.foundationKind === 'pile'}
          />
        </div>
        <div className="field">
          <label htmlFor="gr-sp">Espaçamento (m)</label>
          <input
            id="gr-sp"
            type="number"
            step={0.05}
            value={s.blockSpacing_m ?? ''}
            placeholder="auto 3Ø"
            onChange={(e) =>
              s.patch({
                blockSpacing_m: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </div>
      {s.blockEfficiency != null && (
        <p className="hint">
          η atual = {s.blockEfficiency.toFixed(3)} (editável na etapa Bloco
          {s.blockEfficiencyHint != null
            ? ` · Converse-Labarre sugerido ≈ ${s.blockEfficiencyHint.toFixed(3)}`
            : ''}
          ).
        </p>
      )}
      <FlowNavButtons
        primaryLabel={nextLabel}
        extra={
          <>
            <button type="button" className="btn" onClick={suggest} data-testid="group-suggest-n">
              Sugerir n
            </button>
            <button type="button" className="btn" onClick={() => s.runGroupDesign()}>
              Verificar grupo
            </button>
          </>
        }
      />
      {s.calcError && <div className="error-box">{s.calcError}</div>}
      {s.groupResult && (
        <div className="kpi-row" style={{ marginTop: '1rem' }} data-testid="group-kpi">
          <div className="kpi">
            <div className="label">n</div>
            <div className="value">{s.groupResult.nPiles}</div>
          </div>
          <div className="kpi">
            <div className="label">Nmáx</div>
            <div className="value">
              {fmt(s.groupResult.maxPileLoad_kN)}
              <span className="unit">kN</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">Nmín</div>
            <div className="value">
              {fmt(s.groupResult.minPileLoad_kN)}
              <span className="unit">kN</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">Status</div>
            <div className="value" style={{ fontSize: '1rem' }}>
              {s.groupResult.ok ? 'OK' : 'NÃO OK'}
            </div>
          </div>
          <p style={{ gridColumn: '1 / -1' }}>{s.groupResult.message}</p>
        </div>
      )}
    </section>
  )
}
