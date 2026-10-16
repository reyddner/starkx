import type { RaftDesignResult } from '@raft/index'

export interface RaftPlan2DProps {
  raft: RaftDesignResult
  width?: number
  height?: number
}

/** Planta do radier (métrica). */
export function RaftPlan2D({ raft, width = 420, height = 360 }: RaftPlan2DProps) {
  const pad = 40
  const spanX = Math.max(raft.B_m, 0.5)
  const spanY = Math.max(raft.L_m, 0.5)
  const plotW = width - pad * 2
  const plotH = height - pad * 2
  const scale = Math.min(plotW / spanX, plotH / spanY) * 0.85
  const cx = width / 2
  const cy = height / 2
  const bw = raft.B_m * scale
  const lh = raft.L_m * scale

  return (
    <div className="viz2d">
      <div className="viz2d-header">
        <strong>Planta do radier</strong>
        <span>
          {raft.B_m.toFixed(2)} × {raft.L_m.toFixed(2)} m · t {raft.thickness_m.toFixed(2)} m
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Planta do radier">
        <rect
          x={cx - bw / 2}
          y={cy - lh / 2}
          width={bw}
          height={lh}
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth={2}
        />
        <line
          x1={cx - bw / 2}
          y1={cy}
          x2={cx + bw / 2}
          y2={cy}
          stroke="var(--border)"
          strokeDasharray="4 3"
        />
        <line
          x1={cx}
          y1={cy - lh / 2}
          x2={cx}
          y2={cy + lh / 2}
          stroke="var(--border)"
          strokeDasharray="4 3"
        />
        <text x={cx} y={cy - lh / 2 - 8} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
          B = {raft.B_m.toFixed(2)} m
        </text>
      </svg>
    </div>
  )
}
