import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'

// Desktop panel, flow canvas and mobile app are separate chunks.
const MissionControlFlowPage = lazy(() =>
  import('./flow-workspace').then((m) => ({ default: m.MissionControlFlowPage })),
)
const MissionControlRoutes = lazy(() =>
  import('./mission-control/router').then((m) => ({ default: m.MissionControlRoutes })),
)
const MobileRoutes = lazy(() => import('./mobile/MobileRoutes').then((m) => ({ default: m.MobileRoutes })))

const loading = <div className="acPageLoading" aria-busy="true" />

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={loading}>
      <Routes>
        <Route path="/mobile/*" element={<div className="acMobileRoot"><MobileRoutes /></div>} />
        <Route
          path="/*"
          element={
            <AppShell>
              <Suspense fallback={loading}>
              <Routes>
                <Route path="/" element={<MissionControlFlowPage />} />
                <Route path="/ops/*" element={<MissionControlRoutes />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </AppShell>
          }
        />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
