import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { MissionControlShell } from './layout/MissionControlShell'
import { DashboardPage } from './pages/DashboardPage'
import { OrganizationPage } from './pages/OrganizationPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { NewEmployeePage } from './pages/NewEmployeePage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { TasksPage } from './pages/TasksPage'
import { MissionFeedPage } from './pages/MissionFeedPage'
import { ToolsCatalogPage } from './pages/ToolsCatalogPage'
import { ToolDetailsPage } from './pages/ToolDetailsPage'
import { WorkspacesPage } from './pages/WorkspacesPage'
import { NewWorkspacePage } from './pages/NewWorkspacePage'
import { WorkspacePage } from './pages/WorkspacePage'
import { EmployeeMemoryPage } from '../pages/EmployeeMemoryPage'
import { ChatsPage } from '../pages/ChatsPage'
import { ChatPage } from '../pages/ChatPage'
import { NewChatPage } from '../pages/NewChatPage'

function LegacyConversationRedirect() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/ops/chats" replace />
  return <Navigate to={`/ops/chats/${encodeURIComponent(`conv:${id}`)}`} replace />
}

function LegacyDiscussionRedirect() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/ops/chats" replace />
  return <Navigate to={`/ops/chats/${encodeURIComponent(`disc:${id}`)}`} replace />
}

/** NOC panel routes under /ops — mock data only. */
export function MissionControlRoutes() {
  return (
    <Routes>
      <Route element={<MissionControlShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/new" element={<NewEmployeePage />} />
        <Route path="employees/:id/conversation" element={<LegacyConversationRedirect />} />
        <Route path="employees/:id/memory" element={<EmployeeMemoryPage />} />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="feed" element={<MissionFeedPage />} />
        <Route path="chats" element={<ChatsPage />} />
        <Route path="chats/new" element={<NewChatPage />} />
        <Route path="chats/:id" element={<ChatPage />} />
        <Route path="discussions" element={<Navigate to="/ops/chats" replace />} />
        <Route path="discussions/new" element={<Navigate to="/ops/chats/new" replace />} />
        <Route path="discussions/:id" element={<LegacyDiscussionRedirect />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="workspaces/new" element={<NewWorkspacePage />} />
        <Route path="workspaces/:id" element={<WorkspacePage />} />
        <Route path="tools" element={<ToolsCatalogPage />} />
        <Route path="tools/:id" element={<ToolDetailsPage />} />
        <Route path="*" element={<Navigate to="/ops" replace />} />
      </Route>
    </Routes>
  )
}
