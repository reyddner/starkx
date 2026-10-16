import type { FootingDesignResult } from '@footing/index'

export interface FootingPlan2DProps {
  footing: FootingDesignResult
  width?: number
  height?: number
}

/** Planta da sapata (métrica). */
export function FootingPlan2D({ footing, width = 420, height = 360 }: FootingPlan2DProps) {
  const pad = 40
  const spanX = Math.max(footing.B_m, 0.5)
  const spanY = Math.max(footing.L_m, 0.5)
  const plotW = width - pad * 2
  const plotH = height - pad * 2
  const scale = Math.min(plotW / spanX, plotH / spanY) * 0.85
  const cx = width / 2
  const cy = height / 2
  const bw = footing.B_m * scale
  const lh = footing.L_m * scale

  return (
    <div className="viz2d">
      <div className="viz2d-header">
        <strong>Planta da sapata</strong>
        <span>
          {footing.B_m.toFixed(2)} × {footing.L_m.toFixed(2)} m · t {footing.thickness_m.toFixed(2)} m
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Planta da sapata">
        <rect
          x={cx - bw / 2}
          y={cy - lh / 2}
          width={bw}
          height={lh}
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth={2}
        />
        <circle cx={cx} cy={cy} r={4} fill="var(--danger)" />
        <text x={cx} y={cy - lh / 2 - 8} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
          B = {footing.B_m.toFixed(2)} m
        </text>
        <text
          x={cx + bw / 2 + 8}
          y={cy}
          fontSize={12}
          fill="var(--text-muted)"
          transform={`rotate(90 ${cx + bw / 2 + 8} ${cy})`}
        >
          L = {footing.L_m.toFixed(2)} m
        </text>
      </svg>
    </div>
  )
}
