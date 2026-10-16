import { useEffect } from 'react'
import { ProjectAlertsBanner } from './components/ProjectAlertsBanner'
import { Sidebar } from './components/Sidebar'
import { VizPanel } from './components/VizPanel'
import { DashboardView } from './components/shell/DashboardView'
import { ProjectsView } from './components/shell/ProjectsView'
import { ProjectContextBar } from './components/shell/ProjectContextBar'
import { StepBorehole } from './components/steps/StepBorehole'
import { StepFoundation } from './components/steps/StepFoundation'
import { StepLoads } from './components/steps/StepLoads'
import { StepMethods } from './components/steps/StepMethods'
import { StepPile } from './components/steps/StepPile'
import { StepProject } from './components/steps/StepProject'
import { StepResults } from './components/steps/StepResults'
import { StepRebar } from './components/steps/StepRebar'
import { StepMemorial } from './components/steps/StepMemorial'
import { StepBlock } from './components/steps/StepBlock'
import { StepFooting } from './components/steps/StepFooting'
import { StepCaisson } from './components/steps/StepCaisson'
import { StepRaft } from './components/steps/StepRaft'
import { StepGroundwater } from './components/steps/StepGroundwater'
import { StepAnalysis } from './components/steps/StepAnalysis'
import { StepTipSweep } from './components/steps/StepTipSweep'
import { StepGroup } from './components/steps/StepGroup'
import { StepDrawings } from './components/steps/StepDrawings'
import { useProjectStore } from './store/projectStore'
import { useLibraryStore } from './store/projectLibrary'
import { syncActiveToLibrary } from './store/workspaceBridge'
import { vizModeForStep } from './store/wizardFlow'
import './styles/app.css'

export default function App() {
  const step = useProjectStore((s) => s.step)
  const theme = useProjectStore((s) => s.theme)
  const projectName = useProjectStore((s) => s.projectName)
  const foundationKind = useProjectStore((s) => s.foundationKind)
  const layersLen = useProjectStore((s) => s.layers.length)
  const hasCapacity = useProjectStore(
    (s) =>
      s.result != null ||
      s.footingResult != null ||
      s.caissonResult != null ||
      s.raftResult != null,
  )
  const shellView = useLibraryStore((s) => s.shellView)
  const vizMode = vizModeForStep(step)
  const showVizPanel =
    shellView === 'workspace' &&
    (vizMode === 'profile' ||
      (vizMode === 'project' &&
        (hasCapacity || step === 'pile' || step === 'loads' || step === 'drawings')))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Autosave biblioteca quando o workspace muda (debounce leve).
  useEffect(() => {
    if (shellView !== 'workspace') return
    const t = window.setTimeout(() => syncActiveToLibrary(), 400)
    return () => window.clearTimeout(t)
  }, [shellView, projectName, foundationKind, layersLen, step, hasCapacity])

  const content = (
    <>
      {step === 'project' && <StepProject />}
      {step === 'borehole' && <StepBorehole />}
      {step === 'groundwater' && <StepGroundwater />}
      {step === 'loads' && <StepLoads />}
      {step === 'analysis' && <StepAnalysis />}
      {step === 'foundation' && <StepFoundation />}
      {step === 'pile' && <StepPile />}
      {step === 'block' && <StepBlock />}
      {step === 'footing' && <StepFooting />}
      {step === 'caisson' && <StepCaisson />}
      {step === 'raft' && <StepRaft />}
      {step === 'methods' && <StepMethods />}
      {step === 'results' && <StepResults />}
      {step === 'tip_sweep' && <StepTipSweep />}
      {step === 'group' && <StepGroup />}
      {step === 'rebar' && <StepRebar />}
      {step === 'drawings' && <StepDrawings />}
      {step === 'memorial' && <StepMemorial />}
    </>
  )

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        {shellView === 'dashboard' && <DashboardView />}
        {shellView === 'projects' && <ProjectsView />}
        {shellView === 'workspace' && (
          <>
            <ProjectContextBar />
            <ProjectAlertsBanner />
            {showVizPanel ? (
              <div className="main-with-viz">
                <div>{content}</div>
                <VizPanel />
              </div>
            ) : (
              content
            )}
          </>
        )}
      </main>
    </div>
  )
}
