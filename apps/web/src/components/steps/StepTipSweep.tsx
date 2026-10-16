import { useState } from 'react'
import { resolvePileDatum } from '@domain/pileDatum'
import { useProjectStore } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function StepTipSweep() {
  const s = useProjectStore()
  const datum = resolvePileDatum({
    foundationKind: s.foundationKind,
    tipDepth_m: s.tipDepth_m,
    blockThickness_m: s.blockThickness_m,
    blockEmbedment_m: s.blockEmbedment_m,
    pileTopElevation_m: s.pileTopElevation_m,
  })
  const maxDepth = s.layers.reduce((m, l) => Math.max(m, l.depth_m), 1)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(maxDepth)
  const [step, setStep] = useState(s.mode === 'engineering' ? 0.5 : 1)

  return (
    <section className="panel" data-testid="step-tip-sweep">
      <h2>Estudo de cota de apoio</h2>
      <p className="lead">
        Varre camadas SPT no intervalo (cota de ponta no perfil). Adotar grava o{' '}
        <strong>comprimento L</strong> = cota SPT − topo da estaca (
        {datum.pileTopDepth_m.toFixed(2)} m).
      </p>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="sw-from">De — cota SPT (m)</label>
          <input
            id="sw-from"
            type="number"
            step={0.01}
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="sw-to">Até — cota SPT (m)</label>
          <input
            id="sw-to"
            type="number"
            step={0.01}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="sw-step">Incremento (m)</label>
          <input
            id="sw-step"
            type="number"
            min={0.01}
            step={0.01}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
          />
          <span className="hint">
            Usa as camadas SPT do intervalo
          </span>
        </div>
      </div>
      {s.calcError && <div className="error-box">{s.calcError}</div>}
      {s.tipSweepRows.length > 0 && (
        <table className="data-table" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>L (m)</th>
              <th>Cota SPT</th>
              <th>Padm médio</th>
              <th>Padm mín.</th>
              <th>Padm gov.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {s.tipSweepRows.map((r) => {
              const sptTip = datum.pileTopDepth_m + r.tipDepth_m
              return (
                <tr key={r.tipDepth_m}>
                  <td>{fmt(r.tipDepth_m)}</td>
                  <td>{fmt(sptTip)}</td>
                  <td>{fmt(r.padmAverage_kN)} kN</td>
                  <td>{fmt(r.padmMinimum_kN)} kN</td>
                  <td>{fmt(r.padmGoverning_kN)} kN</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        s.patch({ tipDepth_m: r.tipDepth_m })
                        s.runCalculation({ preserveStep: true })
                      }}
                    >
                      Adotar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="hint" style={{ marginTop: '0.75rem' }}>
        L atual: {s.tipDepth_m} m · ponta SPT ≈ {datum.sptTipDepth_m.toFixed(2)} m
        {s.result ? ` · Padm gov. ${fmt(s.result.atTip.governingPadm_kN)} kN` : ''}
      </p>

      <FlowNavButtons
        extra={
          <button
            type="button"
            className="btn"
            onClick={() => s.runTipSweep(from, to, step)}
            data-testid="tip-sweep-run"
          >
            Calcular varredura
          </button>
        }
      />
    </section>
  )
}
