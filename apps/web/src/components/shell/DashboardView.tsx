import { openLibraryProject } from '../../store/workspaceBridge'
import { displayProjectName, useLibraryStore } from '../../store/projectLibrary'
import { ProjectCard } from './ProjectCard'
import { NewProjectDialog } from './NewProjectDialog'
import { useNewProjectDialog } from './useNewProjectDialog'

export function DashboardView() {
  const projects = useLibraryStore((s) => s.projects)
  const setShellView = useLibraryStore((s) => s.setShellView)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)
  const { open, openDialog, closeDialog } = useNewProjectDialog()

  const recent = [...projects]
    .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
    .slice(0, 6)
  const inProgress = projects.filter((p) => p.status === 'in_progress')
  const complete = projects.filter((p) => p.status === 'complete')
  const favorites = projects.filter((p) => p.favorite)
  const lastOpened = recent[0]

  const openProj = (id: string) => {
    openLibraryProject(id)
  }

  return (
    <div className="shell-page" data-testid="dashboard-view">
      <NewProjectDialog open={open} onClose={closeDialog} />
      <header className="shell-page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="lead" style={{ margin: 0 }}>
            Visão geral dos projetos de fundação.
          </p>
        </div>
        <div className="shell-header-actions">
          {lastOpened && (
            <button
              type="button"
              className="btn"
              data-testid="dashboard-continue"
              onClick={() => openProj(lastOpened.id)}
              title={displayProjectName(lastOpened.name)}
            >
              Continuar: {displayProjectName(lastOpened.name)}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            data-testid="dashboard-new-project"
            onClick={openDialog}
          >
            + Novo projeto
          </button>
        </div>
      </header>

      <div className="kpi-row" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi">
          <div className="label">Projetos</div>
          <div className="value">{projects.length}</div>
        </div>
        <div className="kpi">
          <div className="label">Em andamento</div>
          <div className="value">{inProgress.length}</div>
        </div>
        <div className="kpi">
          <div className="label">Concluídos</div>
          <div className="value">{complete.length}</div>
        </div>
      </div>

      {projects.length === 0 ? (
        <section className="panel shell-empty">
          <h3>Comece pelo primeiro projeto</h3>
          <p className="lead">
            Cadastre os dados da obra, importe a sondagem e calcule a capacidade — tudo fica
            dentro do projeto.
          </p>
          <ol className="shell-empty-steps">
            <li>Nome e identificação da obra</li>
            <li>Sondagem SPT e perfil do solo</li>
            <li>Geometria, cargas e dimensionamento</li>
            <li>Resultados, 2D/3D e memorial</li>
          </ol>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="dashboard-empty-create"
            onClick={openDialog}
          >
            + Criar projeto
          </button>
        </section>
      ) : (
        <>
          {favorites.length > 0 && (
            <section className="shell-section">
              <h3>Favoritos</h3>
              <div className="proj-grid">
                {favorites.map((p) => (
                  <ProjectCard
                    key={p.id}
                    p={p}
                    onOpen={openProj}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </section>
          )}
          <section className="shell-section">
            <div className="shell-section-head">
              <h3>Recentes</h3>
              <button type="button" className="btn" onClick={() => setShellView('projects')}>
                Ver todos
              </button>
            </div>
            <div className="proj-grid">
              {recent.map((p) => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  onOpen={openProj}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>
          {inProgress.length > 0 && (
            <section className="shell-section">
              <h3>Em andamento</h3>
              <div className="proj-grid">
                {inProgress.slice(0, 6).map((p) => (
                  <ProjectCard
                    key={p.id}
                    p={p}
                    onOpen={openProj}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </section>
          )}
          {complete.length > 0 && (
            <section className="shell-section">
              <div className="shell-section-head">
                <h3>Concluídos</h3>
                <button type="button" className="btn" onClick={() => setShellView('projects')}>
                  Ver biblioteca
                </button>
              </div>
              <div className="proj-grid">
                {complete.slice(0, 4).map((p) => (
                  <ProjectCard
                    key={p.id}
                    p={p}
                    onOpen={openProj}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
