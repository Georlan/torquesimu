export const ARM_B_CM = 12
export const STANDARD_GRAVITY = 9.80665

export interface SimulationParams {
  massBGrams: number
  massCGrams: number
  distanceCCm: number
  inertia: number
  damping: number
  gravity: number
}

export interface AngularState {
  theta: number
  omega: number
}

export interface DynamicsSnapshot {
  weightB: number
  weightC: number
  tauB: number
  tauC: number
  tauDamping: number
  tauGravity: number
  tauNet: number
  alpha: number
  kineticEnergy: number
  potentialEnergy: number
  totalEnergy: number
}

const cmToM = (value: number) => value / 100
const gramsToKg = (value: number) => value / 1000

export function calculateDynamics(
  state: AngularState,
  params: SimulationParams,
): DynamicsSnapshot {
  const leftArm = cmToM(ARM_B_CM)
  const rightArm = cmToM(params.distanceCCm)
  const weightB = gramsToKg(params.massBGrams) * params.gravity
  const weightC = gramsToKg(params.massCGrams) * params.gravity

  // theta = 0 representa o braço horizontal.
  // r x F => o lado B gera torque positivo e o lado C negativo.
  const leverProjection = Math.cos(state.theta)
  const tauB = weightB * leftArm * leverProjection
  const tauC = -weightC * rightArm * leverProjection
  const tauDamping = -params.damping * state.omega
  const tauGravity = tauB + tauC
  const tauNet = tauGravity + tauDamping
  const alpha = tauNet / Math.max(params.inertia, 1e-8)

  const kineticEnergy = 0.5 * params.inertia * state.omega ** 2
  const potentialEnergy =
    (weightC * rightArm - weightB * leftArm) * Math.sin(state.theta)
  const totalEnergy = kineticEnergy + potentialEnergy

  return {
    weightB,
    weightC,
    tauB,
    tauC,
    tauDamping,
    tauGravity,
    tauNet,
    alpha,
    kineticEnergy,
    potentialEnergy,
    totalEnergy,
  }
}

function derivative(
  state: AngularState,
  params: SimulationParams,
): AngularState {
  return {
    theta: state.omega,
    omega: calculateDynamics(state, params).alpha,
  }
}

function addScaled(
  state: AngularState,
  delta: AngularState,
  scale: number,
): AngularState {
  return {
    theta: state.theta + delta.theta * scale,
    omega: state.omega + delta.omega * scale,
  }
}

export function rk4Step(
  state: AngularState,
  params: SimulationParams,
  dt: number,
): AngularState {
  const k1 = derivative(state, params)
  const k2 = derivative(addScaled(state, k1, dt / 2), params)
  const k3 = derivative(addScaled(state, k2, dt / 2), params)
  const k4 = derivative(addScaled(state, k3, dt), params)

  let theta =
    state.theta +
    (dt / 6) * (k1.theta + 2 * k2.theta + 2 * k3.theta + k4.theta)
  const omega =
    state.omega +
    (dt / 6) * (k1.omega + 2 * k2.omega + 2 * k3.omega + k4.omega)

  // Mantém o ângulo numericamente compacto sem alterar a física.
  theta = ((theta + Math.PI) % (2 * Math.PI)) - Math.PI

  return { theta, omega }
}

export function staticTorqueAtHorizontal(params: SimulationParams): number {
  const state: AngularState = { theta: 0, omega: 0 }
  return calculateDynamics(state, params).tauNet
}

export function balanceDistanceCm(params: SimulationParams): number | null {
  if (params.massCGrams <= 0) return null
  return (params.massBGrams * ARM_B_CM) / params.massCGrams
}
