import { PILE_TYPES } from '@engine/catalogs'
import {
  allDiametersForPileType,
  hasNominalReference,
  pileTypesInCategory,
  type PileCategoryId,
} from '@engine/pile-catalog'
import { resolvePileDatum } from '@domain/pileDatum'
import { useProjectStore } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'

const CATEGORIES: { id: PileCategoryId; label: string }[] = [
  { id: 'moldada_in_loco', label: 'Moldada in loco' },
  { id: 'pre_moldada', label: 'Pré-moldada' },
  { id: 'metalica', label: 'Metálica' },
]

/**
 * Geometria da estaca. Quando `embedded`, é renderizada dentro da etapa
 * "Fundação e geometria" (DEC-58) e não desenha navegação própria.
 */
export function StepPile({ embedded = false }: { embedded?: boolean } = {}) {
  const s = useProjectStore()
  const category = s.pileCategory ?? 'moldada_in_loco'
  const types = pileTypesInCategory(category)
  const pile = PILE_TYPES.find((p) => p.id === s.pileTypeId)
  const diameters = allDiametersForPileType(s.pileTypeId)
  const isCap = s.foundationKind === 'pile_cap'
  const datum = resolvePileDatum({
    foundationKind: s.foundationKind,
    tipDepth_m: s.tipDepth_m,
    blockThickness_m: s.blockThickness_m,
    blockEmbedment_m: s.blockEmbedment_m,
    pileTopElevation_m: s.pileTopElevation_m,
  })

  const Wrapper = embedded ? 'div' : 'section'

  return (
    <Wrapper className={embedded ? undefined : 'panel'} data-testid="step-pile">
      <h3 style={{ marginBottom: '0.25rem' }}>Geometria da estaca</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Categoria → tipo → seção. Comprimento L medido a partir do topo da estaca (DEC-57).
      </p>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="kpi"
            style={{
              cursor: 'pointer',
              outline: category === c.id ? '2px solid var(--accent)' : undefined,
              textAlign: 'left',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'inherit',
            }}
            onClick={() => {
              const first = pileTypesInCategory(c.id)[0]
              s.patch({
                pileCategory: c.id,
                ...(first ? { pileTypeId: first.id } : {}),
              })
            }}
            data-testid={`pile-category-${c.id}`}
          >
            <div className="value" style={{ fontSize: '1rem' }}>
              {c.label}
            </div>
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="ptype">Tipo específico</label>
          <select
            id="ptype"
            value={s.pileTypeId}
            onChange={(e) => s.patch({ pileTypeId: Number(e.target.value) })}
          >
            {types.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="d">Diâmetro (cm)</label>
          {diameters.length > 0 ? (
            <select
              id="d"
              value={s.diameterCm}
              onChange={(e) => s.suggestGeometryForDiameter(Number(e.target.value))}
              data-testid="pile-diameter"
            >
              {!diameters.includes(s.diameterCm) && (
                <option value={s.diameterCm}>Ø {s.diameterCm} cm (atual)</option>
              )}
              {diameters.map((d) => (
                <option key={d} value={d}>
                  Ø {d} cm{hasNominalReference(s.pileTypeId, d) ? '' : ' (sem carga nominal)'}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="d"
              type="number"
              min={1}
              max={200}
              value={s.diameterCm}
              onChange={(e) => s.suggestGeometryForDiameter(Number(e.target.value))}
            />
          )}
          <span className="hint">
            Ao trocar o Ø, o STARKX já propõe o comprimento e o arranjo coerentes.
          </span>
        </div>
        <div className="field">
          <label htmlFor="tip">Comprimento da estaca L (m)</label>
          <input
            id="tip"
            type="number"
            min={1}
            max={40}
            step={0.01}
            value={s.tipDepth_m}
            onChange={(e) => s.patch({ tipDepth_m: Number(e.target.value) })}
            data-testid="pile-length"
          />
          <span className="hint">
            A partir do topo · cota ponta no SPT ≈ {datum.sptTipDepth_m.toFixed(2)} m
            {isCap
              ? ' · ao mudar t/embutimento o L pode ser realinhado à camada SPT mais próxima'
              : ''}
          </span>
        </div>
        <div className="field">
          <label htmlFor="pile-top">
            {isCap ? 'Topo da estaca (derivado)' : 'Cota do topo (m)'}
          </label>
          {isCap ? (
            <>
              <input
                id="pile-top"
                type="number"
                value={datum.pileTop_z.toFixed(2)}
                readOnly
                disabled
                data-testid="pile-top-derived"
              />
              <span className="hint">
                −(t − embutimento) · t={datum.blockThickness_m.toFixed(2)} m · e=
                {datum.embedment_m.toFixed(2)} m (topo do bloco = 0)
              </span>
            </>
          ) : (
            <>
              <input
                id="pile-top"
                type="number"
                step={0.01}
                value={s.pileTopElevation_m ?? ''}
                onChange={(e) =>
                  s.patch({
                    pileTopElevation_m: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                data-testid="pile-top-editable"
              />
              <span className="hint">Relativo à cota 0 (superfície); tipicamente 0</span>
            </>
          )}
        </div>
      </div>

      {pile?.requiresManualArea && (
        <div className="grid-2" style={{ marginTop: '0.85rem' }}>
          <div className="field">
            <label htmlFor="area">Área (cm²)</label>
            <input id="area" value={s.areaCm2} onChange={(e) => s.patch({ areaCm2: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="per">Perímetro (cm)</label>
            <input
              id="per"
              value={s.perimeterCm}
              onChange={(e) => s.patch({ perimeterCm: e.target.value })}
            />
          </div>
        </div>
      )}

      {pile?.requiresEnlargedBase && (
        <div className="field" style={{ marginTop: '0.85rem' }}>
          <label htmlFor="vol">Volume da base Franki (litros)</label>
          <input
            id="vol"
            value={s.enlargedBaseVolumeLiters}
            onChange={(e) => s.patch({ enlargedBaseVolumeLiters: e.target.value })}
          />
        </div>
      )}

      {!embedded && <FlowNavButtons primaryLabel="Voltar à fundação" />}
    </Wrapper>
  )
}
