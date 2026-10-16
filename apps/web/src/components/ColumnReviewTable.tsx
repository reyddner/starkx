import type { ColumnRecord } from '../store/columns'
import { foundationKindLabelPt, type SuggestableFoundationKind } from '@assist/index'

export interface ColumnProbeRow {
  columnId: string
  label: string
  N_kN: number
  footingOk: boolean
  suggestedKind: SuggestableFoundationKind
  message: string
}

interface ColumnReviewTableProps {
  columns: ColumnRecord[]
  activeColumnId: string
  probes?: ColumnProbeRow[] | null
  onSelect: (id: string) => void
  onReview?: (id: string) => void
  /** Permite editar N (kN) do pilar ativo / clicado. */
  editableN?: boolean
  onChangeN?: (id: string, N_kN: number | null) => void
  /** Mostra resumos de bloco (DEC-45) quando existirem */
  showCaps?: boolean
  testId?: string
}

function situacaoCap(c: ColumnRecord): string {
  const sum = c.capSummary
  if (sum == null) return '—'
  if (sum.pileCount === 0) return 'Sem N'
  if (sum.groupOk === false) return 'Grupo: atenção'
  if (sum.capacityOk === false) return 'Capacidade: não'
  if (sum.indicative) return 'Indicativo (η)'
  if (sum.capacityOk === true || sum.groupOk === true) return 'OK'
  return 'Calculado'
}

/** Tabela de revisão multi-pilar (DEC-55) — ativar / revisar / editar N. */
export function ColumnReviewTable({
  columns,
  activeColumnId,
  probes,
  onSelect,
  onReview,
  editableN = false,
  onChangeN,
  showCaps = true,
  testId = 'column-review-table',
}: ColumnReviewTableProps) {
  const probeById = new Map((probes ?? []).map((p) => [p.columnId, p]))

  return (
    <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
      <table className="loads-table" data-testid={testId} aria-label="Revisão dos pilares">
        <thead>
          <tr>
            <th>Pilar</th>
            <th>N (kN)</th>
            {probes && probes.length > 0 && (
              <>
                <th>Sugestão</th>
                <th>Sapata</th>
              </>
            )}
            {showCaps && (
              <>
                <th>n</th>
                <th>Bloco</th>
                <th>Situação</th>
              </>
            )}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => {
            const probe = probeById.get(c.id)
            const sum = c.capSummary
            const active = c.id === activeColumnId
            return (
              <tr
                key={c.id}
                className={active ? 'loads-row-active' : undefined}
                onClick={() => onSelect(c.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  {c.columnLabel}
                  {active ? ' · ativo' : ''}
                </td>
                <td onClick={(e) => editableN && e.stopPropagation()}>
                  {editableN && onChangeN ? (
                    <input
                      type="number"
                      className="input"
                      data-testid={`column-n-${c.columnLabel}`}
                      aria-label={`N do pilar ${c.columnLabel} (kN)`}
                      value={c.N_kN ?? ''}
                      min={0}
                      step={10}
                      style={{ width: '6.5rem', padding: '0.25rem 0.4rem' }}
                      onChange={(e) => {
                        const raw = e.target.value.trim()
                        if (raw === '') {
                          onChangeN(c.id, null)
                          return
                        }
                        const n = Number(raw)
                        onChangeN(c.id, Number.isFinite(n) ? n : null)
                      }}
                      onFocus={() => onSelect(c.id)}
                    />
                  ) : c.N_kN != null ? (
                    c.N_kN.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                  ) : (
                    '—'
                  )}
                </td>
                {probes && probes.length > 0 && (
                  <>
                    <td>
                      {probe
                        ? foundationKindLabelPt[probe.suggestedKind] ?? probe.suggestedKind
                        : '—'}
                    </td>
                    <td>{probe ? (probe.footingOk ? 'OK' : '—') : '—'}</td>
                  </>
                )}
                {showCaps && (
                  <>
                    <td>{sum?.pileCount ?? '—'}</td>
                    <td>
                      {sum?.width_m != null && sum.length_m != null
                        ? `${sum.width_m.toFixed(2)}×${sum.length_m.toFixed(2)}`
                        : '—'}
                    </td>
                    <td>{situacaoCap(c)}</td>
                  </>
                )}
                <td>
                  {onReview && (
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                      data-testid={`review-column-${c.columnLabel}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onReview(c.id)
                      }}
                    >
                      Revisar
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
