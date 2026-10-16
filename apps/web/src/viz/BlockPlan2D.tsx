import type { BlockDesignResult } from '@block/index'

export interface BlockPlan2DProps {
  block: BlockDesignResult
  diameter_m: number
  width?: number
  height?: number
}

/** Planta 2D do bloco + estacas (métrica, sem cálculo). */
export function BlockPlan2D({ block, diameter_m, width = 420, height = 420 }: BlockPlan2DProps) {
  const pad = 48
  const { cap, piles } = block
  const spanX = Math.max(cap.width_m, 0.5)
  const spanY = Math.max(cap.length_m, 0.5)
  const plotW = width - pad * 2
  const plotH = height - pad * 2 - 12
  const scale = Math.min(plotW / spanX, plotH / spanY) * 0.88
  const cx = width / 2
  const cy = height / 2 - 6
  const toX = (x: number) => cx + x * scale
  const toY = (y: number) => cy - y * scale
  const rPx = Math.max(3, (diameter_m / 2) * scale)

  const left = toX(cap.minX_m)
  const top = toY(cap.maxY_m)
  const right = toX(cap.maxX_m)
  const bottom = toY(cap.minY_m)

  return (
    <div className="viz2d">
      <div className="viz2d-header">
        <strong>Planta do bloco</strong>
        <span>
          {block.pileCount} estacas · {cap.width_m.toFixed(2)}×{cap.length_m.toFixed(2)}×
          {cap.thickness_m.toFixed(2)} m · s={block.spacing_m.toFixed(2)} m
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`Planta do bloco com ${block.pileCount} estacas`}
      >
        <rect
          x={left}
          y={top}
          width={cap.width_m * scale}
          height={cap.length_m * scale}
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth={2}
          opacity={0.85}
        />
        {piles.map((p) => (
          <g key={p.id}>
            <circle
              cx={toX(p.position.x_m)}
              cy={toY(p.position.y_m)}
              r={rPx}
              fill="var(--viz-pile)"
              stroke="var(--viz-pile-stroke)"
            />
            <text
              x={toX(p.position.x_m)}
              y={toY(p.position.y_m) - rPx - 4}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {p.label}
            </text>
          </g>
        ))}

        {/* Cotas L × B */}
        <line x1={left} y1={bottom + 14} x2={right} y2={bottom + 14} stroke="var(--text-muted)" />
        <text
          x={(left + right) / 2}
          y={bottom + 26}
          textAnchor="middle"
          fontSize={10}
          fill="var(--text-muted)"
        >
          {cap.width_m.toFixed(2)} m
        </text>
        <line x1={right + 14} y1={top} x2={right + 14} y2={bottom} stroke="var(--text-muted)" />
        <text
          x={right + 18}
          y={(top + bottom) / 2}
          fontSize={10}
          fill="var(--text-muted)"
          transform={`rotate(90 ${right + 18} ${(top + bottom) / 2})`}
        >
          {cap.length_m.toFixed(2)} m
        </text>

        <line
          x1={pad}
          y1={height - 16}
          x2={pad + scale}
          y2={height - 16}
          stroke="var(--text)"
          strokeWidth={2}
        />
        <text x={pad} y={height - 4} fontSize={11} fill="var(--text-muted)">
          1 m
        </text>
        <text x={width - pad} y={height - 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
          Ø = {(diameter_m * 100).toFixed(0)} cm (escala)
        </text>
      </svg>
    </div>
  )
}
