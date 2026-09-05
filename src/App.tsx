import { useEffect, useMemo, useRef, useState } from 'react'
import TorqueScene from './components/TorqueScene'
import HistoryChart, { type HistoryPoint } from './components/HistoryChart'
import {
  ARM_B_CM,
  STANDARD_GRAVITY,
  balanceDistanceCm,
  calculateDynamics,
  rk4Step,
  staticTorqueAtHorizontal,
  type AngularState,
  type DynamicsSnapshot,
  type SimulationParams,
} from './sim/physics'

const DEG = Math.PI / 180
const FIXED_DT = 1 / 240
const INITIAL_ANGLE = 8

const DEFAULT_PARAMS: SimulationParams = {
  massBGrams: 850,
  massCGrams: 1100,
  distanceCCm: 8,
  inertia: 0.025,
  damping: 0.028,
  gravity: STANDARD_GRAVITY,
}

interface LiveSnapshot {
  state: AngularState
  dynamics: DynamicsSnapshot
  time: number
}

function formatSigned(value: number, digits = 4) {
  if (Math.abs(value) < 0.5 * 10 ** -digits) return (0).toFixed(digits)
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`
}

function ParamInput({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="param-field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
          }}
        />
        <em>{unit}</em>
      </div>
    </label>
  )
}

function Metric({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'b' | 'c' | 'good' | 'warn' }) {
  return (
    <div className={`metric ${tone ? `metric--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {unit && <small>{unit}</small>}
    </div>
  )
}

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [initialAngleDeg, setInitialAngleDeg] = useState(INITIAL_ANGLE)
  const [speed, setSpeed] = useState(1)
  const [running, setRunning] = useState(false)

  const initialState = useMemo<AngularState>(() => ({ theta: INITIAL_ANGLE * DEG, omega: 0 }), [])
  const stateRef = useRef<AngularState>(initialState)
  const paramsRef = useRef(params)
  const speedRef = useRef(speed)
  const simTimeRef = useRef(0)
  const lastHistoryTimeRef = useRef(0)

  const [snapshot, setSnapshot] = useState<LiveSnapshot>(() => ({
    state: initialState,
    dynamics: calculateDynamics(initialState, DEFAULT_PARAMS),
    time: 0,
  }))
  const [history, setHistory] = useState<HistoryPoint[]>([
    {
      time: 0,
      thetaDeg: INITIAL_ANGLE,
      torque: calculateDynamics(initialState, DEFAULT_PARAMS).tauNet,
    },
  ])

  useEffect(() => {
    paramsRef.current = params
    const dynamics = calculateDynamics(stateRef.current, params)
    setSnapshot((current) => ({ ...current, dynamics }))
  }, [params])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    if (!running) return

    let frameId = 0
    let lastFrame = performance.now()
    let accumulator = 0

    const frame = (now: number) => {
      const realDt = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now
      accumulator += realDt * speedRef.current

      while (accumulator >= FIXED_DT) {
        stateRef.current = rk4Step(stateRef.current, paramsRef.current, FIXED_DT)
        simTimeRef.current += FIXED_DT
        accumulator -= FIXED_DT
      }

      const state = { ...stateRef.current }
      const dynamics = calculateDynamics(state, paramsRef.current)
      const time = simTimeRef.current
      setSnapshot({ state, dynamics, time })

      if (time - lastHistoryTimeRef.current >= 0.05) {
        lastHistoryTimeRef.current = time
        setHistory((current) => [
          ...current,
          { time, thetaDeg: state.theta / DEG, torque: dynamics.tauNet },
        ].slice(-260))
      }

      frameId = requestAnimationFrame(frame)
    }

    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [running])

  const setParam = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    setParams((current) => ({ ...current, [key]: value }))
  }

  const reset = () => {
    setRunning(false)
    const state: AngularState = { theta: initialAngleDeg * DEG, omega: 0 }
    stateRef.current = state
    simTimeRef.current = 0
    lastHistoryTimeRef.current = 0
    const dynamics = calculateDynamics(state, paramsRef.current)
    setSnapshot({ state, dynamics, time: 0 })
    setHistory([{ time: 0, thetaDeg: initialAngleDeg, torque: dynamics.tauNet }])
  }

  const advance = () => {
    setRunning(false)
    const steps = Math.round(0.05 / FIXED_DT)
    for (let i = 0; i < steps; i += 1) {
      stateRef.current = rk4Step(stateRef.current, paramsRef.current, FIXED_DT)
      simTimeRef.current += FIXED_DT
    }
    const state = { ...stateRef.current }
    const dynamics = calculateDynamics(state, paramsRef.current)
    setSnapshot({ state, dynamics, time: simTimeRef.current })
    setHistory((current) => [...current, {
      time: simTimeRef.current,
      thetaDeg: state.theta / DEG,
      torque: dynamics.tauNet,
    }].slice(-260))
  }

  const autoBalance = () => {
    const target = balanceDistanceCm(params)
    if (target === null) return
    const clamped = Math.min(80, Math.max(0.5, target))
    setParam('distanceCCm', Number(clamped.toFixed(3)))
  }

  const horizontalTorque = staticTorqueAtHorizontal(params)
  const balanceTarget = balanceDistanceCm(params)
  const isBalanced = Math.abs(horizontalTorque) < 0.002
  const angleDeg = snapshot.state.theta / DEG
  const direction = Math.abs(snapshot.dynamics.tauNet) < 0.001
    ? 'sem aceleração relevante'
    : snapshot.dynamics.tauNet > 0
      ? 'anti-horário ↺'
      : 'horário ↻'

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <div className="brand-row">
            <span className="brand-mark">τ</span>
            <span className="eyebrow">TORQUESIMU / DINÂMICA ROTACIONAL</span>
          </div>
          <h1>Veja o torque acontecer.</h1>
          <p>
            Modelo 3D da estrutura da imagem: <b>P<sub>B</sub></b> atua a 12 cm de O,
            <b> P<sub>C</sub></b> atua a uma distância D e a reação <b>N</b> passa pelo pivô.
          </p>
        </div>
        <div className={`balance-pill ${isBalanced ? 'balance-pill--ok' : ''}`}>
          <span>{isBalanced ? 'EQUILIBRADO' : 'DESEQUILIBRADO'}</span>
          <strong>{formatSigned(horizontalTorque, 4)} N·m</strong>
          <small>torque estático em θ = 0°</small>
        </div>
      </header>

      <section className="workspace">
        <div className="visual-column">
          <section className="scene-panel panel">
            <div className="section-heading section-heading--overlay">
              <div>
                <span className="eyebrow">VISUALIZAÇÃO 3D</span>
                <h2>Pivô O e braços de alavanca</h2>
              </div>
              <div className={`run-indicator ${running ? 'run-indicator--active' : ''}`}>
                <i /> {running ? 'simulando' : 'pausado'}
              </div>
            </div>
            <TorqueScene state={snapshot.state} dynamics={snapshot.dynamics} params={params} />
          </section>

          <div className="metrics-grid">
            <Metric label="Ângulo θ" value={angleDeg.toFixed(2)} unit="graus" />
            <Metric label="Velocidade ω" value={snapshot.state.omega.toFixed(3)} unit="rad/s" />
            <Metric label="Aceleração α" value={snapshot.dynamics.alpha.toFixed(3)} unit="rad/s²" />
            <Metric
              label="Torque Στ"
              value={formatSigned(snapshot.dynamics.tauNet, 4)}
              unit="N·m"
              tone={isBalanced ? 'good' : 'warn'}
            />
          </div>
        </div>

        <aside className="controls panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CONTROLE DO MODELO</span>
              <h2>Parâmetros físicos</h2>
            </div>
            <span className="time-chip">t = {snapshot.time.toFixed(2)} s</span>
          </div>

          <div className="param-grid">
            <ParamInput label="Massa em B" unit="g" value={params.massBGrams} min={0} max={5000} step={10} onChange={(v) => setParam('massBGrams', v)} />
            <ParamInput label="Massa em C" unit="g" value={params.massCGrams} min={0} max={5000} step={10} onChange={(v) => setParam('massCGrams', v)} />
            <ParamInput label="Distância D" unit="cm" value={params.distanceCCm} min={0.5} max={80} step={0.1} onChange={(v) => setParam('distanceCCm', v)} />
            <ParamInput label="Momento de inércia I" unit="kg·m²" value={params.inertia} min={0.0001} max={2} step={0.001} onChange={(v) => setParam('inertia', v)} />
            <ParamInput label="Amortecimento c" unit="N·m·s/rad" value={params.damping} min={0} max={2} step={0.001} onChange={(v) => setParam('damping', v)} />
            <ParamInput label="Ângulo inicial" unit="°" value={initialAngleDeg} min={-170} max={170} step={1} onChange={setInitialAngleDeg} />
          </div>

          <div className="speed-control">
            <div>
              <span>Velocidade da simulação</span>
              <strong>{speed.toFixed(1)}×</strong>
            </div>
            <input type="range" min="0.1" max="3" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </div>

          <div className="button-row">
            <button className="button button--primary" onClick={() => setRunning((value) => !value)}>
              {running ? '⏸ Pausar' : '▶ Iniciar'}
            </button>
            <button className="button" onClick={advance}>+ 0,05 s</button>
            <button className="button" onClick={reset}>↺ Resetar</button>
          </div>
          <button className="button button--balance" onClick={autoBalance} disabled={balanceTarget === null}>
            ⚖ Ajustar D para equilíbrio
            {balanceTarget !== null && <small>D ideal ≈ {balanceTarget.toFixed(2)} cm</small>}
          </button>

          <div className="direction-card">
            <span>Tendência instantânea</span>
            <strong>{direction}</strong>
            <small>O sinal de Στ define o sentido da aceleração angular.</small>
          </div>
        </aside>
      </section>

      <section className="explain-grid">
        <article className="panel equation-card equation-card--b">
          <span className="eyebrow">LADO B</span>
          <h3>Torque de P<sub>B</sub></h3>
          <div className="equation">τ<sub>B</sub> = P<sub>B</sub> · 0,12 · cos θ</div>
          <p>{snapshot.dynamics.weightB.toFixed(2)} N × 0,12 m × cos({angleDeg.toFixed(1)}°)</p>
          <strong>{formatSigned(snapshot.dynamics.tauB, 4)} N·m</strong>
        </article>

        <article className="panel equation-card equation-card--c">
          <span className="eyebrow">LADO C</span>
          <h3>Torque de P<sub>C</sub></h3>
          <div className="equation">τ<sub>C</sub> = −P<sub>C</sub> · D · cos θ</div>
          <p>{snapshot.dynamics.weightC.toFixed(2)} N × {(params.distanceCCm / 100).toFixed(3)} m × cos({angleDeg.toFixed(1)}°)</p>
          <strong>{formatSigned(snapshot.dynamics.tauC, 4)} N·m</strong>
        </article>

        <article className="panel equation-card equation-card--sum">
          <span className="eyebrow">DINÂMICA</span>
          <h3>Segunda lei da rotação</h3>
          <div className="equation">I α = Στ</div>
          <p>Στ = τ<sub>B</sub> + τ<sub>C</sub> − cω</p>
          <strong>α = {snapshot.dynamics.alpha.toFixed(3)} rad/s²</strong>
        </article>

        <article className="panel equation-card equation-card--n">
          <span className="eyebrow">PIVÔ O</span>
          <h3>Por que N não entra?</h3>
          <div className="equation">τ<sub>N</sub> = 0</div>
          <p>A linha de ação de N passa por O. Seu braço de alavanca em relação ao pivô é zero.</p>
          <strong>N sustenta, mas não gira.</strong>
        </article>
      </section>

      <HistoryChart history={history} />

      <section className="panel assumptions">
        <div>
          <span className="eyebrow">HIPÓTESES DO MODELO</span>
          <h2>O que está sendo simulado</h2>
        </div>
        <p>
          O braço é tratado como corpo rígido girando em um <b>plano vertical</b> em torno de O.
          Os pesos permanecem verticais, o amortecimento é viscoso e o momento de inércia I é um parâmetro concentrado.
          Isso torna a física visível e auditável. Para reproduzir uma montagem real, basta substituir I, atritos,
          geometria e eixo de rotação pelos valores medidos.
        </p>
      </section>

      <footer>
        TorqueSimu · RK4 a 240 Hz · React + TypeScript + Three.js
      </footer>
    </main>
  )
}
