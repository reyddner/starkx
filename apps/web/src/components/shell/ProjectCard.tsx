import {
  displayProjectName,
  foundationKindLabel,
  lastStepLabel,
  statusLabel,
  type ProjectListItem,
  type ProjectStatus,
} from '../../store/projectLibrary'

function statusClass(s: ProjectStatus): string {
  if (s === 'complete') return 'proj-status ok'
  if (s === 'in_progress') return 'proj-status warn'
  return 'proj-status muted'
}

export interface ProjectCardProps {
  p: ProjectListItem
  onOpen: (id: string) => void
  onToggleFavorite?: (id: string) => void
  onEdit?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
}

export function ProjectCard({
  p,
  onOpen,
  onToggleFavorite,
  onEdit,
  onDuplicate,
  onDelete,
}: ProjectCardProps) {
  const hasMenu = Boolean(onEdit || onDuplicate || onDelete)
  const step = lastStepLabel(p)

  return (
    <div className="proj-card-wrap">
      <button
        type="button"
        className="proj-card"
        data-testid={`project-card-${p.id}`}
        onClick={() => onOpen(p.id)}
      >
        <div className="proj-card-top">
          <strong className="proj-card-name">{displayProjectName(p.name)}</strong>
          <span className={statusClass(p.status)}>{statusLabel(p.status)}</span>
        </div>
        <div className="proj-card-meta">
          {p.code ? <span>{p.code}</span> : null}
          <span>{foundationKindLabel(String(p.foundationKind))}</span>
          {step ? <span className="proj-card-step">Etapa: {step}</span> : null}
        </div>
        {(p.client || p.location) && (
          <div className="proj-card-meta muted">
            {[p.client, p.location].filter(Boolean).join(' · ')}
          </div>
        )}
        <div className="proj-card-foot muted">
          Atualizado {new Date(p.updatedAt).toLocaleDateString('pt-BR')}
          {p.layerCount > 0 ? ` · ${p.layerCount} camadas SPT` : ''}
        </div>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          className="proj-card-fav"
          title={p.favorite ? 'Remover dos favoritos' : 'Favoritar'}
          aria-label={p.favorite ? 'Remover dos favoritos' : 'Favoritar'}
          onClick={() => onToggleFavorite(p.id)}
        >
          {p.favorite ? '★' : '☆'}
        </button>
      )}
      {hasMenu && (
        <div className="proj-card-actions" role="group" aria-label="Ações do projeto">
          <button type="button" className="btn btn-primary" onClick={() => onOpen(p.id)}>
            Abrir
          </button>
          {onEdit && (
            <button type="button" className="btn" onClick={() => onEdit(p.id)}>
              Editar
            </button>
          )}
          {onDuplicate && (
            <button type="button" className="btn" onClick={() => onDuplicate(p.id)}>
              Duplicar
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (confirm(`Excluir «${displayProjectName(p.name)}»?`)) onDelete(p.id)
              }}
            >
              Excluir
            </button>
          )}
        </div>
      )}
    </div>
  )
}
