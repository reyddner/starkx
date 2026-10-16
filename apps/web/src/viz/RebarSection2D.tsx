/** Seção transversal 2D da gaiola — paramétrica a partir do detalhe estrutural. */

export interface RebarSection2DProps {
  diameter_m: number
  barCount: number
  barDia_mm: number
  cover_mm: number
  stirrupDia_mm: number
}

export function RebarSection2D({
  diameter_m,
  barCount,
  barDia_mm,
  cover_mm,
  stirrupDia_mm,
}: RebarSection2DProps) {
  const size = 280
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.38
  const coverRatio = cover_mm / 1000 / diameter_m
  const rBars = R * (1 - 2 * Math.min(0.35, Math.max(0.08, coverRatio)))
  const barR = Math.max(3, (barDia_mm / (diameter_m * 1000)) * R * 1.8)

  const bars = Array.from({ length: barCount }, (_, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / barCount
    return { x: cx + rBars * Math.cos(ang), y: cy + rBars * Math.sin(ang) }
  })

  return (
    <div className="viz2d">
      <div className="viz2d-header">
        <strong>Seção da gaiola</strong>
        <span>
          {barCount} φ {barDia_mm} · c={cover_mm} mm
        </span>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img" aria-label="Seção transversal da armadura">
        <circle cx={cx} cy={cy} r={R} fill="var(--viz-ground)" stroke="var(--border)" strokeWidth={2} />
        <circle
          cx={cx}
          cy={cy}
          r={rBars}
          fill="none"
          stroke="var(--viz-water)"
          strokeWidth={Math.max(1.5, stirrupDia_mm / 4)}
          strokeDasharray="4 2"
        />
        {bars.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={barR} fill="var(--viz-pile-stroke)" />
        ))}
        <text x={cx} y={size - 12} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
          Ø {(diameter_m * 100).toFixed(0)} cm
        </text>
      </svg>
    </div>
  )
}
