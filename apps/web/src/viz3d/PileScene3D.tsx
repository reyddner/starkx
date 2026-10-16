import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { LayerRow } from '../store/projectStore'
import { layersToSlices } from './coords'
import { SoilLayersMesh } from './SoilLayersMesh'
import { PileMesh } from './PileMesh'
import { WaterPlane } from './WaterPlane'
import { RebarCageMesh } from './RebarCageMesh'

export interface GroupPilePose {
  x_m: number
  y_m: number
  label?: string
}

export interface CapBox3D {
  minX_m: number
  maxX_m: number
  minY_m: number
  maxY_m: number
  thickness_m: number
}

/** Detalhe estrutural já calculado (store) — viz só projeta. */
export interface RebarCage3DInput {
  longCount: number
  longDia_mm: number
  cover_mm: number
  transDia_mm: number
  transSpacing_m: number
  cageLength_m: number
  kind: 'stirrup' | 'spiral'
  detailText?: string
}

export interface PileScene3DProps {
  diameterCm: number
  tipDepth_m: number
  waterLevel_m: number | null
  layers: LayerRow[]
  pileLabel: string
  enlargedBaseVolumeLiters: number | null
  theme: 'light' | 'dark'
  groupPiles?: GroupPilePose[] | null
  cap?: CapBox3D | null
  /** Embutimento da estaca no bloco (m). Default 0,10. */
  embedInCap_m?: number
  /** Y do topo da estaca (DEC-57). */
  pileTop_z?: number
  rebar?: RebarCage3DInput | null
}

function CapMesh({ cap, theme }: { cap: CapBox3D; theme: 'light' | 'dark' }) {
  const w = cap.maxX_m - cap.minX_m
  const d = cap.maxY_m - cap.minY_m
  const t = Math.max(0.05, cap.thickness_m)
  const cx = (cap.minX_m + cap.maxX_m) / 2
  const cz = (cap.minY_m + cap.maxY_m) / 2
  return (
    <mesh position={[cx, -t / 2, cz]} castShadow receiveShadow>
      <boxGeometry args={[w, t, d]} />
      <meshStandardMaterial
        color={theme === 'dark' ? '#8b939e' : '#b8c0cc'}
        roughness={0.65}
        metalness={0.05}
        transparent
        opacity={0.42}
        depthWrite={false}
      />
    </mesh>
  )
}

function GroundDisk({ radius, theme }: { radius: number; theme: 'light' | 'dark' }) {
  return (
    <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[radius, 48]} />
      <meshStandardMaterial
        color={theme === 'dark' ? '#1a1917' : '#e6dcc8'}
        roughness={1}
        metalness={0}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </mesh>
  )
}

function SceneContent({
  diameterCm,
  tipDepth_m,
  waterLevel_m,
  layers,
  enlargedBaseVolumeLiters,
  theme,
  groupPiles,
  cap,
  embedInCap_m = 0.1,
  pileTop_z = 0,
  rebar,
  showRebar,
}: Omit<PileScene3DProps, 'pileLabel'> & { showRebar: boolean }) {
  const slices = layersToSlices(layers)
  const maxLayer = layers.reduce((m, l) => Math.max(m, l.depth_m), 0)
  const tipAbs = Math.abs(pileTop_z) + tipDepth_m
  const maxDepth = Math.max(tipAbs, maxLayer, 1)
  const planSpan = cap
    ? Math.max(cap.maxX_m - cap.minX_m, cap.maxY_m - cap.minY_m, 2)
    : groupPiles && groupPiles.length > 0
      ? Math.max(...groupPiles.map((p) => Math.hypot(p.x_m, p.y_m) * 2 + 2), 2)
      : 0
  const halfExtent = Math.max(2.5, maxDepth * 0.55, planSpan * 0.55)
  const diameter_m = Math.max(0.05, diameterCm / 100)

  const showWater =
    waterLevel_m != null && waterLevel_m >= 0 && waterLevel_m <= maxDepth + 0.5

  const camY = -maxDepth * 0.35
  const camDist = Math.max(6, maxDepth * 1.4 + halfExtent)
  const poses = groupPiles && groupPiles.length > 0 ? groupPiles : [{ x_m: 0, y_m: 0 }]
  const reveal = showRebar && rebar != null

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
      <SoilLayersMesh slices={slices} halfExtent_m={halfExtent} theme={theme} cutaway="half" />
      {poses.map((p, i) => (
        <group key={i} position={[p.x_m, 0, p.y_m]}>
          <PileMesh
            diameter_m={diameter_m}
            tipDepth_m={tipDepth_m}
            enlargedBaseVolumeLiters={enlargedBaseVolumeLiters}
            theme={theme}
            pileTop_z={pileTop_z}
            embedInCap_m={cap ? Math.min(Math.max(0.05, embedInCap_m), cap.thickness_m) : 0}
            revealRebar={reveal}
          />
          {reveal && rebar && (
            <RebarCageMesh
              pileDiameter_m={diameter_m}
              cover_mm={rebar.cover_mm}
              longCount={rebar.longCount}
              longDia_mm={rebar.longDia_mm}
              transDia_mm={rebar.transDia_mm}
              transSpacing_m={rebar.transSpacing_m}
              cageLength_m={Math.min(rebar.cageLength_m, tipDepth_m)}
              kind={rebar.kind}
              theme={theme}
            />
          )}
        </group>
      ))}
      {cap && <CapMesh cap={cap} theme={theme} />}
      {showWater && waterLevel_m != null && (
        <WaterPlane waterLevel_m={waterLevel_m} halfExtent_m={halfExtent} />
      )}

      <OrbitControls
        makeDefault
        target={[0, camY, 0]}
        maxPolarAngle={Math.PI * 0.95}
        minDistance={1.5}
        maxDistance={camDist * 3}
      />
    </>
  )
}

