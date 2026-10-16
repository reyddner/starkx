import type { AssistFinding } from '@assist/index'

export function AssistPanel({
  findings,
  onApply,
}: {
  findings: AssistFinding[]
  onApply: (patch: Record<string, number | string | boolean | null>) => void
}) {
  if (findings.length === 0) return null

  // Evita ruído: infos genéricas ficam fora; warning + tip + ações relevantes.
  const visible = findings.filter((f) => f.severity === 'warning' || f.severity === 'tip')
  if (visible.length === 0) return null

  return (
    <section className="panel" aria-label="Assistente STARKX">
      <h2>Assistente</h2>
      <p className="lead" style={{ marginTop: 0 }}>
        Fase 10 — interpreta resultados dos motores (não recalcula).
      </p>
      <ul className="hint" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map((f) => (
          <li
            key={f.id}
            className="scope-banner"
            role="status"
            style={{
              marginTop: '0.5rem',
              borderLeft:
                f.severity === 'warning'
                  ? '3px solid var(--warn)'
                  : f.severity === 'tip'
                    ? '3px solid var(--accent)'
                    : '3px solid var(--border)',
            }}
          >
            <strong>
              [{f.severity}] {f.title}
            </strong>
            <div>{f.message}</div>
            {f.actions && f.actions.length > 0 && (
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                {f.actions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="btn"
                    onClick={() => onApply(a.patch)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
