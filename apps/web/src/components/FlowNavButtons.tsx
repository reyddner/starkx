import type { ReactNode } from 'react'
import { useProjectStore } from '../store/projectStore'
import { nextStepId, prevStepId } from '../store/wizardFlow'

/**
 * Navegação padronizada (DEC-37/DEC-58): Voltar / Continuar pelo fluxo canônico.
 *
 * "Voltar" só desaparece quando realmente não há etapa anterior, para não
 * existir botão morto nem etapa sem saída.
 */
export function FlowNavButtons({
  primaryLabel = 'Continuar',
  backLabel = 'Voltar',
  onPrimary,
  hideBack,
  hidePrimary,
  extra,
}: {
  primaryLabel?: string
  backLabel?: string
  /** Se retornar false, não avança. */
  onPrimary?: () => boolean | void
  hideBack?: boolean
  hidePrimary?: boolean
  extra?: ReactNode
}) {
  const s = useProjectStore()
  const prev = prevStepId(s.toGateInput())

  return (
    <div className="actions">
      {!hideBack && prev != null && (
        <button
          type="button"
          className="btn"
          data-testid="flow-back"
          onClick={() => s.setStep(prev)}
        >
          {backLabel}
        </button>
      )}
      {extra}
      {!hidePrimary && (
        <button
          type="button"
          className="btn btn-primary"
          data-testid="flow-primary"
          onClick={() => {
            if (onPrimary) {
              const ok = onPrimary()
              if (ok === false) return
            }
            const n = nextStepId(useProjectStore.getState().toGateInput())
            if (n) s.setStep(n)
          }}
        >
          {primaryLabel}
        </button>
      )}
    </div>
  )
}
