import { Canvas } from '@react-three/fiber'
import { ContactShadows, Html, Line, OrbitControls } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import type { AngularState, DynamicsSnapshot, SimulationParams } from '../sim/physics'
import { ARM_B_CM } from '../sim/physics'

interface TorqueSceneProps {
  state: AngularState
  dynamics: DynamicsSnapshot
  params: SimulationParams
}

const WORLD_PER_METER = 8

function Label({ position, children, tone = 'neutral' }: { position: [number, number, number]; children: React.ReactNode; tone?: 'neutral' | 'b' | 'c' | 'n' }) {
  return (
    <Html position={position} center distanceFactor={7} transform={false}>
      <div className={`scene-label scene-label--${tone}`}>{children}</div>
    </Html>
  )
}

function ForceArrow({
  position,
  direction,
  length,
  color,
  label,
}: {
  position: [number, number, number]
  direction: 1 | -1
  length: number
  color: string
  label: string
}) {
  return (
    <group position={position}>
      <mesh position={[0, (direction * length) / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, length, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, direction * length, 0]} rotation={[0, 0, direction < 0 ? Math.PI : 0]}>
        <coneGeometry args={[0.055, 0.16, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <Label position={[0.16, direction * (length + 0.12), 0]} tone={label === 'Pᴮ' ? 'b' : label === 'Pᶜ' ? 'c' : 'n'}>
        {label}
      </Label>
    </group>
  )
}

function SceneContent({ state, dynamics, params }: TorqueSceneProps) {
  const leftLength = (ARM_B_CM / 100) * WORLD_PER_METER
  const rightLength = (params.distanceCCm / 100) * WORLD_PER_METER
  const totalLength = leftLength + rightLength
  const centerX = (rightLength - leftLength) / 2

  const c = Math.cos(state.theta)
  const s = Math.sin(state.theta)
  const leftPoint: [number, number, number] = [-leftLength * c, -leftLength * s, 0]
  const rightPoint: [number, number, number] = [rightLength * c, rightLength * s, 0]

  const arcPoints = useMemo(() => {
    const count = 36
    const points: [number, number, number][] = []
    for (let i = 0; i <= count; i += 1) {
      const t = state.theta * (i / count)
      points.push([0.5 * Math.cos(t), 0.5 * Math.sin(t), 0.015])
    }
    return points
  }, [state.theta])

  const maxWeight = Math.max(dynamics.weightB, dynamics.weightC, 0.001)
  const forceScaleB = 0.55 + 0.65 * (dynamics.weightB / maxWeight)
  const forceScaleC = 0.55 + 0.65 * (dynamics.weightC / maxWeight)
  const torqueTone = Math.abs(dynamics.tauNet) < 0.002 ? '#34d399' : dynamics.tauNet > 0 ? '#22d3ee' : '#fb923c'

  return (
    <>
      <color attach="background" args={['#060a12']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 5, 6]} intensity={1.7} />
      <directionalLight position={[-4, 2, 3]} intensity={0.55} />

      <gridHelper args={[8, 24, '#1f2a3b', '#101826']} position={[0, -1.45, 0]} />

      <group>
        <mesh position={[0, -0.72, -0.1]}>
          <cylinderGeometry args={[0.34, 0.45, 1.25, 36]} />
          <meshStandardMaterial color="#182233" metalness={0.55} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.14, 32, 32]} />
          <meshStandardMaterial color="#dbeafe" metalness={0.75} roughness={0.2} />
        </mesh>
        <Label position={[0.2, 0.18, 0]}>O</Label>
      </group>

      <group rotation={[0, 0, state.theta]}>
        <mesh position={[centerX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.055, totalLength, 28]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.78} roughness={0.22} />
        </mesh>

        <mesh position={[-leftLength, 0, 0]}>
          <boxGeometry args={[0.3, 0.16, 0.34]} />
          <meshStandardMaterial color="#22d3ee" metalness={0.25} roughness={0.38} />
        </mesh>

        <group position={[rightLength, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.22, 0.22, 0.34, 32]} />
            <meshStandardMaterial color="#fb923c" metalness={0.65} roughness={0.3} />
          </mesh>
        </group>
      </group>

      <Line points={[[-leftLength, 0, -0.04], [0, 0, -0.04]]} color="#22d3ee" lineWidth={1.4} dashed dashSize={0.06} gapSize={0.04} />
      <Line points={[[0, 0, -0.04], [rightLength, 0, -0.04]]} color="#fb923c" lineWidth={1.4} dashed dashSize={0.06} gapSize={0.04} />

      <ForceArrow position={leftPoint} direction={-1} length={forceScaleB} color="#22d3ee" label="Pᴮ" />
      <ForceArrow position={rightPoint} direction={-1} length={forceScaleC} color="#fb923c" label="Pᶜ" />
      <ForceArrow position={[0, 0, 0]} direction={1} length={0.95} color="#34d399" label="N" />

      <Line points={arcPoints} color={torqueTone} lineWidth={3} />
      <Label position={[0.67, 0.25, 0]}>
        θ = {(state.theta * 180 / Math.PI).toFixed(1)}°
      </Label>
      <Label position={[-leftLength / 2, -0.22, 0]} tone="b">12 cm</Label>
      <Label position={[rightLength / 2, -0.22, 0]} tone="c">D = {params.distanceCCm.toFixed(1)} cm</Label>

      <ContactShadows position={[0, -1.43, 0]} opacity={0.38} scale={6} blur={2.2} far={4} />
      <OrbitControls makeDefault enablePan={false} minDistance={3.1} maxDistance={7.5} minPolarAngle={0.6} maxPolarAngle={2.3} />
    </>
  )
}

export default function TorqueScene(props: TorqueSceneProps) {
  return (
    <div className="scene-shell">
      <Canvas camera={{ position: [0.15, 1.2, 4.6], fov: 42 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <SceneContent {...props} />
        </Suspense>
      </Canvas>
      <div className="scene-hint">Arraste para girar a câmera · scroll para zoom</div>
    </div>
  )
}
