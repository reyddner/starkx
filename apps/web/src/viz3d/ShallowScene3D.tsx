import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { LayerRow } from '../store/projectStore'
import { layersToSlices, concreteColorHex } from './coords'
import { SoilLayersMesh } from './SoilLayersMesh'
import { WaterPlane } from './WaterPlane'

export type ShallowKind3D = 'footing' | 'caisson' | 'raft'

export interface FootingGeom3D {
  B_m: number
  L_m: number
  thickness_m: number
  embedment_m?: number
}

export interface CaissonGeom3D {
  shaftDiameter_m: number
  baseDiameter_m: number
  length_m: number
}

export interface RaftGeom3D {
  B_m: number
  L_m: number
  thickness_m: number
  embedment_m?: number
}

export interface ShallowScene3DProps {
  kind: ShallowKind3D
  theme: 'light' | 'dark'
  layers: LayerRow[]
  waterLevel_m: number | null
  label: string
  footing?: FootingGeom3D | null
  caisson?: CaissonGeom3D | null
  raft?: RaftGeom3D | null
}

function FootingMesh({
  geom,
  theme,
}: {
  geom: FootingGeom3D
  theme: 'light' | 'dark'
}) {
  const t = Math.max(0.05, geom.thickness_m)
  const Df = Math.max(0, geom.embedment_m ?? t)
  const topY = -(Df - t)
  const midY = topY - t / 2
  return (
    <mesh position={[0, midY, 0]} castShadow receiveShadow>
      <boxGeometry args={[geom.B_m, t, geom.L_m]} />
      <meshStandardMaterial color={concreteColorHex(theme)} roughness={0.75} metalness={0.05} />
    </mesh>
  )
}

function RaftMesh({ geom, theme }: { geom: RaftGeom3D; theme: 'light' | 'dark' }) {
  const t = Math.max(0.05, geom.thickness_m)
  const Df = Math.max(0, geom.embedment_m ?? t)
  const topY = -(Df - t)
  const midY = topY - t / 2
  return (
    <mesh position={[0, midY, 0]} castShadow receiveShadow>
      <boxGeometry args={[geom.B_m, t, geom.L_m]} />
      <meshStandardMaterial color={concreteColorHex(theme)} roughness={0.8} metalness={0.04} />
    </mesh>
  )
}

