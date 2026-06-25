import { Navigate, Route, Routes } from 'react-router-dom'
import { MissionControlShell } from './layout/MissionControlShell'
import { DashboardPage } from './pages/DashboardPage'
import { OrganizationPage } from './pages/OrganizationPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { NewEmployeePage } from './pages/NewEmployeePage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { TasksPage } from './pages/TasksPage'
import { MissionFeedPage } from './pages/MissionFeedPage'
import { AiToolsRegistryPage } from './pages/AiToolsRegistryPage'

/** NOC panel routes under /ops — mock data only. */
export function MissionControlRoutes() {
  return (
    <Routes>
      <Route element={<MissionControlShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/new" element={<NewEmployeePage />} />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="feed" element={<MissionFeedPage />} />
        <Route path="tools" element={<AiToolsRegistryPage />} />
        <Route path="*" element={<Navigate to="/ops" replace />} />
      </Route>
    </Routes>
  )
}
