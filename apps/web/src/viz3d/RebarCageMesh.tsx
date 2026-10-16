import { DoubleSide } from 'three'
import {
  longitudinalBarPositions,
  longBarCircleRadius_m,
  transverseRingDepths_m,
  visualBarRadius_m,
  type RebarCageParams,
} from './rebarGeometry'

export interface RebarCageMeshProps {
  pileDiameter_m: number
  cover_mm: number
  longCount: number
  longDia_mm: number
  transDia_mm: number
  transSpacing_m: number
  cageLength_m: number
  kind: 'stirrup' | 'spiral'
  theme: 'light' | 'dark'
}

/**
 * Gaiola esquemática 3D (só leitura do detalhe estrutural).
 * Não é detalhamento CAD — barras com raio visual exagerado.
 */
export function RebarCageMesh(props: RebarCageMeshProps) {
  const params: RebarCageParams = {
    pileDiameter_m: props.pileDiameter_m,
    cover_mm: props.cover_mm,
    longCount: props.longCount,
    longDia_mm: props.longDia_mm,
    transDia_mm: props.transDia_mm,
    transSpacing_m: props.transSpacing_m,
    cageLength_m: props.cageLength_m,
  }
  const L = Math.max(0.1, params.cageLength_m)
  const bars = longitudinalBarPositions(params)
  const depths = transverseRingDepths_m(params)
  const longR = visualBarRadius_m(params.longDia_mm, params.pileDiameter_m)
  const transR = visualBarRadius_m(params.transDia_mm, params.pileDiameter_m) * 0.75
  const ringR = longBarCircleRadius_m(params)
  const steel = props.theme === 'dark' ? '#d4d4d8' : '#52525b'
  const hoop = props.theme === 'dark' ? '#a1a1aa' : '#71717a'

  return (
    <group>
      {bars.map((b, i) => (
        <mesh key={`L${i}`} position={[b.x, -L / 2, b.z]} castShadow>
          <cylinderGeometry args={[longR, longR, L, 10]} />
          <meshStandardMaterial color={steel} roughness={0.35} metalness={0.55} />
        </mesh>
      ))}
      {depths.map((y, i) => (
        <mesh
          key={`T${i}`}
          position={[0, y, 0]}
          rotation={[Math.PI / 2, 0, props.kind === 'spiral' ? (i * 0.35) % (Math.PI / 2) : 0]}
        >
          <torusGeometry args={[ringR, transR, 8, 28]} />
          <meshStandardMaterial
            color={hoop}
            roughness={0.4}
            metalness={0.45}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
