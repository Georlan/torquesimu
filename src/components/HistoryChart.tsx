export interface HistoryPoint {
  time: number
  thetaDeg: number
  torque: number
}

interface HistoryChartProps {
  history: HistoryPoint[]
}

function makePath(values: number[], width: number, height: number, min: number, max: number) {
  if (values.length < 2) return ''
  const span = Math.max(max - min, 1e-9)
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / span) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function range(values: number[], includeZero = false): [number, number] {
  if (!values.length) return [-1, 1]
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (includeZero) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  if (Math.abs(max - min) < 1e-6) {
    const pad = Math.max(Math.abs(max) * 0.15, 1)
    min -= pad
    max += pad
  } else {
    const pad = (max - min) * 0.12
    min -= pad
    max += pad
  }
  return [min, max]
}

function MiniPlot({
  title,
  unit,
  values,
  className,
}: {
  title: string
  unit: string
  values: number[]
  className: string
}) {
  const width = 640
  const height = 140
  const [min, max] = range(values, true)
  const path = makePath(values, width, height, min, max)
  const zeroY = height - ((0 - min) / (max - min)) * height
  const latest = values.at(-1) ?? 0

  return (
    <div className="mini-plot">
      <div className="mini-plot__head">
        <div>
          <span className={`plot-dot ${className}`} />
          <strong>{title}</strong>
        </div>
        <span>{latest.toFixed(3)} {unit}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label={`Gráfico de ${title}`}>
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} className="plot-zero" />
        <path d={path} className={`plot-line ${className}`} />
      </svg>
      <div className="mini-plot__scale">
        <span>{min.toFixed(2)}</span>
        <span>{max.toFixed(2)} {unit}</span>
      </div>
    </div>
  )
}

export default function HistoryChart({ history }: HistoryChartProps) {
  const theta = history.map((point) => point.thetaDeg)
  const torque = history.map((point) => point.torque)

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TELEMETRIA</span>
          <h2>Resposta no tempo</h2>
        </div>
        <span className="muted">janela de {history.length ? (history.at(-1)!.time - history[0].time).toFixed(1) : '0.0'} s</span>
      </div>
      <div className="plot-grid">
        <MiniPlot title="Ângulo θ" unit="°" values={theta} className="plot-angle" />
        <MiniPlot title="Torque resultante" unit="N·m" values={torque} className="plot-torque" />
      </div>
    </section>
  )
}
