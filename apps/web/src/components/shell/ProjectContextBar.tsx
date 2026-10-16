import {
  displayProjectName,
  foundationKindLabel,
  useLibraryStore,
} from '../../store/projectLibrary'
import { useProjectStore, visibleSteps } from '../../store/projectStore'
import { syncActiveToLibrary } from '../../store/workspaceBridge'

export function ProjectContextBar() {
  const name = useProjectStore((s) => s.projectName)
  const kind = useProjectStore((s) => s.foundationKind)
  const step = useProjectStore((s) => s.step)
  const location = useProjectStore((s) => s.location)
  const client = useProjectStore((s) => s.client)
  const setStep = useProjectStore((s) => s.setStep)
  const setShellView = useLibraryStore((s) => s.setShellView)
  const active = useLibraryStore((s) => s.projects.find((p) => p.id === s.activeProjectId))

  const displayName = displayProjectName(name || active?.name)
  const stepMeta = visibleSteps(kind).find((s) => s.id === step)
  const stepLabel = stepMeta?.label ?? step
  const subtitle = [client, location].filter(Boolean).join(' · ')

  return (
    <div className="project-context-bar" data-testid="project-context-bar">
      <div className="project-context-text">
        <nav className="breadcrumb" aria-label="Navegação">
          <button
            type="button"
            className="linkish"
            onClick={() => {
              syncActiveToLibrary()
              setShellView('dashboard')
            }}
          >
            Dashboard
          </button>
          <span aria-hidden> / </span>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              syncActiveToLibrary()
              setShellView('projects')
            }}
          >
            Projetos
          </button>
          <span aria-hidden> / </span>
          <button
            type="button"
            className="linkish"
            data-testid="context-goto-dados"
            onClick={() => setStep('project')}
            title="Ir para dados do projeto"
          >
            {displayName}
          </button>
          <span aria-hidden> / </span>
          <span data-testid="context-step-label">{stepLabel}</span>
        </nav>
        <div className="project-context-title">
          <strong>{displayName}</strong>
          <span className="hint">{foundationKindLabel(kind)}</span>
          {subtitle ? <span className="hint project-context-sub">{subtitle}</span> : null}
        </div>
      </div>
    </div>
  )
}
