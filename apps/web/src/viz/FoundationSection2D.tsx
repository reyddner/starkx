import { SOIL_TYPES } from '@engine/catalogs'
import type { LayerRow } from '../store/projectStore'
import { soilFillCssVar } from './soilVisual'

export interface SectionCap2D {
  width_m: number
  length_m: number
  thickness_m: number
}

export interface SectionPile2D {
  /** Posição no eixo do corte (m). */
  x_m: number
  label?: string
}

export interface FoundationSection2DProps {
  diameterCm: number
  /** Comprimento L a partir do topo da estaca (m). */
  tipDepth_m: number
  waterLevel_m: number | null
  layers: LayerRow[]
  pileLabel?: string
  /** Bloco no corte (topo na superfície y=0; espessura t). */
  cap?: SectionCap2D | null
  /** Estacas no plano do corte; se omitido, uma estaca no eixo. */
  piles?: SectionPile2D[] | null
  /** Y do topo da estaca (profundidade positiva abaixo da superfície). Default 0. */
  pileTopDepth_m?: number
  width?: number
  height?: number
}

/**
 * Corte 2D paramétrico: camadas, NA, estaca(s), bloco, escala e NSPT.
 * Fonte: props do modelo — sem fórmulas de capacidade.
 */
export function FoundationSection2D({
  diameterCm,
  tipDepth_m,
  waterLevel_m,
  layers,
  pileLabel = 'Estaca',
  cap = null,
  piles = null,
  pileTopDepth_m = 0,
  width = 420,
  height = 520,
}: FoundationSection2DProps) {
  const pad = { t: 36, r: 28, b: 36, l: 52 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b

  const maxLayer = layers.reduce((m, l) => Math.max(m, l.depth_m), 0)
  const tipAbs = pileTopDepth_m + tipDepth_m
  const maxDepth = Math.max(tipAbs, maxLayer, 1) + 0.5
  const maxNspt = Math.max(10, ...layers.map((l) => l.nspt), 1)

  const yAt = (depth: number) => pad.t + (depth / maxDepth) * plotH
  const groundY = yAt(0)

  const diamM = Math.max(0.05, diameterCm / 100)
  // Escala visual do Ø (não 1:1 com profundidade) — documentado na legenda.
  const pileHalfPx = Math.min(plotW * 0.12, Math.max(8, diamM * 48))
  const sectionCx = pad.l + plotW * 0.38
  const tipY = yAt(tipAbs)
  const pileTop = yAt(pileTopDepth_m)
  const pileH = Math.max(4, tipY - pileTop)

  const pileList: SectionPile2D[] =
    piles && piles.length > 0 ? piles : [{ x_m: 0, label: pileLabel }]

  const planSpan = Math.max(
    ...pileList.map((p) => Math.abs(p.x_m)),
    cap ? cap.width_m / 2 : 0,
    0.5,
  )
  const xScale = Math.min((plotW * 0.28) / planSpan, pileHalfPx * 4)
  const toX = (x_m: number) => sectionCx + x_m * xScale

  const sorted = [...layers].sort((a, b) => a.depth_m - b.depth_m)
  const sptX = (n: number) => pad.l + plotW * 0.72 + (n / maxNspt) * (plotW * 0.26)

  const ticks: number[] = []
  for (let d = 0; d <= Math.floor(maxDepth); d++) ticks.push(d)

  const capT = cap && cap.thickness_m > 0 ? cap.thickness_m : 0
  const capBottomY = capT > 0 ? yAt(capT) : groundY
  const capWpx = cap
    ? Math.max(pileHalfPx * 2.5, Math.min(plotW * 0.55, cap.width_m * xScale))
    : 0

  return (
    <div className="viz2d">
      <div className="viz2d-header">
        <strong>Seção 2D</strong>
        <span>
          Ø {diameterCm} cm · L {tipDepth_m} m · ponta @ {tipAbs.toFixed(2)} m
          {cap ? ` · bloco t=${cap.thickness_m.toFixed(2)} m` : ''}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`Corte: ${pileList.length} estaca(s), diâmetro ${diameterCm} cm, L ${tipDepth_m} m, ponta a ${tipAbs} m`}
      >
        <defs>
          <pattern
            id="hatch-water"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="var(--viz-water)"
              strokeWidth="1.5"
              opacity="0.45"
            />
          </pattern>
        </defs>

        <rect
          x={pad.l}
          y={groundY}
          width={plotW * 0.62}
          height={plotH}
          fill="var(--viz-ground)"
          stroke="var(--border)"
        />

        {sorted.map((layer, i) => {
          const top = i === 0 ? 0 : sorted[i - 1]!.depth_m
          const bot = layer.depth_m
          const y1 = yAt(top)
          const y2 = yAt(bot)
          const name =
            SOIL_TYPES.find((s) => s.id === layer.soilTypeId)?.name ?? `Solo ${layer.soilTypeId}`
          return (
            <g key={`${layer.depth_m}-${i}`}>
              <rect
                x={pad.l}
                y={y1}
                width={plotW * 0.62}
                height={Math.max(1, y2 - y1)}
                fill={soilFillCssVar(layer.soilTypeId)}
                stroke="var(--border)"
                strokeWidth={0.75}
                opacity={0.72}
              />
              <text x={pad.l + 6} y={(y1 + y2) / 2 + 4} fontSize={10} fill="var(--text-muted)">
                {name.length > 18 ? `${name.slice(0, 16)}…` : name}
              </text>
            </g>
          )
        })}

        {waterLevel_m != null && waterLevel_m >= 0 && waterLevel_m <= maxDepth && (
          <g>
            <line
              x1={pad.l}
              x2={pad.l + plotW * 0.62}
              y1={yAt(waterLevel_m)}
              y2={yAt(waterLevel_m)}
              stroke="var(--viz-water)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            <text
              x={pad.l + plotW * 0.62 - 4}
              y={yAt(waterLevel_m) - 6}
              textAnchor="end"
              fontSize={11}
              fontWeight={700}
              fill="var(--viz-water)"
            >
              NA {waterLevel_m} m
            </text>
          </g>
        )}
        {waterLevel_m != null && waterLevel_m > maxDepth && (
          <text x={pad.l + 6} y={height - 12} fontSize={10} fill="var(--viz-water)">
            NA {waterLevel_m} m (fora do corte)
          </text>
        )}

        <line
          x1={pad.l}
          x2={pad.l + plotW * 0.62}
          y1={groundY}
          y2={groundY}
          stroke="var(--text)"
          strokeWidth={2}
        />
        <text x={pad.l} y={groundY - 10} fontSize={11} fill="var(--text-muted)">
          Superfície / terreno
        </text>

        {/* Bloco: do terreno até t (estacas penetram o bloco) */}
        {cap && capT > 0 && (
          <g>
            <rect
              x={sectionCx - capWpx / 2}
              y={groundY}
              width={capWpx}
              height={Math.max(4, capBottomY - groundY)}
              fill="var(--accent-soft)"
              stroke="var(--accent)"
              strokeWidth={1.5}
              opacity={0.55}
            />
            <text
              x={sectionCx}
              y={groundY + Math.min(14, (capBottomY - groundY) / 2 + 4)}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="var(--accent)"
            >
              Bloco t={cap.thickness_m.toFixed(2)} m
            </text>
          </g>
        )}

        {pileList.map((p, i) => {
          const cx = toX(p.x_m)
          const label = p.label ?? (pileList.length === 1 ? pileLabel : `E${i + 1}`)
          return (
            <g key={`pile-${i}-${p.x_m}`}>
              <rect
                x={cx - pileHalfPx}
                y={pileTop}
                width={pileHalfPx * 2}
                height={pileH}
                rx={2}
                fill="var(--viz-pile)"
                stroke="var(--viz-pile-stroke)"
                strokeWidth={1.5}
                opacity={0.95}
              />
              <polygon
                points={`${cx - pileHalfPx},${tipY} ${cx + pileHalfPx},${tipY} ${cx},${tipY + Math.min(14, pileHalfPx * 0.8)}`}
                fill="var(--viz-pile)"
                stroke="var(--viz-pile-stroke)"
                strokeWidth={1.5}
              />
              <text
                x={cx}
                y={pileTop + Math.min(pileH / 2, 36)}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="var(--text-on-pile)"
              >
                {label}
              </text>
            </g>
          )
        })}

        <text x={sectionCx} y={tipY + 26} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
          ponta @ {tipAbs.toFixed(2)} m
        </text>

        {/* Cota de comprimento */}
        <g>
          <line
            x1={pad.l + plotW * 0.62 - 14}
            x2={pad.l + plotW * 0.62 - 14}
            y1={pileTop}
            y2={tipY}
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <text
            x={pad.l + plotW * 0.62 - 18}
            y={(pileTop + tipY) / 2}
            textAnchor="end"
            fontSize={9}
            fill="var(--text-muted)"
            transform={`rotate(-90 ${pad.l + plotW * 0.62 - 18} ${(pileTop + tipY) / 2})`}
          >
            L = {tipDepth_m} m
          </text>
        </g>

        {ticks.map((d) => (
          <g key={`tick-${d}`}>
            <line
              x1={pad.l - 6}
              x2={pad.l}
              y1={yAt(d)}
              y2={yAt(d)}
              stroke="var(--text-muted)"
            />
            <text x={pad.l - 10} y={yAt(d) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {d}
            </text>
          </g>
        ))}
        <text
          x={16}
          y={pad.t + plotH / 2}
          fontSize={11}
          fill="var(--text-muted)"
          transform={`rotate(-90 16 ${pad.t + plotH / 2})`}
        >
          Profundidade (m)
        </text>

        <text x={pad.l + plotW * 0.72} y={pad.t - 12} fontSize={11} fill="var(--text-muted)">
          N-SPT
        </text>
        {sorted.map((layer, i) => {
          // Centro da camada (entre fundo anterior e depth_m).
          const top_m = i === 0 ? 0 : sorted[i - 1]!.depth_m
          const mid_m = (top_m + layer.depth_m) / 2
          const y = yAt(mid_m)
          const x = sptX(layer.nspt)
          const prev = i === 0 ? null : sorted[i - 1]!
          const prevMid =
            prev == null
              ? mid_m
              : ((i === 1 ? 0 : sorted[i - 2]!.depth_m) + prev.depth_m) / 2
          const prevY = prev ? yAt(prevMid) : y
          const prevX = prev ? sptX(prev.nspt) : x
          return (
            <g key={`spt-${layer.depth_m}`}>
              {prev && (
                <line
                  x1={prevX}
                  y1={prevY}
                  x2={x}
                  y2={y}
                  stroke="var(--chart-2)"
                  strokeWidth={1.5}
                />
              )}
              <circle cx={x} cy={y} r={3.5} fill="var(--chart-2)" />
              <text x={x + 6} y={y + 3} fontSize={9} fill="var(--text-muted)">
                {layer.nspt}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="viz2d-legend">
        <span>
          <i className="swatch sand" /> Areia
        </span>
        <span>
          <i className="swatch silt" /> Silte
        </span>
        <span>
          <i className="swatch clay" /> Argila
        </span>
        <span>
          <i className="swatch pile" /> Estaca
        </span>
        {cap && <span className="hint">Bloco translúcido</span>}
        <span className="hint">Ø exagerado p/ leitura · profundidade em escala</span>
      </div>
    </div>
  )
}
