import { DoubleSide } from 'three'
import { frankiSphereRadius_m, pileColorHex } from './coords'

export interface PileMeshProps {
  diameter_m: number
  /** Comprimento L da estaca a partir do topo (m). */
  tipDepth_m: number
  enlargedBaseVolumeLiters: number | null
  theme: 'light' | 'dark'
  /**
   * Coordenada Y do topo da estaca (mundo). Cota 0 = superfície / topo do bloco.
   * pile_cap: tipicamente −(t − embutimento). Isolada: pileTopElevation (default 0).
   */
  pileTop_z?: number
  /**
   * Embutimento no bloco (m) — anel na saída do concreto.
   */
  embedInCap_m?: number
  /** Fuste translúcido para revelar gaiola (DEC-46). */
  revealRebar?: boolean
}

/**
 * Cilindro da estaca (métrico). Topo em pileTop_z; ponta em pileTop_z − L (DEC-57).
 */
export function PileMesh({
  diameter_m,
  tipDepth_m,
  enlargedBaseVolumeLiters,
  theme,
  pileTop_z = 0,
  embedInCap_m = 0,
  revealRebar = false,
}: PileMeshProps) {
  const radius = Math.max(0.05, diameter_m / 2)
  const length = Math.max(0.1, tipDepth_m)
  const color = pileColorHex(theme)
  const frankiR =
    enlargedBaseVolumeLiters != null && enlargedBaseVolumeLiters > 0
      ? frankiSphereRadius_m(enlargedBaseVolumeLiters)
      : 0
  const embed = Math.min(Math.max(0, embedInCap_m), length)
  const midY = pileTop_z - length / 2
  const tipY = pileTop_z - length

  return (
    <group>
      <mesh position={[0, midY, 0]} castShadow={!revealRebar}>
        <cylinderGeometry args={[radius, radius, length, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          metalness={0.15}
          transparent={revealRebar}
          opacity={revealRebar ? 0.22 : 1}
          depthWrite={!revealRebar}
        />
      </mesh>
      {embed > 0.04 && (
        <mesh position={[0, pileTop_z - embed, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.05, radius * 1.35, 24]} />
          <meshStandardMaterial
            color={theme === 'dark' ? '#d1d5db' : '#4b5563'}
            roughness={0.5}
            metalness={0.1}
            transparent
            opacity={0.85}
            side={DoubleSide}
          />
        </mesh>
      )}
      {frankiR > 0 && (
        <mesh position={[0, tipY, 0]} castShadow={!revealRebar}>
          <sphereGeometry args={[Math.max(frankiR, radius * 1.2), 24, 16]} />
          <meshStandardMaterial
            color={color}
            roughness={0.6}
            metalness={0.1}
            transparent={revealRebar}
            opacity={revealRebar ? 0.22 : 1}
            depthWrite={!revealRebar}
          />
        </mesh>
      )}
    </group>
  )
}
