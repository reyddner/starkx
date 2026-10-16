/** Cargas do pilar (6DOF) — DEC-37 / DEC-44. */
export interface ColumnLoadInput {
  N_kN: number | null
  Mx_kNm: number | null
  My_kNm: number | null
  Qx_kN: number | null
  Qy_kN: number | null
  T_kNm: number | null
  columnWidth_m: number | null
  columnDepth_m: number | null
  columnLabel: string
}

/** Arranjo/bloco por pilar (DEC-45). */
export interface ColumnCapLayout {
  blockRows: number
  blockCols: number
  blockSpacing_m: number | null
  blockEdge_m: number
  blockThickness_m: number
  blockEfficiency: number | null
}

/** Resumo do último dimensionamento de grupo/bloco do pilar. */
export interface ColumnCapSummary {
  pileCount: number
  rows: number
  cols: number
  groupPadm_kN: number | null
  capacityOk: boolean | null
  groupOk: boolean | null
  maxPileLoad_kN: number | null
  width_m: number | null
  length_m: number | null
  thickness_m: number | null
  efficiency: number | null
  indicative: boolean
  message: string
}

/** Pilar cadastrado. O ativo espelha `columnLoad` / `designLoad_kN`. */
export interface ColumnRecord extends ColumnLoadInput {
  id: string
  layout?: ColumnCapLayout
  capSummary?: ColumnCapSummary | null
}

export function emptyColumnLoad(): ColumnLoadInput {
  return {
    N_kN: null,
    Mx_kNm: null,
    My_kNm: null,
    Qx_kN: null,
    Qy_kN: null,
    T_kNm: null,
    columnWidth_m: 0.3,
    columnDepth_m: 0.5,
    columnLabel: 'P01',
  }
}

export function newColumnId(): string {
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function nextColumnLabel(existing: { columnLabel: string }[]): string {
  const used = new Set(existing.map((c) => c.columnLabel.trim().toUpperCase()))
  for (let i = 1; i <= 99; i++) {
    const label = `P${String(i).padStart(2, '0')}`
    if (!used.has(label)) return label
  }
  return `P${existing.length + 1}`
}

export function createColumn(
  partial?: Partial<ColumnLoadInput> & { id?: string; layout?: ColumnCapLayout; capSummary?: ColumnCapSummary | null },
  siblings: { columnLabel: string }[] = [],
): ColumnRecord {
  const base = emptyColumnLoad()
  return {
    ...base,
    ...partial,
    id: partial?.id ?? newColumnId(),
    columnLabel: partial?.columnLabel ?? nextColumnLabel(siblings),
  }
}

export function columnToLoad(c: ColumnRecord): ColumnLoadInput {
  return {
    N_kN: c.N_kN,
    Mx_kNm: c.Mx_kNm,
    My_kNm: c.My_kNm,
    Qx_kN: c.Qx_kN,
    Qy_kN: c.Qy_kN,
    T_kNm: c.T_kNm,
    columnWidth_m: c.columnWidth_m,
    columnDepth_m: c.columnDepth_m,
    columnLabel: c.columnLabel,
  }
}

export function upsertColumn(
  columns: ColumnRecord[],
  id: string,
  patch: Partial<ColumnLoadInput> & {
    layout?: ColumnCapLayout
    capSummary?: ColumnCapSummary | null
  },
): ColumnRecord[] {
  return columns.map((c) => (c.id === id ? { ...c, ...patch } : c))
}

export function ensureColumnsFromLegacy(
  columnLoad: ColumnLoadInput,
  columns: ColumnRecord[] | undefined | null,
  activeColumnId: string | undefined | null,
): { columns: ColumnRecord[]; activeColumnId: string } {
  if (columns && columns.length > 0) {
    const active =
      activeColumnId && columns.some((c) => c.id === activeColumnId)
        ? activeColumnId
        : columns[0]!.id
    return { columns, activeColumnId: active }
  }
  const first = createColumn({ ...columnLoad, columnLabel: columnLoad.columnLabel || 'P01' })
  return { columns: [first], activeColumnId: first.id }
}

/** Redimensiona a lista para exatamente `n` pilares (1…50), preservando os existentes. */
export function resizeColumns(
  columns: ColumnRecord[],
  n: number,
  activeColumnId: string,
): { columns: ColumnRecord[]; activeColumnId: string } {
  const target = Math.max(1, Math.min(50, Math.floor(n)))
  let next = columns.slice(0, target)
  while (next.length < target) {
    next = [...next, createColumn({}, next)]
  }
  const active =
    next.some((c) => c.id === activeColumnId) ? activeColumnId : next[0]!.id
  return { columns: next, activeColumnId: active }
}

export function hasAnyColumnLoad(columns: ColumnRecord[], designLoad_kN: number | null): boolean {
  if (columns.some((c) => c.N_kN != null && c.N_kN > 0)) return true
  return designLoad_kN != null && designLoad_kN > 0
}
