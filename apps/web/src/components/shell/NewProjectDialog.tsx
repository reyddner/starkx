import { useEffect, useId, useState, type FormEvent } from 'react'
import { createAndOpenProject } from '../../store/workspaceBridge'

export interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const titleId = useId()
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [location, setLocation] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setClient('')
    setLocation('')
    setCode('')
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Informe o nome do projeto (ex.: Residência Família Silva).')
      return
    }
    createAndOpenProject({
      name: trimmed,
      client: client.trim() || undefined,
      location: location.trim() || undefined,
      code: code.trim() || undefined,
    })
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      data-testid="new-project-dialog"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id={titleId}>Novo projeto</h2>
        <p className="lead" style={{ marginTop: 0 }}>
          Dê um nome real à obra. O ID interno fica só no sistema.
        </p>
        <form onSubmit={submit}>
          <div className="grid-2">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="np-name">Nome do projeto *</label>
              <input
                id="np-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Residência Família Silva"
                autoFocus
                data-testid="new-project-name"
              />
            </div>
            <div className="field">
              <label htmlFor="np-client">Cliente</label>
              <input
                id="np-client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                data-testid="new-project-client"
              />
            </div>
            <div className="field">
              <label htmlFor="np-loc">Localização</label>
              <input
                id="np-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                data-testid="new-project-location"
              />
            </div>
            <div className="field">
              <label htmlFor="np-code">Código (opcional)</label>
              <input
                id="np-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex.: OB-2026-014"
                data-testid="new-project-code"
              />
            </div>
          </div>
          {error && (
            <p className="hint" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
              {error}
            </p>
          )}
          <div className="actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" data-testid="new-project-submit">
              Criar e abrir
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
