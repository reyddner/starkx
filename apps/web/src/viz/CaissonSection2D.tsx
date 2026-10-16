import type { CaissonDesignResult } from '@caisson/index'

export interface CaissonSection2DProps {
  caisson: CaissonDesignResult
  width?: number
  height?: number
}

/** Corte esquemático do tubulão (métrico). */
export function CaissonSection2D({ caisson, width = 280, height = 360 }: CaissonSection2DProps) {
  const pad = 36
  const maxD = Math.max(caisson.baseDiameter_m, caisson.shaftDiameter_m, 0.5)
  const L = Math.max(caisson.length_m, 0.5)
  const plotW = width - pad * 2
  const plotH = height - pad * 2
  const scale = Math.min(plotW / maxD, plotH / L) * 0.85
  const cx = width / 2
  const top = pad
  const shaftW = caisson.shaftDiameter_m * scale
  const baseW = caisson.baseDiameter_m * scale
  const h = L * scale
  const baseH = Math.min(h * 0.12, 28)

  return (
    <div className="viz2d">
      <div className="viz2d-header">
        <strong>Tubulão</strong>
        <span>
          ∅{caisson.shaftDiameter_m.toFixed(2)} m · L {caisson.length_m.toFixed(1)} m · Padm{' '}
          {caisson.Padm_kN.toFixed(0)} kN
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Corte do tubulão">
        <rect
          x={cx - shaftW / 2}
          y={top}
          width={shaftW}
          height={h - baseH}
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth={2}
        />
        <rect
          x={cx - baseW / 2}
          y={top + h - baseH}
          width={baseW}
          height={baseH}
          fill="var(--accent)"
          opacity={0.55}
          stroke="var(--accent)"
          strokeWidth={2}
        />
        <text x={cx} y={top - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
          Ds = {caisson.shaftDiameter_m.toFixed(2)} m
        </text>
      </svg>
    </div>
  )
}
