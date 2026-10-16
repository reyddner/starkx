import { useProjectStore } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'
import { BlockPlan2D } from '../../viz/BlockPlan2D'
import { DesignChecksList } from '../DesignChecksList'
import { ColumnReviewTable } from '../ColumnReviewTable'

export function StepBlock() {
  const s = useProjectStore()
  const preview = s.blockResult
  const padm = s.result?.atTip.governingPadm_kN
  const N = s.columnLoad.N_kN ?? s.designLoad_kN
  const nPiles = s.blockRows * s.blockCols
  const label = s.columnLoad.columnLabel?.trim() || 'B1'

  const situation =
    preview == null
      ? null
      : preview.capacityOk === false
        ? 'NÃO APROVADO'
        : preview.capacityOk === true
          ? 'APROVADO'
          : 'INDICATIVO (informe η)'

  return (
    <section className="panel">
      <h2>Bloco sobre estacas</h2>
      <p className="lead">
        Grade retangular + proposta do bloco (AABB + beiral). Capacidade do grupo = n × Padm × η —
        sem η informada, o Padm_g é apenas <strong>indicativo</strong> (DEC-17).
      </p>

      {s.columns.length > 1 && (
        <div className="scope-banner" data-testid="block-column-review" style={{ marginBottom: '1rem' }}>
          <strong>Pilares do projeto</strong>
          <p className="hint" style={{ margin: '0.35rem 0 0' }}>
            Ative outro pilar para revisar o arranjo/bloco dele (DEC-55).
          </p>
          <ColumnReviewTable
            columns={s.columns}
            activeColumnId={s.activeColumnId}
            probes={s.foundationSuggestion?.probes}
            showCaps
            onSelect={(id) => s.setActiveColumn(id)}
            testId="block-columns-table"
          />
          {s.result != null && (
            <div style={{ marginTop: '0.65rem' }}>
              <button
                type="button"
                className="btn"
                data-testid="dimension-all-columns-block"
                onClick={() => s.runAllColumnCaps()}
              >
                Dimensionar blocos de todos
              </button>
            </div>
          )}
        </div>
      )}

      <div className="scope-banner" role="status">
        Sem η informada, a soma simples (η=1) <strong>não constitui veredito de projeto</strong>. Você
        pode informar η manualmente ou aplicar a sugestão de Converse-Labarre (DEC-21) — responsabilidade do
        projetista.
      </div>

      {(preview || padm != null) && (
        <div
          className="scope-banner"
          data-testid="block-reasoning"
          role="region"
          aria-label="Resumo do dimensionamento do bloco"
          style={{ marginTop: '0.75rem' }}
        >
          <strong>BLOCO {label}</strong>
          {s.columns.length > 1 && (
            <p className="hint" style={{ margin: '0.35rem 0 0' }} data-testid="block-multi-column-note">
              Dimensionamento do pilar ativo. Outros pilares cadastrados:{' '}
              {s.columns
                .filter((c) => c.id !== s.activeColumnId)
                .map((c) => c.columnLabel)
                .join(', ')}{' '}
              — selecione em Cargas para recalcular o arranjo com as cargas deles.
            </p>
          )}
          <ul className="hint" style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
            <li>
              Quantidade de estacas: {preview?.pileCount ?? nPiles} ({s.blockRows}×{s.blockCols})
            </li>
            {padm != null && (
              <li>
                Capacidade admissível por estaca (Padm):{' '}
                {padm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kN
              </li>
            )}
            {N != null && (
              <li>
                Carga solicitante (N): {N.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kN
              </li>
            )}
            {preview?.groupPadm_kN != null && (
              <li>
                Capacidade total do grupo (Padm_g):{' '}
                {preview.groupPadm_kN.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kN
                {preview.groupCapacityIndicative ? ' · indicativa' : ''}
                {preview.efficiency != null ? ` · η = ${preview.efficiency}` : ' · η não informada'}
              </li>
            )}
            {preview && (
              <li>
                Dimensão: {preview.cap.width_m.toFixed(2)} × {preview.cap.length_m.toFixed(2)} ×{' '}
                {preview.cap.thickness_m.toFixed(2)} m (L × B × H)
              </li>
            )}
            {s.groupResult && (
              <li>
                Fator implícito Nmáx/Padm:{' '}
                {padm != null && padm > 0
                  ? (s.groupResult.maxPileLoad_kN / padm).toFixed(2)
                  : '—'}{' '}
                (Nmáx = {s.groupResult.maxPileLoad_kN.toFixed(1)} kN)
              </li>
            )}
            {situation && (
              <li>
                Situação: <strong>{situation}</strong>
              </li>
            )}
          </ul>
        </div>
      )}
      <div className="grid-3">
        <div className="field">
          <label>Arranjo (do Grupo)</label>
          <input
            readOnly
            value={`${s.blockRows} × ${s.blockCols} (${s.blockRows * s.blockCols} estacas)`}
            title="Altere linhas/colunas na etapa Grupo / arranjo"
          />
          <span className="hint">Edite linhas/colunas/espaçamento na etapa anterior (Grupo).</span>
        </div>
        <div className="field">
          <label htmlFor="bs">Espaçamento s (m) — vazio = auto</label>
          <input
            id="bs"
            type="number"
            step="0.05"
            placeholder="auto"
            value={s.blockSpacing_m ?? ''}
            onChange={(e) =>
              s.patch({
                blockSpacing_m: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="be">Beiral (m)</label>
          <input
            id="be"
            type="number"
            step="0.05"
            value={s.blockEdge_m}
            onChange={(e) => s.patch({ blockEdge_m: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="bt">Espessura t (m)</label>
          <input
            id="bt"
            type="number"
            step="0.05"
            value={s.blockThickness_m}
            onChange={(e) => s.patch({ blockThickness_m: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="bemb">Embutimento da estaca no bloco (m)</label>
          <input
            id="bemb"
            type="number"
            step="0.01"
            min={0.05}
            max={Math.max(0.05, s.blockThickness_m)}
            data-testid="block-embedment"
            value={s.blockEmbedment_m}
            onChange={(e) => s.patch({ blockEmbedment_m: Number(e.target.value) })}
          />
          <span className="hint">
            Padrão 0,10 m. Topo do bloco = cota 0; topo da estaca = −(t − e) (DEC-57). Ex.: t=1,00 e
            e=0,10 → topo em −0,90 m.
          </span>
        </div>
        <div className="field">
          <label htmlFor="beta">η eficiência de grupo — vazio = indicativo</label>
          <input
            id="beta"
            type="number"
            step="0.05"
            min={0.01}
            max={1}
            placeholder="informar η"
            value={s.blockEfficiency ?? ''}
            onChange={(e) =>
              s.patch({
                blockEfficiency: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
          <span className="hint">
            {s.blockEfficiencyHint != null
              ? `Sugestão Converse-Labarre ≈ ${s.blockEfficiencyHint.toFixed(3)}`
              : 'Ex.: 0,7–1,0 conforme critério do projetista.'}
          </span>
          <button
            type="button"
            className="btn"
            style={{ marginTop: '0.35rem' }}
            onClick={() => s.applyConverseLabarreEfficiency()}
          >
            Usar η Converse-Labarre
          </button>
        </div>
      </div>

      {preview && (
        <>
          <div className="kpi-row" style={{ marginTop: '1rem' }}>
            <div className="kpi">
              <div className="label">Estacas</div>
              <div className="value">{preview.pileCount}</div>
            </div>
            <div className="kpi">
              <div className="label">s adotado</div>
              <div className="value">
                {preview.spacing_m.toFixed(2)}
                <span className="unit">m</span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">Bloco</div>
              <div className="value" style={{ fontSize: '1rem' }}>
                {preview.cap.width_m.toFixed(2)}×{preview.cap.length_m.toFixed(2)} m
              </div>
            </div>
            {preview.groupPadm_kN != null && (
              <div className="kpi">
                <div className="label">
                  Padm_g {preview.groupCapacityIndicative ? '(indicativo)' : ''}
                </div>
                <div className="value" style={{ fontSize: '1rem' }}>
                  {preview.groupPadm_kN.toFixed(1)}
                  <span className="unit">kN</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <BlockPlan2D block={preview} diameter_m={s.diameterCm / 100} />
          </div>
          <DesignChecksList checks={preview.checks} />
          {preview.rebar && (
            <p className="hint" style={{ marginTop: '0.75rem' }} data-testid="block-rebar-hint">
              {preview.rebar.message}
            </p>
          )}
          {preview.strutTie && (
            <p className="hint" style={{ marginTop: '0.5rem' }} data-testid="block-strut-tie-hint">
              {preview.strutTie.message}
            </p>
          )}
        </>
      )}

      {s.calcError && <div className="error-box">{s.calcError}</div>}

      <FlowNavButtons
        primaryLabel="Continuar · Desenhos"
        onPrimary={() => {
          s.runBlockDesign()
        }}
      />
    </section>
  )
}
