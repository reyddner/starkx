import { useMemo, useState } from 'react'
import { openLibraryProject } from '../../store/workspaceBridge'
import {
  displayProjectName,
  foundationKindLabel,
  statusLabel,
  useLibraryStore,
  type ProjectStatus,
} from '../../store/projectLibrary'
import { ProjectCard } from './ProjectCard'
import { NewProjectDialog } from './NewProjectDialog'
import { useNewProjectDialog } from './useNewProjectDialog'

type Filter = 'all' | ProjectStatus | 'favorite'
type SortKey = 'updated' | 'name' | 'opened'

export function ProjectsView() {
  const projects = useLibraryStore((s) => s.projects)
  const duplicateProject = useLibraryStore((s) => s.duplicateProject)
  const deleteProject = useLibraryStore((s) => s.deleteProject)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)
  const { open, openDialog, closeDialog } = useNewProjectDialog()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('updated')
  const [view, setView] = useState<'cards' | 'list'>('cards')

  const list = useMemo(() => {
    let rows = [...projects]
    const query = q.trim().toLowerCase()
    if (query) {
      rows = rows.filter((p) =>
        [p.name, p.code, p.client, p.location, foundationKindLabel(String(p.foundationKind))]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    }
    if (filter === 'favorite') rows = rows.filter((p) => p.favorite)
    else if (filter !== 'all') rows = rows.filter((p) => p.status === filter)
    rows.sort((a, b) => {
      if (sort === 'name')
        return displayProjectName(a.name).localeCompare(displayProjectName(b.name), 'pt-BR')
      if (sort === 'opened') return b.lastOpenedAt.localeCompare(a.lastOpenedAt)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return rows
  }, [projects, q, filter, sort])

  const openProj = (id: string) => openLibraryProject(id)
  const edit = (id: string) => openLibraryProject(id, { step: 'project' })
  const duplicate = (id: string) => {
    const nid = duplicateProject(id)
    if (nid) openLibraryProject(nid, { step: 'project' })
  }

  return (
    <div className="shell-page" data-testid="projects-view">
      <NewProjectDialog open={open} onClose={closeDialog} />
      <header className="shell-page-header">
        <div>
          <h2>Projetos</h2>
          <p className="lead" style={{ margin: 0 }}>
            Biblioteca local — cada projeto é um modelo completo de fundação.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="projects-new"
          onClick={openDialog}
        >
          + Novo projeto
        </button>
      </header>

      <div className="proj-toolbar">
        <input
          type="search"
          placeholder="Pesquisar por nome, cliente, local…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="projects-search"
          aria-label="Pesquisar projetos"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Filtrar"
        >
          <option value="all">Todos</option>
          <option value="in_progress">Em andamento</option>
          <option value="complete">Concluídos</option>
          <option value="draft">Rascunhos</option>
          <option value="favorite">Favoritos</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Ordenar"
        >
          <option value="updated">Mais atualizados</option>
          <option value="opened">Últimos abertos</option>
          <option value="name">Nome</option>
        </select>
        <div className="viz-mode-toggle" role="group" aria-label="Modo de lista">
          <button
            type="button"
            className={view === 'cards' ? 'active' : ''}
            onClick={() => setView('cards')}
          >
            Cards
          </button>
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            Lista
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <section className="panel shell-empty">
          <h3>Nenhum projeto ainda</h3>
          <p className="lead">Crie o primeiro para organizar sondagem, cargas e resultados.</p>
          <button type="button" className="btn btn-primary" onClick={openDialog}>
            + Novo projeto
          </button>
        </section>
      ) : list.length === 0 ? (
        <section className="panel shell-empty">
          <p className="lead">Nenhum projeto neste filtro.</p>
          <button type="button" className="btn" onClick={() => setFilter('all')}>
            Limpar filtros
          </button>
        </section>
      ) : view === 'cards' ? (
        <div className="proj-grid">
          {list.map((p) => (
            <ProjectCard
              key={p.id}
              p={p}
              onOpen={openProj}
              onEdit={edit}
              onDuplicate={duplicate}
              onDelete={deleteProject}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table data-testid="projects-table">
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Local</th>
                <th>Atualizado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{displayProjectName(p.name)}</strong>
                    {p.code ? <div className="hint">{p.code}</div> : null}
                    {p.client ? <div className="hint">{p.client}</div> : null}
                  </td>
                  <td>{foundationKindLabel(String(p.foundationKind))}</td>
                  <td>
                    <span
                      className={
                        p.status === 'complete'
                          ? 'proj-status ok'
                          : p.status === 'in_progress'
                            ? 'proj-status warn'
                            : 'proj-status muted'
                      }
                    >
                      {statusLabel(p.status)}
                    </span>
                  </td>
                  <td>{p.location || '—'}</td>
                  <td>{new Date(p.updatedAt).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className="actions" style={{ margin: 0, gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => openProj(p.id)}
                      >
                        Abrir
                      </button>
                      <button type="button" className="btn" onClick={() => edit(p.id)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => toggleFavorite(p.id)}
                        title="Favorito"
                      >
                        {p.favorite ? '★' : '☆'}
                      </button>
                      <button type="button" className="btn" onClick={() => duplicate(p.id)}>
                        Duplicar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          if (confirm(`Excluir «${displayProjectName(p.name)}»?`))
                            deleteProject(p.id)
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
