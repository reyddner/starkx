import { analyzeProjectAlerts } from '@assist/index'
import { useProjectStore } from '../store/projectStore'

/** Alertas de projeto visíveis em qualquer etapa (DEC-43). */
export function ProjectAlertsBanner() {
  const s = useProjectStore()
  const findings = analyzeProjectAlerts({
    foundationKind:
      s.foundationKind === 'pile_cap'
        ? 'pile_cap'
        : s.foundationKind === 'footing'
          ? 'footing'
          : s.foundationKind === 'caisson'
            ? 'caisson'
            : s.foundationKind === 'raft'
              ? 'raft'
              : 'pile',
    layers: s.layers,
    waterLevel_m: s.waterLevel_m,
    designLoad_kN: s.designLoad_kN,
    tipDepth_m: s.tipDepth_m,
    hasCapacityResult:
      s.result != null ||
      s.footingResult != null ||
      s.caissonResult != null ||
      s.raftResult != null,
    columnLabel: s.columnLoad.columnLabel,
  }).filter((f) => f.severity === 'warning')

  if (findings.length === 0) return null

  return (
    <div className="project-alerts" data-testid="project-alerts" role="region" aria-label="Alertas do projeto">
      {findings.slice(0, 4).map((f) => (
        <div
          key={f.id}
          className="scope-banner"
          style={{ borderLeft: '3px solid var(--warn)', marginBottom: '0.5rem' }}
        >
          <strong>{f.title}</strong>
          <div className="hint" style={{ marginTop: '0.25rem' }}>
            {f.message}
          </div>
        </div>
      ))}
    </div>
  )
}
