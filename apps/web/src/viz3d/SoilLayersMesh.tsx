import { soilColorHex, type SoilSlice } from './coords'

export interface SoilLayersMeshProps {
  slices: SoilSlice[]
  halfExtent_m: number
  theme: 'light' | 'dark'
  /**
   * Corte do maciço para ver a fundação (só elementos).
   * `half` = metade do volume no eixo +Z removida.
   */
  cutaway?: 'none' | 'half'
}

/**
 * Camadas de solo (métricos, −Y = profundidade).
 * Por padrão usa cutaway para não ocultar estaca/bloco.
 */
export function SoilLayersMesh({
  slices,
  halfExtent_m,
  theme,
  cutaway = 'half',
}: SoilLayersMeshProps) {
  const full = halfExtent_m * 2
  const sizeX = full
  const sizeZ = cutaway === 'half' ? halfExtent_m : full
  const zCenter = cutaway === 'half' ? -halfExtent_m / 2 : 0

  return (
    <group>
      {slices.map((s) => {
        const thickness = Math.max(0.05, s.bottom_m - s.top_m)
        const midY = -((s.top_m + s.bottom_m) / 2)
        return (
          <mesh
            key={`${s.bottom_m}-${s.soilTypeId}-${s.top_m}`}
            position={[0, midY, zCenter]}
            receiveShadow
          >
            <boxGeometry args={[sizeX, thickness, sizeZ]} />
            <meshStandardMaterial
              color={soilColorHex(s.soilTypeId, theme)}
              roughness={0.95}
              metalness={0}
              transparent
              opacity={0.48}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}
