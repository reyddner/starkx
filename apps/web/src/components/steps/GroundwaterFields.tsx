import { useProjectStore } from '../../store/projectStore'

/**
 * Campos do nível d'água (DEC-58): vivem dentro da Sondagem, já que o NA é
 * lido na mesma investigação de campo. Na v1 o NA não altera Padm (DEC-06).
 */
export function GroundwaterFields() {
  const s = useProjectStore()

  return (
    <div data-testid="groundwater-fields">
      <h3 style={{ marginBottom: '0.25rem' }}>Nível d&apos;água (opcional)</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Profundidade do NA medida na sondagem. Aparece no perfil 2D/3D e no memorial; nesta versão
        não altera Padm (DEC-06). Pode deixar em branco.
      </p>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="na-depth">Profundidade do NA (m)</label>
          <input
            id="na-depth"
            type="number"
            value={s.waterLevel_m ?? ''}
            onChange={(e) =>
              s.patch({ waterLevel_m: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="não observado"
          />
        </div>
        <div className="field">
          <label htmlFor="na-elev">Cota do NA (m)</label>
          <input
            id="na-elev"
            type="number"
            readOnly
            value={
              s.waterLevel_m != null && s.groundElevation_m != null
                ? s.groundElevation_m - s.waterLevel_m
                : ''
            }
            placeholder="derivada"
          />
          <span className="hint">Calculada: cota do terreno − profundidade.</span>
        </div>
        <div className="field">
          <label htmlFor="na-date">Data da medição</label>
          <input
            id="na-date"
            type="text"
            value={s.waterLevelDate}
            onChange={(e) => s.patch({ waterLevelDate: e.target.value })}
            placeholder="AAAA-MM-DD"
          />
        </div>
        <div className="field">
          <label htmlFor="na-notes">Observações</label>
          <input
            id="na-notes"
            type="text"
            value={s.waterLevelNotes}
            onChange={(e) => s.patch({ waterLevelNotes: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
