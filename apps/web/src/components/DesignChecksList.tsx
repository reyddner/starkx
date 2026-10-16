/** Lista legível de verificações dos motores (status → rótulo PT). */

export interface DesignCheckItem {
  id: string
  status: 'ok' | 'warning' | 'error' | string
  title: string
  message: string
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  warning: 'Atenção',
  error: 'Falhou',
}

function statusClass(status: string): string {
  if (status === 'ok') return 'check-ok'
  if (status === 'warning') return 'check-warn'
  if (status === 'error') return 'check-error'
  return 'check-na'
}

export function DesignChecksList({ checks }: { checks: DesignCheckItem[] }) {
  if (checks.length === 0) return null
  return (
    <ul className="design-checks" data-testid="design-checks">
      {checks.map((c) => (
        <li key={c.id} className={statusClass(c.status)}>
          <span className="design-check-badge">{STATUS_LABEL[c.status] ?? c.status}</span>
          <span>
            <strong>{c.title}</strong>
            {c.message ? ` — ${c.message}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
