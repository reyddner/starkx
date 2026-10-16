import { Fragment, useRef, useState } from 'react'
import { SOIL_TYPES } from '@engine/catalogs'
import {
  exportBoreholeJson,
  parseBoreholeImport,
  suggestSoilFromDescription,
  type BoreholeImportPreview,
} from '@assist/index'
import { useProjectStore, type LayerRow } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'
import { GroundwaterFields } from './GroundwaterFields'

function isXlsxFile(file: File): boolean {
  const n = file.name.toLowerCase()
  return n.endsWith('.xlsx') || n.endsWith('.xls')
}

export function StepBorehole() {
  const s = useProjectStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<BoreholeImportPreview | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** DEC-35: XLSX SheetJS só após opt-in explícito */
  const [allowXlsx, setAllowXlsx] = useState(false)
  /** Descarta sugestão até a descrição mudar (DEC-40). */
  const [dismissedSuggest, setDismissedSuggest] = useState<Record<number, string>>({})

  const updateLayer = (idx: number, patch: Partial<LayerRow>) => {
    const layers = s.layers.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    s.patch({ layers })
  }

  const addLayer = () => {
    const next = (s.layers.at(-1)?.depth_m ?? 0) + 1
    s.patch({
      layers: [...s.layers, { depth_m: next, nspt: 10, soilTypeId: 12 }],
    })
  }

  const removeLayer = (idx: number) => {
    s.patch({ layers: s.layers.filter((_, i) => i !== idx) })
  }

  const onFile = async (file: File | null) => {
    setImportError(null)
    setPreview(null)
    if (!file) return
    if (isXlsxFile(file) && !allowXlsx) {
      setImportError(
        'Importação .xlsx desativada. Marque «Permitir arquivo .xlsx» ou use JSON/CSV.',
      )
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setBusy(true)
    try {
      if (isXlsxFile(file)) {
        const { parseBoreholeXlsx } = await import('@assist/importBoreholeXlsx')
        const buf = await file.arrayBuffer()
        setPreview(await parseBoreholeXlsx(buf))
      } else {
        const text = await file.text()
        setPreview(parseBoreholeImport(text))
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const confirmImport = () => {
    if (!preview?.ok) return
    s.patch({
      layers: preview.layers.map((l) => ({
        depth_m: l.depth_m,
        nspt: l.nspt,
        soilTypeId: l.soilTypeId,
      })),
      ...(preview.waterLevel_m != null ? { waterLevel_m: preview.waterLevel_m } : {}),
      result: null,
      structural: null,
      blockResult: null,
    })
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const exportJson = () => {
    const json = exportBoreholeJson({
      layers: s.layers,
      waterLevel_m: s.waterLevel_m,
    })
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${s.projectCode || 'starkx'}-sondagem.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportXlsx = async () => {
    setBusy(true)
    try {
      const { exportBoreholeXlsx } = await import('@assist/importBoreholeXlsx')
      const buf = await exportBoreholeXlsx({
        layers: s.layers,
        waterLevel_m: s.waterLevel_m,
      })
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${s.projectCode || 'starkx'}-sondagem.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2>Sondagem SPT</h2>
      <p className="lead">
        Profundidades a partir da cota 0 (superfície / topo do bloco). Aceita cotas fracionárias
        (ex.: 1,45 m) no modo engineering. O campo <strong>Tipo para métodos</strong> escolhe o solo
        do catálogo Aoki/Décourt/Teixeira (coeficientes K, α, C…).
      </p>

      {(s.foundationKind === 'footing' || s.foundationKind === 'raft') && (
        <div className="scope-banner" role="status">
          Em sapata/radier, as camadas SPT <strong>não entram</strong> no motor (usam c′, φ′, γ ou σadm /
          FS informados). O perfil abaixo fica só para registro no memorial/contexto.
        </div>
      )}
      {s.foundationKind === 'caisson' && s.caissonShaftMode === 'spt_aoki' && (
        <div className="scope-banner" role="status">
          No tubulão com fuste <strong>α·NSPT (Aoki)</strong>, as camadas SPT <strong>entram</strong> no
          cálculo do atrito lateral. Mantenha o perfil coerente com o comprimento do fuste.
        </div>
      )}
      {s.foundationKind === 'caisson' && s.caissonShaftMode === 'user' && (
        <div className="scope-banner" role="status">
          No tubulão com fs informado, as camadas SPT <strong>não entram</strong> no fuste (só registro).
          A ponta usa σadm ou Vesic conforme o modo escolhido.
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <div className="field">
          <label htmlFor="bh-import">Importar sondagem (JSON ou CSV)</label>
          <input
            id="bh-import"
            ref={fileRef}
            type="file"
            accept={
              allowXlsx
                ? '.json,.csv,.txt,.xlsx,.xls,application/json,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
                : '.json,.csv,.txt,application/json,text/csv,text/plain'
            }
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            disabled={busy}
            data-testid="borehole-import-input"
          />
          <label
            htmlFor="bh-allow-xlsx"
            className="hint"
            style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginTop: '0.35rem' }}
          >
            <input
              id="bh-allow-xlsx"
              type="checkbox"
              checked={allowXlsx}
              onChange={(e) => setAllowXlsx(e.target.checked)}
              data-testid="borehole-allow-xlsx"
            />
            <span>
              Permitir arquivo .xlsx (opcional). Prefira JSON/CSV. Limite 2 MiB.
            </span>
          </label>
        </div>
      </div>

      {importError && <div className="error-box">{importError}</div>}
      {busy && <p className="hint">Processando…</p>}

      {preview && (
        <div className="scope-banner" role="status" style={{ marginBottom: '1rem' }}>
          <strong>
            Preview import ({preview.sourceFormat}) — {preview.layers.length} camada(s)
            {preview.ok ? '' : ' — com erros'}
          </strong>
          {preview.errors.map((e) => (
            <div key={e} className="error-box" style={{ marginTop: '0.35rem' }}>
              {e}
            </div>
          ))}
          {preview.warnings.map((w) => (
            <div key={w} style={{ marginTop: '0.25rem' }}>
              Aviso: {w}
            </div>
          ))}
          {preview.ok && preview.layers.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th className="left">Prof. (m)</th>
                    <th>NSPT</th>
                    <th>Solo id</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.layers.slice(0, 12).map((l) => (
                    <tr key={`${l.depth_m}-${l.nspt}`}>
                      <td className="left">{l.depth_m}</td>
                      <td>{l.nspt}</td>
                      <td>{l.soilTypeId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.layers.length > 12 && (
                <p className="hint">… e mais {preview.layers.length - 12} camadas</p>
              )}
            </div>
          )}
          <div className="actions" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!preview.ok}
              onClick={confirmImport}
            >
              Confirmar importação
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPreview(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className="left">Prof. (m)</th>
              <th>NSPT</th>
              <th className="left">Tipo para métodos</th>
              <th className="left">Descrição (boletim)</th>
              <th title="Rl = 0 neste metro (DEC-47)">Sem atrito</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.layers.map((row, idx) => {
              const suggestion = suggestSoilFromDescription(row.description)
              const descKey = (row.description ?? '').trim()
              const showSuggest =
                suggestion != null &&
                suggestion.soilTypeId !== row.soilTypeId &&
                dismissedSuggest[idx] !== descKey
              return (
                <Fragment key={row.depth_m + '-' + idx}>
                  <tr>
                    <td className="left">
                      <input
                        type="number"
                        style={{ width: 72 }}
                        step={0.01}
                        min={0.01}
                        value={row.depth_m}
                        onChange={(e) => updateLayer(idx, { depth_m: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 64 }}
                        value={row.nspt}
                        onChange={(e) => updateLayer(idx, { nspt: Number(e.target.value) })}
                      />
                    </td>
                    <td className="left">
                      <select
                        value={row.soilTypeId}
                        onChange={(e) => updateLayer(idx, { soilTypeId: Number(e.target.value) })}
                        aria-label={`Tipo para métodos · camada ${idx + 1}`}
                      >
                        {SOIL_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="left">
                      <input
                        type="text"
                        style={{ width: 140 }}
                        placeholder="ex.: Argila arenosa"
                        value={row.description ?? ''}
                        onChange={(e) => updateLayer(idx, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.excludeFromShaftFriction === true}
                        title="Não considerar no atrito lateral"
                        onChange={(e) =>
                          updateLayer(idx, {
                            excludeFromShaftFriction: e.target.checked,
                            excludeReason: e.target.checked
                              ? row.excludeReason || 'Camada marcada pelo usuário'
                              : undefined,
                          })
                        }
                      />
                    </td>
                    <td>
                      <button type="button" className="btn" onClick={() => removeLayer(idx)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                  {showSuggest && suggestion && (
                    <tr data-testid={`soil-suggest-${idx}`}>
                      <td colSpan={6} className="left">
                        <div
                          className="scope-banner"
                          role="status"
                          style={{ margin: '0.25rem 0', padding: '0.5rem 0.75rem' }}
                        >
                          <strong>Classificação sugerida:</strong> {suggestion.soilName}
                          <span className="hint">
                            {' '}
                            (pela descrição — {suggestion.disclaimer})
                          </span>
                          <div className="actions" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() =>
                                updateLayer(idx, { soilTypeId: suggestion.soilTypeId })
                              }
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() =>
                                setDismissedSuggest((prev) => ({ ...prev, [idx]: descKey }))
                              }
                            >
                              Manter atual / alterar no seletor
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        * «Sem atrito» zera Rl nesse metro (Aoki / Décourt / Teixeira). Não calcula atrito
        negativo (down-drag). Tipo para métodos = catálogo de coeficientes, não granulometria
        automática.
      </p>

      <div className="actions" style={{ marginBottom: '1.25rem' }}>
        <button type="button" className="btn" onClick={addLayer}>
          Adicionar camada
        </button>
        <button type="button" className="btn" onClick={exportJson}>
          Exportar JSON
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void exportXlsx()}>
          Exportar .xlsx
        </button>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '1.25rem 0' }} />
      <GroundwaterFields />

      <FlowNavButtons />
    </section>
  )
}
