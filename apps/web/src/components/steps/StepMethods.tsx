import { useProjectStore } from '../../store/projectStore'
import {
  RECOMMENDED_METHOD_CONFIG,
  isRecommendedMethodConfig,
} from '../../store/methodDefaults'
import { FlowNavButtons } from '../FlowNavButtons'
import type { GoverningRule, MethodId } from '@engine/types'

export function StepMethods() {
  const s = useProjectStore()
  const isRecommended = isRecommendedMethodConfig({
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
  })

  return (
    <section className="panel">
      <h2>Métodos e parâmetros (avançado)</h2>
      <p className="lead">
        Aoki-Velloso, Décourt-Quaresma e Teixeira. O motor é determinístico — estes campos só configuram
        o cálculo. O projeto já vem com a configuração recomendada; mexa aqui só se precisar.
      </p>

      <p className="hint" style={{ marginTop: 0 }}>
        {isRecommended
          ? 'Configuração recomendada ativa.'
          : 'Configuração personalizada — fora do padrão recomendado.'}
      </p>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="gov">Critério governante</label>
          <select
            id="gov"
            value={s.governingRule}
            onChange={(e) => s.patch({ governingRule: e.target.value as GoverningRule })}
          >
            <option value="minimum">Mínimo (conservador)</option>
            <option value="average">Média dos métodos</option>
            <option value="user_selected">Método selecionado pelo usuário</option>
          </select>
        </div>
        {s.governingRule === 'user_selected' && (
          <div className="field">
            <label htmlFor="selm">Método governante</label>
            <select
              id="selm"
              value={s.selectedMethod}
              onChange={(e) => s.patch({ selectedMethod: e.target.value as MethodId })}
            >
              <option value="aoki_velloso">Aoki-Velloso</option>
              <option value="decourt_quaresma">Décourt-Quaresma</option>
              <option value="teixeira">Teixeira</option>
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="afs">FS Aoki-Velloso</label>
          <input
            id="afs"
            type="number"
            step="0.1"
            value={s.aokiFs}
            onChange={(e) => s.patch({ aokiFs: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="tfs">FS Teixeira</label>
          <input
            id="tfs"
            type="number"
            step="0.1"
            value={s.teixeiraFs}
            onChange={(e) => s.patch({ teixeiraFs: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="tpt">% ponta Teixeira</label>
          <input
            id="tpt"
            type="number"
            step="1"
            min={0}
            max={100}
            value={s.teixeiraPctTip}
            onChange={(e) => s.patch({ teixeiraPctTip: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="tps">% fuste Teixeira</label>
          <input
            id="tps"
            type="number"
            step="1"
            min={0}
            max={100}
            value={s.teixeiraPctShaft}
            onChange={(e) => s.patch({ teixeiraPctShaft: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="apt">% ponta Aoki</label>
          <input
            id="apt"
            type="number"
            step="1"
            min={0}
            max={100}
            value={s.aokiPctTip}
            onChange={(e) => s.patch({ aokiPctTip: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="aps">% fuste Aoki</label>
          <input
            id="aps"
            type="number"
            step="1"
            min={0}
            max={100}
            value={s.aokiPctShaft}
            onChange={(e) => s.patch({ aokiPctShaft: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="da">α Décourt (%) — vazio = auto no modo engineering</label>
          <input
            id="da"
            type="number"
            placeholder="auto / 100"
            value={s.decourtAlphaPct ?? ''}
            onChange={(e) =>
              s.patch({ decourtAlphaPct: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="db">β Décourt (%)</label>
          <input
            id="db"
            type="number"
            placeholder="auto / 100"
            value={s.decourtBetaPct ?? ''}
            onChange={(e) =>
              s.patch({ decourtBetaPct: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
      </div>

      {s.calcError && <div className="error-box">{s.calcError}</div>}

      <FlowNavButtons
        backLabel="Voltar à fundação"
        primaryLabel="Recalcular capacidade"
        onPrimary={() => {
          s.runCalculation()
          return false
        }}
        extra={
          <button
            type="button"
            className="btn"
            disabled={isRecommended}
            onClick={() => s.patch({ ...RECOMMENDED_METHOD_CONFIG })}
            data-testid="methods-restore-recommended"
          >
            Restaurar recomendada
          </button>
        }
      />
    </section>
  )
}
