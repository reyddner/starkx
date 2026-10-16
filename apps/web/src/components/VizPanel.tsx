import { Suspense, lazy, useState } from 'react'
import { PILE_TYPES } from '@engine/catalogs'
import { resolvePileDatum } from '@domain/pileDatum'
import { useProjectStore } from '../store/projectStore'
import { FoundationSection2D } from '../viz/FoundationSection2D'
import { BlockPlan2D } from '../viz/BlockPlan2D'
import { FootingPlan2D } from '../viz/FootingPlan2D'
import { CaissonSection2D } from '../viz/CaissonSection2D'
import { RaftPlan2D } from '../viz/RaftPlan2D'
import { RebarSection2D } from '../viz/RebarSection2D'

const PileScene3D = lazy(() =>
  import('../viz3d/PileScene3D').then((m) => ({ default: m.PileScene3D })),
)
const ShallowScene3D = lazy(() =>
  import('../viz3d/ShallowScene3D').then((m) => ({ default: m.ShallowScene3D })),
)

type VizMode = '2d' | '3d'

/** Painel de visualização: só lê o store (sem chamar engines). */
export function VizPanel() {
  const [mode, setMode] = useState<VizMode>('2d')
  const diameterCm = useProjectStore((s) => s.diameterCm)
  const tipDepth_m = useProjectStore((s) => s.tipDepth_m)
  const waterLevel_m = useProjectStore((s) => s.waterLevel_m)
  const layers = useProjectStore((s) => s.layers)
  const pileTypeId = useProjectStore((s) => s.pileTypeId)
  const step = useProjectStore((s) => s.step)
  const structural = useProjectStore((s) => s.structural)
  const theme = useProjectStore((s) => s.theme)
  const foundationKind = useProjectStore((s) => s.foundationKind)
  const blockResult = useProjectStore((s) => s.blockResult)
  const footingResult = useProjectStore((s) => s.footingResult)
  const caissonResult = useProjectStore((s) => s.caissonResult)
  const raftResult = useProjectStore((s) => s.raftResult)
  const footingDf_m = useProjectStore((s) => s.footingDf_m)
  const raftDf_m = useProjectStore((s) => s.raftDf_m)
  const enlargedBaseVolumeLiters = useProjectStore((s) => s.enlargedBaseVolumeLiters)
  const blockEmbedment_m = useProjectStore((s) => s.blockEmbedment_m)
  const blockThickness_m = useProjectStore((s) => s.blockThickness_m)
  const pileTopElevation_m = useProjectStore((s) => s.pileTopElevation_m)
  const label = PILE_TYPES.find((p) => p.id === pileTypeId)?.name ?? 'Estaca'
  const pile = PILE_TYPES.find((p) => p.id === pileTypeId)
  const frankiVol =
    pile?.requiresEnlargedBase && enlargedBaseVolumeLiters !== ''
      ? Number(enlargedBaseVolumeLiters)
      : null

  const datum = resolvePileDatum({
    foundationKind,
    tipDepth_m,
    blockThickness_m: blockResult?.cap.thickness_m ?? blockThickness_m,
    blockEmbedment_m,
    pileTopElevation_m,
  })

  const showBlock = foundationKind === 'pile_cap' && blockResult != null
  const showFooting = foundationKind === 'footing' && footingResult != null
  const showCaisson = foundationKind === 'caisson' && caissonResult != null
  const showRaft = foundationKind === 'raft' && raftResult != null
  const showPileViz = foundationKind === 'pile' || foundationKind === 'pile_cap'
  const showShallowViz = showFooting || showCaisson || showRaft
  const showToggle = showPileViz || showShallowViz

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {showToggle && (
        <div className="viz-mode-toggle" role="group" aria-label="Modo de visualização">
          <button
            type="button"
            className={mode === '2d' ? 'active' : ''}
            onClick={() => setMode('2d')}
          >
            2D
          </button>
          <button
            type="button"
            className={mode === '3d' ? 'active' : ''}
            onClick={() => setMode('3d')}
          >
            3D
          </button>
        </div>
      )}

      {showShallowViz && mode === '2d' && (
        <>
          {showFooting && footingResult && (
            <section className="panel viz2d-panel">
              <FootingPlan2D footing={footingResult} />
            </section>
          )}
          {showCaisson && caissonResult && (
            <section className="panel viz2d-panel">
              <CaissonSection2D caisson={caissonResult} />
            </section>
          )}
          {showRaft && raftResult && (
            <section className="panel viz2d-panel">
              <RaftPlan2D raft={raftResult} />
            </section>
          )}
        </>
      )}

      {showShallowViz && mode === '3d' && (
        <section className="panel viz2d-panel">
          <Suspense fallback={<p className="hint">Carregando vista 3D…</p>}>
            {showFooting && footingResult && (
              <ShallowScene3D
                kind="footing"
                theme={theme}
                layers={layers}
                waterLevel_m={waterLevel_m}
                label="Sapata"
                footing={{
                  B_m: footingResult.B_m,
                  L_m: footingResult.L_m,
                  thickness_m: footingResult.thickness_m,
                  embedment_m: footingDf_m,
                }}
              />
            )}
            {showCaisson && caissonResult && (
              <ShallowScene3D
                kind="caisson"
                theme={theme}
                layers={layers}
                waterLevel_m={waterLevel_m}
                label="Tubulão"
                caisson={{
                  shaftDiameter_m: caissonResult.shaftDiameter_m,
                  baseDiameter_m: caissonResult.baseDiameter_m,
                  length_m: caissonResult.length_m,
                }}
              />
            )}
            {showRaft && raftResult && (
              <ShallowScene3D
                kind="raft"
                theme={theme}
                layers={layers}
                waterLevel_m={waterLevel_m}
                label="Radier"
                raft={{
                  B_m: raftResult.B_m,
                  L_m: raftResult.L_m,
                  thickness_m: raftResult.thickness_m,
                  embedment_m: raftDf_m,
                }}
              />
            )}
          </Suspense>
        </section>
      )}

      {showPileViz && mode === '2d' ? (
        <>
          {showBlock && blockResult && (
            <section className="panel viz2d-panel">
              <BlockPlan2D block={blockResult} diameter_m={diameterCm / 100} />
            </section>
          )}
          <section className="panel viz2d-panel">
            <FoundationSection2D
              diameterCm={diameterCm}
              tipDepth_m={tipDepth_m}
              waterLevel_m={waterLevel_m}
              layers={layers}
              pileLabel={label}
              pileTopDepth_m={datum.pileTopDepth_m}
              cap={
                showBlock && blockResult
                  ? {
                      width_m: blockResult.cap.width_m,
                      length_m: blockResult.cap.length_m,
                      thickness_m: blockResult.cap.thickness_m,
                    }
                  : null
              }
              piles={
                showBlock && blockResult
                  ? blockResult.piles.map((p) => ({
                      x_m: p.position.x_m,
                      label: p.label,
                    }))
                  : null
              }
            />
          </section>
          {step === 'rebar' && structural?.detail && (
            <section className="panel viz2d-panel">
              <RebarSection2D
                diameter_m={diameterCm / 100}
                barCount={structural.detail.longitudinal.count}
                barDia_mm={structural.detail.longitudinal.diameter_mm}
                cover_mm={structural.detail.cover_mm}
                stirrupDia_mm={structural.detail.transverse.diameter_mm}
              />
            </section>
          )}
        </>
      ) : null}

      {showPileViz && mode === '3d' ? (
        <section className="panel viz2d-panel">
          <Suspense fallback={<p className="hint">Carregando vista 3D…</p>}>
            <PileScene3D
              diameterCm={diameterCm}
              tipDepth_m={tipDepth_m}
              waterLevel_m={waterLevel_m}
              layers={layers}
              pileLabel={label}
              pileTop_z={datum.pileTop_z}
              enlargedBaseVolumeLiters={
                frankiVol != null && Number.isFinite(frankiVol) ? frankiVol : null
              }
              theme={theme}
              groupPiles={
                showBlock && blockResult
                  ? blockResult.piles.map((p) => ({
                      x_m: p.position.x_m,
                      y_m: p.position.y_m,
                      label: p.label,
                    }))
                  : null
              }
              cap={
                showBlock && blockResult
                  ? {
                      minX_m: blockResult.cap.minX_m,
                      maxX_m: blockResult.cap.maxX_m,
                      minY_m: blockResult.cap.minY_m,
                      maxY_m: blockResult.cap.maxY_m,
                      thickness_m: blockResult.cap.thickness_m,
                    }
                  : null
              }
              embedInCap_m={showBlock ? blockEmbedment_m : 0}
              rebar={
                structural?.detail
                  ? {
                      longCount: structural.detail.longitudinal.count,
                      longDia_mm: structural.detail.longitudinal.diameter_mm,
                      cover_mm: structural.detail.cover_mm,
                      transDia_mm: structural.detail.transverse.diameter_mm,
                      transSpacing_m: structural.detail.transverse.spacing_m,
                      cageLength_m: structural.detail.cageLength_m,
                      kind: structural.detail.transverse.kind,
                      detailText: structural.detail.detailText,
                    }
                  : null
              }
            />
          </Suspense>
        </section>
      ) : null}
    </div>
  )
}
