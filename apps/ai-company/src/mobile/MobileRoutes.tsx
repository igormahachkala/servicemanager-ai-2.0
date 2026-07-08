import { Navigate, Route, Routes } from 'react-router-dom'
import { MobileAppShell } from './layout/MobileAppShell'
import { MobileEmployeePage } from './pages/MobileEmployeePage'
import {
  MobileDecisionsPage,
  MobileEmployeesPage,
  MobileMorePage,
  MobileTasksPage,
} from './pages/MobileTabPages'
import { MobileTodayPage } from './pages/MobileTodayPage'

export function MobileRoutes() {
  return (
    <MobileAppShell>
      <Routes>
        <Route path="/mobile" element={<Navigate to="/mobile/today" replace />} />
        <Route path="/mobile/today" element={<MobileTodayPage />} />
        <Route path="/mobile/employees/:id" element={<MobileEmployeePage />} />
        <Route path="/mobile/employees" element={<MobileEmployeesPage />} />
        <Route path="/mobile/tasks" element={<MobileTasksPage />} />
        <Route path="/mobile/decisions" element={<MobileDecisionsPage />} />
        <Route path="/mobile/more" element={<MobileMorePage />} />
        <Route path="*" element={<Navigate to="/mobile/today" replace />} />
      </Routes>
    </MobileAppShell>
  )
}
