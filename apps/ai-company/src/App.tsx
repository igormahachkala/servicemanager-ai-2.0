import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { MissionControlFlowPage } from './flow-workspace'
import { MissionControlRoutes } from './mission-control/router'
import { MobileRoutes } from './mobile/MobileRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/mobile/*" element={<MobileRoutes />} />
        <Route
          path="/*"
          element={
            <AppShell>
              <Routes>
                <Route path="/" element={<MissionControlFlowPage />} />
                <Route path="/ops/*" element={<MissionControlRoutes />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
