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

export function MobileRoutes() {
  return (
    <MobileAppShell>
      <Routes>
        <Route path="/mobile" element={<Navigate to="/mobile/today" replace />} />
        <Route path="/mobile/today" element={<MobileTodayPage />} />
        <Route path="/mobile/employees/:id" element={<MobileEmployeePage />} />
        <Route path="/mobile/employees" element={<MobileEmployeesPage />} />
        <Route path="/mobile/tasks/new" element={<MobileRunTaskPage />} />
        <Route path="/mobile/tasks" element={<MobileTasksPage />} />
        <Route path="/mobile/decisions" element={<MobileDecisionsPage />} />
        <Route path="/mobile/reports/:id" element={<MobileReportDetailPage />} />
        <Route path="/mobile/reports" element={<MobileReportsPage />} />
        <Route path="/mobile/more" element={<MobileMorePage />} />
        <Route path="*" element={<Navigate to="/mobile/today" replace />} />
      </Routes>
    </MobileAppShell>
  )
}
