import { useState } from 'react'
import { useProjectStore, type FoundationKindUi } from '../../store/projectStore'
import { canRunCalculation } from '../../store/wizardFlow'
import { foundationKindLabelPt } from '@assist/index'
import { FlowNavButtons } from '../FlowNavButtons'
import { StepPile } from './StepPile'
import { StepFooting } from './StepFooting'
import { StepCaisson } from './StepCaisson'
import { StepRaft } from './StepRaft'

const OPTIONS: { kind: FoundationKindUi; label: string; tag: string }[] = [
  {
    kind: 'pile_cap',
    label: 'Bloco sobre estacas',
    tag: 'Recomendado · pilar sobre bloco (1E+)',
  },
  {
    kind: 'pile',
    label: 'Estaca isolada',
    tag: 'Estudo de capacidade · não apoia pilar no fuste',
  },
  { kind: 'footing', label: 'Sapata isolada', tag: 'Disponível · MVP' },
  { kind: 'caisson', label: 'Tubulão', tag: 'Disponível · MVP' },
  { kind: 'raft', label: 'Radier', tag: 'Disponível · MVP' },
]

/** Geometria correspondente ao tipo escolhido, renderizada sem navegação própria. */
function GeometryForKind({ kind }: { kind: FoundationKindUi }) {
  if (kind === 'footing') return <StepFooting embedded />
  if (kind === 'caisson') return <StepCaisson embedded />
  if (kind === 'raft') return <StepRaft embedded />
  return <StepPile embedded />
}

/**
 * Etapa unificada DEC-58: confirma o tipo de fundação e edita a geometria
 * do elemento na mesma tela, encerrando com o cálculo de capacidade.
 */
export function StepFoundation() {
  const s = useProjectStore()
  const [changeKindOpen, setChangeKindOpen] = useState(false)
  const suggestion = s.foundationSuggestion
  const gate = canRunCalculation(s.toGateInput())
  const isShallow =
    s.foundationKind === 'footing' || s.foundationKind === 'caisson' || s.foundationKind === 'raft'

  const select = (kind: FoundationKindUi) => {
    s.patch({
      foundationKind: kind,
      analysisAccepted: true,
      ...(kind !== 'pile_cap' ? { blockResult: null } : {}),
      ...(kind !== 'footing' ? { footingResult: null } : {}),
      ...(kind !== 'caisson' ? { caissonResult: null } : {}),
      ...(kind !== 'raft' ? { raftResult: null } : {}),
    })
    setChangeKindOpen(false)
  }

  /** Roda o motor do tipo escolhido sem trocar de etapa e diz se houve resultado. */
  const runDesign = (): boolean => {
    const preserve = { preserveStep: true } as const
    if (s.foundationKind === 'footing') s.runFootingDesign(preserve)
    else if (s.foundationKind === 'caisson') s.runCaissonDesign(preserve)
    else if (s.foundationKind === 'raft') s.runRaftDesign(preserve)
    else s.runCalculation(preserve)

    const after = useProjectStore.getState()
    switch (after.foundationKind) {
      case 'footing':
        return after.footingResult != null
      case 'caisson':
        return after.caissonResult != null
      case 'raft':
        return after.raftResult != null
      default:
        return after.result != null
    }
  }

  const currentLabel =
    foundationKindLabelPt[s.foundationKind] ??
    OPTIONS.find((o) => o.kind === s.foundationKind)?.label ??
    s.foundationKind

  return (
    <section className="panel" data-testid="step-foundation">
      <h2>Fundação e geometria</h2>
      <p className="lead">
        Tipo de fundação já aplicado conforme a Análise, com a geometria correspondente. Ajuste o
        que precisar e siga para a capacidade.
      </p>

      <div className="scope-banner" role="status">
        Tipo adotado: <strong>{currentLabel}</strong>
        {suggestion && suggestion.suggestedKind === s.foundationKind
          ? ' (recomendado pela Análise)'
          : suggestion
            ? ` · a Análise recomendava ${foundationKindLabelPt[suggestion.suggestedKind] ?? suggestion.suggestedKind}`
            : ''}
        {'. '}
        <button
          type="button"
          className="btn"
          style={{ padding: '1px 8px', fontSize: '0.8rem', marginLeft: 4 }}
          onClick={() => setChangeKindOpen((v) => !v)}
          data-testid="btn-change-foundation-kind"
        >
          {changeKindOpen ? 'fechar' : 'trocar tipo de fundação'}
        </button>
      </div>

      {changeKindOpen && (
        <div className="grid-3" style={{ marginBottom: '1rem' }}>
          {OPTIONS.map((o) => (
            <button
              key={o.kind}
              type="button"
              className="kpi"
              style={{
                cursor: 'pointer',
                outline: s.foundationKind === o.kind ? '2px solid var(--accent)' : undefined,
                textAlign: 'left',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'inherit',
              }}
              onClick={() => select(o.kind)}
              data-testid={`foundation-kind-${o.kind}`}
            >
              <div className="label">{o.tag}</div>
              <div className="value" style={{ fontSize: '1.05rem' }}>
                {o.label}
              </div>
            </button>
          ))}
        </div>
      )}

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '1.25rem 0' }} />

      <GeometryForKind kind={s.foundationKind} />

      {!gate.ok && (
        <div className="error-box" role="status" style={{ marginTop: '1rem' }}>
          {gate.reason}
        </div>
      )}

      <FlowNavButtons
        primaryLabel={isShallow ? 'Dimensionar e ver capacidade' : 'Calcular capacidade'}
        extra={
          !isShallow ? (
            <button
              type="button"
              className="btn"
              onClick={() => s.setStep('methods')}
              data-testid="btn-open-methods"
            >
              Alterar métodos (avançado)
            </button>
          ) : undefined
        }
        onPrimary={() => {
          s.patch({ analysisAccepted: true })
          // Só segue para Capacidade se o dimensionamento realmente saiu.
          return runDesign()
        }}
      />
    </section>
  )
}
