import { useProjectStore } from '../store/projectStore'
import { progressChecklist } from '../store/wizardFlow'

/** Checklist compacto de progresso (DEC-37) — status only; navegação fica na lista acima. */
export function ProjectProgress() {
  const s = useProjectStore()
  const items = progressChecklist(s.toGateInput())
  const done = items.filter((i) => i.done).length

  return (
    <div className="project-progress" data-testid="project-progress">
      <div className="hint" style={{ marginBottom: '0.35rem' }}>
        Progresso {done}/{items.length}
      </div>
      <ul
        className="hint"
        style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.75rem', lineHeight: 1.45 }}
      >
        {items.map((c) => (
          <li key={c.id} title={c.reason} style={{ opacity: c.blocked ? 0.5 : 1 }}>
            {c.done ? '✓' : c.blocked ? '·' : c.status === 'current' ? '→' : '○'} {c.label}
          </li>
        ))}
      </ul>
      {s.navError && (
        <div className="error-box" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
          {s.navError}
        </div>
      )}
    </div>
  )
}
