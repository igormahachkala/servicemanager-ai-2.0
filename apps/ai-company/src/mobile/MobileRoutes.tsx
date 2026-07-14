import { Navigate, Route, Routes } from 'react-router-dom'
import { getDefaultMobileEmployeeId } from '../domain/mobileEmployee'
import { MobileAppShell } from './layout/MobileAppShell'
import { MobileEmployeePage } from './pages/MobileEmployeePage'
import { MobileEmployeesPage } from './pages/MobileEmployeesPage'
import { MobileDecisionsPage } from './pages/MobileDecisionsPage'
import { MobileReportDetailPage } from './pages/MobileReportDetailPage'
import { MobileReportsPage } from './pages/MobileReportsPage'
import { MobileRuntimeLivePage } from './pages/MobileRuntimeLivePage'
import { MobileManualCursorTaskFlowPage } from './pages/MobileManualCursorTaskFlowPage'
import { MobileRunTaskPage } from './pages/MobileRunTaskPage'
import { MobileDemoPage } from './pages/MobileDemoPage'
import { MobileMaxChatPage } from './pages/MobileMaxChatPage'
import { MobileMorePage } from './pages/MobileTabPages'
import { MobileTaskHistoryPage } from './pages/MobileTaskHistoryPage'
import { MobileTasksCenterPage } from './pages/MobileTasksCenterPage'
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
        <Route path="cursor-task/:runId" element={<MobileManualCursorTaskFlowPage />} />
        <Route path="cursor-task" element={<MobileManualCursorTaskFlowPage />} />
        <Route path="tasks/history" element={<MobileTaskHistoryPage />} />
        <Route path="tasks" element={<MobileTasksCenterPage />} />
        <Route path="history" element={<Navigate to="tasks/history" replace />} />
        <Route path="decisions" element={<MobileDecisionsPage />} />
        <Route path="runtime/:runId" element={<MobileRuntimeLivePage />} />
        <Route path="runtime" element={<MobileRuntimeLivePage />} />
        <Route path="reports/:id" element={<MobileReportDetailPage />} />
        <Route path="reports" element={<MobileReportsPage />} />
        <Route path="demo" element={<MobileDemoPage />} />
        <Route path="chat/:employeeId" element={<MobileMaxChatPage />} />
        <Route path="chat" element={<Navigate to={`chat/${getDefaultMobileEmployeeId()}`} replace />} />
        <Route path="more" element={<MobileMorePage />} />
        <Route path="*" element={<Navigate to="today" replace />} />
      </Routes>
    </MobileAppShell>
  )
}
