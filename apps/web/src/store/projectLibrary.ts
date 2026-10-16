/**
 * Biblioteca local de projetos (DEC-50).
 * projectStore continua sendo o workspace aberto; aqui só catálogo + snapshots de input.
 * Multi-SPT futuro: payload por projeto não impede borehole[] depois.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FoundationKindUi } from './wizardTypes'

export type ShellView = 'dashboard' | 'projects' | 'workspace'
export type ProjectStatus = 'draft' | 'in_progress' | 'complete'

/** Snapshot de inputs do workspace (espelha partialize; sem resultados de motor). */
export type ProjectWorkspacePayload = Record<string, unknown>

export interface ProjectListItem {
  id: string
  /** Nome amigável exibido (espelha projectName). */
  name: string
  code: string
  client: string
  location: string
  foundationKind: FoundationKindUi | string
  status: ProjectStatus
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  layerCount: number
  payload: ProjectWorkspacePayload
}

export function newProjectId(): string {
  return `prj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function foundationKindLabel(kind: string): string {
  switch (kind) {
    case 'pile':
      return 'Estaca isolada'
    case 'pile_cap':
      return 'Bloco sobre estacas'
    case 'footing':
      return 'Sapata'
    case 'caisson':
      return 'Tubulão'
    case 'raft':
      return 'Radier'
    default:
      return kind || '—'
  }
}

export function displayProjectName(name: string | null | undefined): string {
  const t = (name ?? '').trim()
  return t.length > 0 ? t : 'Projeto sem nome'
}

export function deriveProjectStatus(input: {
  projectName?: string
  layers?: unknown[]
  designLoad_kN?: number | null
  hasCapacityHint?: boolean
}): ProjectStatus {
  const layers = input.layers?.length ?? 0
  const named = (input.projectName ?? '').trim().length > 0
  if (input.hasCapacityHint) return 'complete'
  if (layers > 0 || (input.designLoad_kN != null && input.designLoad_kN > 0)) {
    return 'in_progress'
  }
  if (!named) return 'draft'
  return 'draft'
}

export function statusLabel(s: ProjectStatus): string {
  if (s === 'complete') return 'Concluído'
  if (s === 'in_progress') return 'Em andamento'
  return 'Rascunho'
}

/** Rótulo da última etapa salva no snapshot (para cards). */
export function lastStepLabel(item: ProjectListItem): string | null {
  const step = item.payload?.step
  if (typeof step !== 'string' || !step) return null
  const labels: Record<string, string> = {
    project: 'Dados da obra',
    borehole: 'Sondagem',
    groundwater: "Nível d'água",
    loads: 'Cargas / pilares',
    analysis: 'Análise',
    foundation: 'Confirmar fundação',
    pile: 'Geometria',
    methods: 'Métodos',
    results: 'Capacidade',
    tip_sweep: 'Cota de apoio',
    group: 'Grupo',
    block: 'Bloco',
    footing: 'Sapata',
    caisson: 'Tubulão',
    raft: 'Radier',
    rebar: 'Armadura',
    drawings: 'Desenhos',
    memorial: 'Memorial',
  }
  return labels[step] ?? step
}

function metaFromPayload(
  id: string,
  payload: ProjectWorkspacePayload,
  prev?: ProjectListItem,
): ProjectListItem {
  const now = new Date().toISOString()
  const name = String(payload.projectName ?? '')
  const layers = Array.isArray(payload.layers) ? payload.layers : []
  const hasCapacityHint = payload.__hasCapacityHint === true
  return {
    id,
    name: displayProjectName(name),
    code: String(payload.projectCode ?? ''),
    client: String(payload.client ?? ''),
    location: String(payload.location ?? ''),
    foundationKind: String(payload.foundationKind ?? 'pile_cap'),
    status: deriveProjectStatus({
      projectName: name,
      layers,
      designLoad_kN:
        typeof payload.designLoad_kN === 'number' ? payload.designLoad_kN : null,
      hasCapacityHint,
    }),
    favorite: prev?.favorite ?? false,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    lastOpenedAt: prev?.lastOpenedAt ?? now,
    layerCount: layers.length,
    payload: { ...payload },
  }
}

interface LibraryState {
  projects: ProjectListItem[]
  activeProjectId: string | null
  shellView: ShellView
  setShellView: (v: ShellView) => void
  /** Garante ao menos um projeto a partir do workspace atual (migração). */
  ensureSeedFromWorkspace: (payload: ProjectWorkspacePayload) => string
  createProject: (opts?: {
    name?: string
    client?: string
    location?: string
    code?: string
    payload?: ProjectWorkspacePayload
  }) => string
  /** Persiste o workspace aberto na biblioteca. */
  saveActivePayload: (payload: ProjectWorkspacePayload) => void
  openProject: (id: string) => ProjectListItem | null
  duplicateProject: (id: string) => string | null
  deleteProject: (id: string) => void
  toggleFavorite: (id: string) => void
  getActive: () => ProjectListItem | null
}

const emptyPayload = (): ProjectWorkspacePayload => ({
  foundationKind: 'pile_cap',
  projectName: '',
  projectCode: '',
  client: '',
  location: '',
  responsibleEngineer: '',
  layers: [],
  designLoad_kN: null,
  mode: 'engineering',
  governingRule: 'minimum',
  selectedMethod: 'aoki_velloso',
  pileTypeId: 6,
  diameterCm: 30,
  tipDepth_m: 4,
})

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      shellView: 'dashboard',
      setShellView: (shellView) => set({ shellView }),
      ensureSeedFromWorkspace: (payload) => {
        const s = get()
        if (s.projects.length > 0) {
          if (!s.activeProjectId) {
            const id = s.projects[0]!.id
            set({ activeProjectId: id })
            return id
          }
          return s.activeProjectId
        }
        const id = newProjectId()
        const item = metaFromPayload(id, payload)
        set({
          projects: [item],
          activeProjectId: id,
        })
        return id
      },
      createProject: (opts = {}) => {
        const id = newProjectId()
        const base = opts.payload ?? emptyPayload()
        const payload: ProjectWorkspacePayload = {
          ...base,
          projectName: opts.name ?? base.projectName ?? '',
          client: opts.client ?? base.client ?? '',
          location: opts.location ?? base.location ?? '',
          projectCode: opts.code ?? base.projectCode ?? '',
        }
        const item = metaFromPayload(id, payload)
        const now = new Date().toISOString()
        item.lastOpenedAt = now
        set((s) => ({
          projects: [item, ...s.projects],
          activeProjectId: id,
          shellView: 'workspace',
        }))
        return id
      },
      saveActivePayload: (payload) => {
        const s = get()
        const id = s.activeProjectId
        if (!id) return
        set({
          projects: s.projects.map((p) =>
            p.id === id ? metaFromPayload(id, payload, p) : p,
          ),
        })
      },
      openProject: (id) => {
        const item = get().projects.find((p) => p.id === id)
        if (!item) return null
        const now = new Date().toISOString()
        set((s) => ({
          activeProjectId: id,
          shellView: 'workspace',
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, lastOpenedAt: now } : p,
          ),
        }))
        return { ...item, lastOpenedAt: now }
      },
      duplicateProject: (id) => {
        const src = get().projects.find((p) => p.id === id)
        if (!src) return null
        const newId = newProjectId()
        const payload = {
          ...src.payload,
          projectName: `${displayProjectName(src.name)} (cópia)`,
        }
        const item = metaFromPayload(newId, payload)
        set((s) => ({
          projects: [item, ...s.projects],
        }))
        return newId
      },
      deleteProject: (id) => {
        const s = get()
        const projects = s.projects.filter((p) => p.id !== id)
        let activeProjectId = s.activeProjectId
        let shellView = s.shellView
        if (activeProjectId === id) {
          // Sai do workspace para não ficar com store órfão; usuário reabre outro.
          activeProjectId = projects[0]?.id ?? null
          shellView = projects.length > 0 ? 'projects' : 'dashboard'
        }
        set({ projects, activeProjectId, shellView })
      },
      toggleFavorite: (id) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, favorite: !p.favorite } : p,
          ),
        }))
      },
      getActive: () => {
        const s = get()
        return s.projects.find((p) => p.id === s.activeProjectId) ?? null
      },
    }),
    {
      name: 'starkx-library-v1',
      version: 1,
      partialize: (s) => ({
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        shellView: s.shellView,
      }),
    },
  ),
)