function CaissonMesh({
  geom,
  theme,
}: {
  geom: CaissonGeom3D
  theme: 'light' | 'dark'
}) {
  const L = Math.max(0.5, geom.length_m)
  const Ds = Math.max(0.1, geom.shaftDiameter_m)
  const Db = Math.max(Ds, geom.baseDiameter_m)
  const color = concreteColorHex(theme)
  const baseH = Math.min(0.6, L * 0.12)
  return (
    <group>
      <mesh position={[0, -L / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[Ds / 2, Ds / 2, L, 32]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} />
      </mesh>
      {Db > Ds + 1e-6 && (
        <mesh position={[0, -L + baseH / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[Db / 2, Db / 2, baseH, 32]} />
          <meshStandardMaterial color={color} roughness={0.65} metalness={0.06} />
        </mesh>
      )}
    </group>
  )
}

function GroundDisk({ radius, theme }: { radius: number; theme: 'light' | 'dark' }) {
  return (
    <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[radius, 48]} />
      <meshStandardMaterial
        color={theme === 'dark' ? '#1a1917' : '#e6dcc8'}
        roughness={1}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </mesh>
  )
}

function SceneContent(props: ShallowScene3DProps) {
  const { theme, layers, waterLevel_m, kind, footing, caisson, raft } = props
  const slices = layersToSlices(layers)
  const maxLayer = layers.reduce((m, l) => Math.max(m, l.depth_m), 0)

  let maxDepth = Math.max(maxLayer, 2)
  let planSpan = 4
  if (kind === 'footing' && footing) {
    maxDepth = Math.max(maxDepth, footing.embedment_m ?? footing.thickness_m, footing.thickness_m + 1)
    planSpan = Math.max(footing.B_m, footing.L_m, 2)
  } else if (kind === 'raft' && raft) {
    maxDepth = Math.max(maxDepth, raft.embedment_m ?? raft.thickness_m, raft.thickness_m + 1)
    planSpan = Math.max(raft.B_m, raft.L_m, 2)
  } else if (kind === 'caisson' && caisson) {
    maxDepth = Math.max(maxDepth, caisson.length_m)
    planSpan = Math.max(caisson.baseDiameter_m, caisson.shaftDiameter_m, 2) * 2
  }

  const halfExtent = Math.max(3, maxDepth * 0.55, planSpan * 0.65)
  const showWater =
    waterLevel_m != null && waterLevel_m >= 0 && waterLevel_m <= maxDepth + 0.5
  const camY = -maxDepth * 0.35
  const camDist = Math.max(8, maxDepth * 1.35 + halfExtent)

  const hasSoil = slices.length > 0
  const syntheticSoil = hasSoil
    ? slices
    : [{ top_m: 0, bottom_m: maxDepth, soilTypeId: 12, nspt: 10 }]

  return (
    <>
      <color attach="background" args={[theme === 'dark' ? '#0e0e0e' : '#f2efe8']} />
      <ambientLight intensity={theme === 'dark' ? 0.5 : 0.7} />
      <directionalLight
        castShadow
        position={[halfExtent * 1.4, maxDepth * 0.9, halfExtent * 0.8]}
        intensity={theme === 'dark' ? 0.95 : 1.2}
        shadow-mapSize={[1024, 1024]}
      />

      <GroundDisk radius={halfExtent * 1.15} theme={theme} />
      <SoilLayersMesh
        slices={syntheticSoil}
        halfExtent_m={halfExtent}
        theme={theme}
        cutaway="half"
      />

      {kind === 'footing' && footing && <FootingMesh geom={footing} theme={theme} />}
      {kind === 'raft' && raft && <RaftMesh geom={raft} theme={theme} />}
      {kind === 'caisson' && caisson && <CaissonMesh geom={caisson} theme={theme} />}

      {showWater && waterLevel_m != null && (
        <WaterPlane waterLevel_m={waterLevel_m} halfExtent_m={halfExtent} />
      )}

      <OrbitControls
        makeDefault
        target={[0, camY, 0]}
        maxPolarAngle={Math.PI * 0.95}
        minDistance={2}
        maxDistance={camDist * 3}
      />
    </>
  )
}

/** Viewer 3D rasas/tubulão — só geometria; sem grade/gizmo. */
export function ShallowScene3D(props: ShallowScene3DProps) {
  const maxLayer = props.layers.reduce((m, l) => Math.max(m, l.depth_m), 0)
  let maxDepth = Math.max(maxLayer, 2)
  let planSpan = 4
  let subtitle = props.label

  if (props.kind === 'footing' && props.footing) {
    const f = props.footing
    maxDepth = Math.max(maxDepth, f.embedment_m ?? f.thickness_m, f.thickness_m + 1)
    planSpan = Math.max(f.B_m, f.L_m, 2)
    subtitle = `Sapata ${f.B_m.toFixed(2)}×${f.L_m.toFixed(2)} m · t ${f.thickness_m.toFixed(2)} m`
  } else if (props.kind === 'raft' && props.raft) {
    const r = props.raft
    maxDepth = Math.max(maxDepth, r.embedment_m ?? r.thickness_m, r.thickness_m + 1)
    planSpan = Math.max(r.B_m, r.L_m, 2)
    subtitle = `Radier ${r.B_m.toFixed(2)}×${r.L_m.toFixed(2)} m · t ${r.thickness_m.toFixed(2)} m`
  } else if (props.kind === 'caisson' && props.caisson) {
    const c = props.caisson
    maxDepth = Math.max(maxDepth, c.length_m)
    planSpan = Math.max(c.baseDiameter_m, c.shaftDiameter_m, 2) * 2
    subtitle = `Tubulão ∅${c.shaftDiameter_m.toFixed(2)} · L ${c.length_m.toFixed(1)} m`
  }

  const halfExtent = Math.max(3, maxDepth * 0.55, planSpan * 0.65)
  const camDist = Math.max(8, maxDepth * 1.35 + halfExtent)
  const camY = -maxDepth * 0.35

  return (
    <div className="viz3d" data-testid="viz3d-shallow">
      <div className="viz2d-header">
        <strong>Vista 3D</strong>
        <span>{subtitle}</span>
      </div>
      <div className="viz3d-canvas-wrap">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{
            position: [camDist * 0.85, maxDepth * 0.25, camDist * 0.55],
            fov: 40,
            near: 0.1,
            far: camDist * 20,
          }}
          gl={{ antialias: true }}
          onCreated={({ camera }) => {
            camera.lookAt(0, camY, 0)
          }}
        >
          <SceneContent {...props} />
        </Canvas>
      </div>
      <div className="viz2d-legend">
        <span>
          <i className="swatch sand" /> Solo
        </span>
        <span>
          <i className="swatch pile" /> Concreto
        </span>
        <span className="hint">Solo em corte · orbitar com o mouse</span>
      </div>
    </div>
  )
}
