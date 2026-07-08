import { Navigate, Route, Routes } from 'react-router-dom'
import { MobileAppShell } from './layout/MobileAppShell'
import { MobileEmployeePage } from './pages/MobileEmployeePage'
import { MobileEmployeesPage } from './pages/MobileEmployeesPage'
import { MobileDecisionsPage } from './pages/MobileDecisionsPage'
import { MobileReportDetailPage } from './pages/MobileReportDetailPage'
import { MobileReportsPage } from './pages/MobileReportsPage'
import { MobileRunTaskPage } from './pages/MobileRunTaskPage'
import { MobileMorePage, MobileTasksPage } from './pages/MobileTabPages'
import { MobileTodayPage } from './pages/MobileTodayPage'

/**
 * Mounted at App route `/mobile/*` — paths here are relative to the splat segment.
 */
export function MobileRoutes() {
  return (
    <MobileAppShell>
      <Routes>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<MobileTodayPage />} />
        <Route path="employees/:id" element={<MobileEmployeePage />} />
        <Route path="employees" element={<MobileEmployeesPage />} />
        <Route path="tasks/new" element={<MobileRunTaskPage />} />
        <Route path="tasks" element={<MobileTasksPage />} />
        <Route path="decisions" element={<MobileDecisionsPage />} />
        <Route path="reports/:id" element={<MobileReportDetailPage />} />
        <Route path="reports" element={<MobileReportsPage />} />
        <Route path="more" element={<MobileMorePage />} />
        <Route path="*" element={<Navigate to="today" replace />} />
      </Routes>
    </MobileAppShell>
  )
}
