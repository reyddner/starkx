import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import Welcome from './Welcome'
const App = lazy(() => import('./App'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
      ? <Suspense fallback={<p role="status">Carregando StarkX…</p>}><App /></Suspense>
      : <Welcome />}
  </StrictMode>,
)
