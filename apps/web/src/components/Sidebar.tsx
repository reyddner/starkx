import { ProjectProgress } from './ProjectProgress'
import { visibleSteps, useProjectStore, type WizardStep } from '../store/projectStore'
import { canEnterStep, canRunCalculation, progressChecklist } from '../store/wizardFlow'
import { displayProjectName, useLibraryStore } from '../store/projectLibrary'
import { seedLibraryIfNeeded, syncActiveToLibrary } from '../store/workspaceBridge'
import { NewProjectDialog } from './shell/NewProjectDialog'
import { useNewProjectDialog } from './shell/useNewProjectDialog'
import { useEffect } from 'react'

export function Sidebar() {
  const step = useProjectStore((s) => s.step)
  const setStep = useProjectStore((s) => s.setStep)
  const theme = useProjectStore((s) => s.theme)
  const setTheme = useProjectStore((s) => s.setTheme)
  const foundationKind = useProjectStore((s) => s.foundationKind)
  const projectName = useProjectStore((s) => s.projectName)
  const loadReferenceExample = useProjectStore((s) => s.loadReferenceExample)
  const runCalculation = useProjectStore((s) => s.runCalculation)
  const toGateInput = useProjectStore((s) => s.toGateInput)
  const calcError = useProjectStore((s) => s.calcError)
  const navError = useProjectStore((s) => s.navError)

  const shellView = useLibraryStore((s) => s.shellView)
  const setShellView = useLibraryStore((s) => s.setShellView)
  const active = useLibraryStore((s) => s.getActive())
  const { open, openDialog, closeDialog } = useNewProjectDialog()

  const steps = visibleSteps(foundationKind)
  const gateInput = toGateInput()
  const calcGate = canRunCalculation(gateInput)
  const checklist = progressChecklist(gateInput)
  const statusById = new Map(checklist.map((c) => [c.id, c]))
  const inWorkspace = shellView === 'workspace'

  useEffect(() => {
    seedLibraryIfNeeded()
  }, [])

  const goShell = (v: 'dashboard' | 'projects') => {
    syncActiveToLibrary()
    setShellView(v)
  }

  return (
    <aside className="sidebar">
      <NewProjectDialog open={open} onClose={closeDialog} />
      <div className="brand">
        <a className="brand-lockup" href="#/" aria-label="STARKX — início">
          <img className="brand-mark" src="/logo-mark.svg" alt="" width={40} height={40} />
          <span className="brand-wordmark" aria-hidden="true">
            <span className="brand-stark">STARK</span>
            <span className="brand-x">X</span>
          </span>
        </a>
        <p>Sistema de projeto de fundações</p>
      </div>

      <nav aria-label="Navegação principal">
        <p className="nav-section-label">Geral</p>
        <ul className="nav-list">
          <li>
            <button
              type="button"
              className={shellView === 'dashboard' ? 'active' : ''}
              data-testid="nav-dashboard"
              onClick={() => goShell('dashboard')}
            >
              Dashboard
            </button>
          </li>
          <li>
            <button
              type="button"
              className={shellView === 'projects' ? 'active' : ''}
              data-testid="nav-projects"
              onClick={() => goShell('projects')}
            >
              Projetos
            </button>
          </li>
        </ul>
      </nav>

      {inWorkspace && (
        <>
          <div className="sidebar-project-chip" title={displayProjectName(projectName || active?.name)}>
            <span className="hint" style={{ color: 'var(--text-on-dark-muted)' }}>
              Projeto aberto
            </span>
            <strong>{displayProjectName(projectName || active?.name)}</strong>
          </div>
          <nav aria-label="Etapas do projeto">
            <p className="nav-section-label">Etapas</p>
            <ul className="nav-list">
              {steps.map((item, i) => {
                const st = statusById.get(item.id)
                const blocked = st?.blocked === true
                const gate = canEnterStep(gateInput, item.id as WizardStep)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={[step === item.id ? 'active' : '', blocked ? 'nav-blocked' : '']
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setStep(item.id as WizardStep)}
                      disabled={blocked}
                      title={blocked ? gate.reason : undefined}
                      aria-disabled={blocked}
                      data-testid={`nav-step-${item.id}`}
                    >
                      {i + 1}. {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
          <ProjectProgress />
        </>
      )}

      {!inWorkspace && (
        <p className="sidebar-shell-hint" data-testid="sidebar-shell-hint">
          Abra um projeto na biblioteca ou crie um novo para acessar as etapas de cálculo.
        </p>
      )}

      <div className="sidebar-footer">
        {(navError || calcError) && inWorkspace && (
          <p className="hint" style={{ color: 'var(--danger, #f88)', marginBottom: '0.5rem' }}>
            {navError ?? calcError}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary"
          data-testid="sidebar-new-project"
          onClick={openDialog}
        >
          + Novo projeto
        </button>
        {inWorkspace && (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: 'var(--text-on-dark)' }}
              onClick={() => {
                loadReferenceExample()
                syncActiveToLibrary()
              }}
              data-testid="sidebar-load-example"
            >
              Carregar exemplo (estaca escavada Ø30)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                runCalculation()
                syncActiveToLibrary()
              }}
              disabled={!calcGate.ok}
              title={calcGate.reason}
              data-testid="sidebar-calculate"
            >
              Calcular
            </button>
          </>
        )}
        <button
          type="button"
          className="btn"
          style={{ color: 'var(--text-on-dark)', background: 'transparent' }}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          Tema: {theme === 'light' ? 'claro' : 'escuro'}
        </button>
        <p className="brand-copyright">STARKX · AGPL-3.0</p>
      </div>
    </aside>
  )
}
