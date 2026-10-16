import { useProjectStore } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'

function cellNum(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? '' : String(v)
}

export function StepLoads() {
  const s = useProjectStore()
  const isCap = s.foundationKind === 'pile_cap'
  const canDimAll =
    (s.foundationKind === 'pile' || s.foundationKind === 'pile_cap') && s.result != null

  return (
    <section className="panel" data-testid="step-loads">
      <h2>Cargas / pilares</h2>
      <p className="lead">
        Informe a quantidade de pilares e preencha N, momentos, cortantes e seção. O motor
        usa esses dados na análise e no dimensionamento (DEC-54).
      </p>

      <div className="field" style={{ maxWidth: '12rem' }}>
        <label htmlFor="n-columns">Quantidade de pilares</label>
        <input
          id="n-columns"
          type="number"
          min={1}
          max={50}
          data-testid="column-count"
          value={s.columns.length}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) s.setColumnCount(n)
          }}
        />
      </div>

      <div className="loads-table-wrap" data-testid="columns-list" style={{ overflowX: 'auto', marginTop: '1rem' }}>
        <table className="loads-table" aria-label="Pilares e cargas">
          <thead>
            <tr>
              <th>Pilar</th>
              <th>Dx (m)</th>
              <th>Dy (m)</th>
              <th>N (kN)</th>
              <th>Mx</th>
              <th>My</th>
              <th>Qx</th>
              <th>Qy</th>
            </tr>
          </thead>
          <tbody>
            {s.columns.map((col) => {
              const active = col.id === s.activeColumnId
              return (
                <tr
                  key={col.id}
                  data-testid={`column-row-${col.columnLabel}`}
                  className={active ? 'loads-row-active' : undefined}
                  onClick={() => {
                    if (!active) s.setActiveColumn(col.id)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <input
                      aria-label={`Rótulo ${col.columnLabel}`}
                      value={col.columnLabel}
                      onChange={(e) => s.patchColumnById(col.id, { columnLabel: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step={0.05}
                      aria-label={`Dx ${col.columnLabel}`}
                      value={cellNum(col.columnWidth_m)}
                      onChange={(e) =>
                        s.patchColumnById(col.id, {
                          columnWidth_m: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step={0.05}
                      aria-label={`Dy ${col.columnLabel}`}
                      value={cellNum(col.columnDepth_m)}
                      onChange={(e) =>
                        s.patchColumnById(col.id, {
                          columnDepth_m: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label={`N ${col.columnLabel}`}
                      data-testid={active ? 'load' : undefined}
                      value={cellNum(col.N_kN)}
                      onChange={(e) =>
                        s.patchColumnById(col.id, {
                          N_kN: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label={`Mx ${col.columnLabel}`}
                      value={cellNum(col.Mx_kNm)}
                      onChange={(e) =>
                        s.patchColumnById(col.id, {
                          Mx_kNm: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label={`My ${col.columnLabel}`}
                      value={cellNum(col.My_kNm)}
                      onChange={(e) =>
                        s.patchColumnById(col.id, {
                          My_kNm: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label={`Qx ${col.columnLabel}`}
                      value={cellNum(col.Qx_kN)}
                      onChange={(e) =>
                        s.patchColumnById(col.id, {
                          Qx_kN: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label={`Qy ${col.columnLabel}`}
                      value={cellNum(col.Qy_kN)}
                      onChange={(e) =>
                        s.patchColumnById(col.id, {
                          Qy_kN: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="hint" style={{ marginTop: '0.65rem' }}>
        Clique na linha para ativar o pilar. Mx/My/Qx/Qy entram na armadura e no grupo
        {isCap ? '; N é a carga total do bloco.' : '.'}
      </p>

      <div className="field" style={{ marginTop: '0.75rem' }}>
        <label className="hint" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            id="lid"
            type="checkbox"
            checked={s.loadIsDesign}
            onChange={(e) => s.patch({ loadIsDesign: e.target.checked })}
          />
          Já é Nd (γf = 1). Senão Nd = 1,4 × Nk nos motores estruturais.
        </label>
      </div>

      {canDimAll && (
        <div style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn"
            data-testid="dimension-all-columns"
            onClick={() => s.runAllColumnCaps()}
          >
            Dimensionar blocos de todos
          </button>
          <span className="hint" style={{ marginLeft: '0.65rem' }}>
            Disponível após Padm calculado (DEC-45).
          </span>
        </div>
      )}

      <FlowNavButtons primaryLabel="Continuar · Análise" />
    </section>
  )
}
