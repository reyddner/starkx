import { waterColorHex } from './coords'

export interface WaterPlaneProps {
  waterLevel_m: number
  halfExtent_m: number
}

/** Plano horizontal do nível d'água (y = −NA). */
export function WaterPlane({ waterLevel_m, halfExtent_m }: WaterPlaneProps) {
  const size = halfExtent_m * 2 * 1.05
  return (
    <mesh position={[0, -waterLevel_m, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color={waterColorHex()}
        transparent
        opacity={0.35}
        roughness={0.2}
        metalness={0.05}
        depthWrite={false}
      />
    </mesh>
  )
}