/** Viewer 3D: solo (corte) + estaca(s) + NA + bloco + gaiola opcional. Sem grade/gizmo. */
export function PileScene3D(props: PileScene3DProps) {
  const [showRebar, setShowRebar] = useState(true)
  const maxLayer = props.layers.reduce((m, l) => Math.max(m, l.depth_m), 0)
  const pileTop_z = props.pileTop_z ?? 0
  const tipAbs = Math.abs(pileTop_z) + props.tipDepth_m
  const maxDepth = Math.max(tipAbs, maxLayer, 1)
  const planSpan = props.cap
    ? Math.max(props.cap.maxX_m - props.cap.minX_m, props.cap.maxY_m - props.cap.minY_m, 2)
    : 0
  const halfExtent = Math.max(2.5, maxDepth * 0.55, planSpan * 0.55)
  const camDist = Math.max(6, maxDepth * 1.4 + halfExtent)
  const camY = -maxDepth * 0.35
  const n = props.groupPiles?.length ?? 1
  const hasRebar = props.rebar != null

  return (
    <div className="viz3d" data-testid="viz3d-pile">
      <div className="viz2d-header">
        <strong>Vista 3D</strong>
        <span>
          {props.pileLabel}
          {n > 1 ? ` ×${n}` : ''} · Ø {props.diameterCm} cm · L {props.tipDepth_m} m · ponta @{' '}
          {tipAbs.toFixed(2)} m
        </span>
      </div>
      {hasRebar && (
        <label
          className="hint"
          style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.35rem 0' }}
        >
          <input
            type="checkbox"
            checked={showRebar}
            onChange={(e) => setShowRebar(e.target.checked)}
            data-testid="viz3d-toggle-rebar"
          />
          Mostrar armadura (esquemática)
          {props.rebar?.detailText ? ` · ${props.rebar.detailText}` : ''}
        </label>
      )}
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
          <SceneContent {...props} showRebar={showRebar} />
        </Canvas>
      </div>
      <div className="viz2d-legend">
        <span>
          <i className="swatch sand" /> Areia
        </span>
        <span>
          <i className="swatch silt" /> Silte
        </span>
        <span>
          <i className="swatch clay" /> Argila
        </span>
        <span>
          <i className="swatch pile" /> Estaca
        </span>
        {hasRebar && showRebar && <span className="hint">Gaiola · barras exageradas p/ leitura</span>}
        {props.cap ? (
          <span className="hint">Bloco translúcido · estacas penetram t</span>
        ) : (
          <span className="hint">Só estacas · solo em corte</span>
        )}
        <span className="hint">Orbitar com o mouse</span>
      </div>
      {props.waterLevel_m != null && props.waterLevel_m > maxDepth + 0.5 && (
        <p className="hint" style={{ margin: '0.5rem 0 0' }}>
          NA em {props.waterLevel_m} m fora do volume exibido (oculto).
        </p>
      )}
    </div>
  )
}
