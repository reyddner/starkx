import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface CapacityChartPoint {
  depth: number
  nspt: number
  aoki: number | null
  decourt: number | null
  teixeira: number | null
  media: number | null
}

const tooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
} as const

type Xy = { x: number; y: number }

function toSeries(
  data: CapacityChartPoint[],
  key: keyof CapacityChartPoint,
): Xy[] {
  return data
    .map((d) => {
      const x = d[key]
      if (typeof x !== 'number' || !Number.isFinite(x)) return null
      return { x, y: d.depth }
    })
    .filter((p): p is Xy => p != null)
}

/**
 * Perfil geotécnico: Y = profundidade (para baixo), X = NSPT ou Padm.
 * ScatterChart evita o bug do LineChart com eixos numéricos cruzados.
 */
export function CapacityCharts({ chartData }: { chartData: CapacityChartPoint[] }) {
  const data = useMemo(
    () => [...chartData].sort((a, b) => a.depth - b.depth),
    [chartData],
  )

  const maxDepth = useMemo(
    () => Math.max(1, ...data.map((d) => d.depth)),
    [data],
  )
  const maxNspt = useMemo(
    () => Math.max(10, ...data.map((d) => (Number.isFinite(d.nspt) ? d.nspt : 0))),
    [data],
  )
  const nsptSeries = useMemo(() => toSeries(data, 'nspt'), [data])
  const aokiSeries = useMemo(() => toSeries(data, 'aoki'), [data])
  const decourtSeries = useMemo(() => toSeries(data, 'decourt'), [data])
  const teixeiraSeries = useMemo(() => toSeries(data, 'teixeira'), [data])
  const mediaSeries = useMemo(() => toSeries(data, 'media'), [data])

  const maxPadm = useMemo(() => {
    let m = 50
    for (const s of [aokiSeries, decourtSeries, teixeiraSeries, mediaSeries]) {
      for (const p of s) if (p.x > m) m = p.x
    }
    return Math.ceil(m / 50) * 50
  }, [aokiSeries, decourtSeries, teixeiraSeries, mediaSeries])

  if (data.length === 0) {
    return (
      <section className="panel">
        <h2>N-SPT e carga admissível × profundidade</h2>
        <p className="hint">Sem perfil calculado para plotar.</p>
      </section>
    )
  }

  return (
    <section className="panel" data-testid="capacity-charts">
      <h2>N-SPT × profundidade</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Horizontal = NSPT · vertical = profundidade (m, para baixo).
      </p>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <ScatterChart margin={{ top: 12, right: 28, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              name="NSPT"
              domain={[0, maxNspt]}
              stroke="var(--text-muted)"
              tick={{ fontSize: 11 }}
              tickCount={6}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Prof."
              unit=" m"
              reversed
              domain={[0, maxDepth]}
              stroke="var(--text-muted)"
              tick={{ fontSize: 11 }}
              width={48}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value, name) => {
                if (name === 'x' || name === 'NSPT') return [value, 'NSPT']
                if (name === 'y' || name === 'Prof.') return [`${value} m`, 'Prof.']
                return [value, String(name)]
              }}
              labelFormatter={() => ''}
              contentStyle={tooltipStyle}
            />
            <Legend verticalAlign="top" height={28} />
            <Scatter
              name="NSPT"
              data={nsptSeries}
              fill="var(--chart-2)"
              line={{ stroke: 'var(--chart-2)', strokeWidth: 2 }}
              lineJointType="monotone"
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <h2 style={{ marginTop: '1.25rem' }}>Carga admissível (Padm) × profundidade</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Horizontal = Padm (kN) · vertical = profundidade (m, para baixo).
      </p>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <ScatterChart margin={{ top: 12, right: 28, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Padm"
              domain={[0, maxPadm]}
              stroke="var(--text-muted)"
              tick={{ fontSize: 11 }}
              tickCount={6}
              tickFormatter={(v) => (typeof v === 'number' ? String(Math.round(v)) : String(v))}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Prof."
              unit=" m"
              reversed
              domain={[0, maxDepth]}
              stroke="var(--text-muted)"
              tick={{ fontSize: 11 }}
              width={48}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value, name) => {
                if (name === 'x' || name === 'Padm') {
                  return [typeof value === 'number' ? `${value.toFixed(0)} kN` : value, 'Padm']
                }
                if (name === 'y' || name === 'Prof.') return [`${value} m`, 'Prof.']
                return [value, String(name)]
              }}
              labelFormatter={() => ''}
              contentStyle={tooltipStyle}
            />
            <Legend verticalAlign="top" height={28} />
            <Scatter
              name="Aoki"
              data={aokiSeries}
              fill="var(--chart-1)"
              line={{ stroke: 'var(--chart-1)', strokeWidth: 2 }}
              lineJointType="monotone"
              isAnimationActive={false}
            />
            <Scatter
              name="Décourt"
              data={decourtSeries}
              fill="var(--chart-2)"
              line={{ stroke: 'var(--chart-2)', strokeWidth: 2 }}
              lineJointType="monotone"
              isAnimationActive={false}
            />
            <Scatter
              name="Teixeira"
              data={teixeiraSeries}
              fill="var(--chart-3)"
              line={{ stroke: 'var(--chart-3)', strokeWidth: 2 }}
              lineJointType="monotone"
              isAnimationActive={false}
            />
            <Scatter
              name="Média"
              data={mediaSeries}
              fill="var(--text)"
              line={{ stroke: 'var(--text)', strokeWidth: 2, strokeDasharray: '5 4' }}
              lineJointType="monotone"
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
