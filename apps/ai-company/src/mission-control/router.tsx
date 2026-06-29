import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { MissionControlShell } from './layout/MissionControlShell'
import { DashboardPage } from './pages/DashboardPage'
import { CompaniesPage } from '../pages/CompaniesPage'
import { CompanyPage } from '../pages/CompanyPage'
import { NewCompanyPage } from '../pages/NewCompanyPage'
import { NotificationsPage } from '../pages/NotificationsPage'
import { OrganizationChartPage } from '../pages/OrganizationChartPage'
import { DepartmentPage } from '../pages/DepartmentPage'
import { TeamPage } from '../pages/TeamPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { NewEmployeePage } from './pages/NewEmployeePage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { TasksPage } from './pages/TasksPage'
import { ToolsCatalogPage } from './pages/ToolsCatalogPage'
import { ToolDetailsPage } from './pages/ToolDetailsPage'
import { PresencePage } from '../pages/PresencePage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { NewProjectPage } from '../pages/NewProjectPage'
import { ProjectPage } from '../pages/ProjectPage'
import { WorkspacesPage } from './pages/WorkspacesPage'
import { NewWorkspacePage } from './pages/NewWorkspacePage'
import { WorkspacePage } from './pages/WorkspacePage'
import { EmployeeMemoryPage } from '../pages/EmployeeMemoryPage'
import { KnowledgePage } from '../pages/KnowledgePage'
import { KnowledgeItemPage } from '../pages/KnowledgeItemPage'
import { KnowledgeCollectionsPage } from '../pages/KnowledgeCollectionsPage'
import { ApprovalsPage } from '../pages/ApprovalsPage'
import { ApprovalDetailsPage } from '../pages/ApprovalDetailsPage'
import { ReportsPage } from '../pages/ReportsPage'
import { ReportPage } from '../pages/ReportPage'
import { AuditPage } from '../pages/AuditPage'
import { CompanyTimelinePage } from '../pages/CompanyTimelinePage'
import { ActivityPage } from '../pages/ActivityPage'
import { EmployeeRuntimePage } from '../pages/EmployeeRuntimePage'
import { EmployeeWorkspacePage } from '../pages/EmployeeWorkspacePage'
import { RuntimeLivePage } from '../pages/RuntimeLivePage'
import { RuntimeRunPage } from '../pages/RuntimeRunPage'
import { RuntimeSettingsPage } from '../pages/RuntimeSettingsPage'
import { RunsPage } from '../pages/RunsPage'
import { RunDetailsPage } from '../pages/RunDetailsPage'
import { ChatsPage } from '../pages/ChatsPage'
import { ChatPage } from '../pages/ChatPage'
import { NewChatPage } from '../pages/NewChatPage'
import { EmployeeCompetenciesPage } from '../pages/EmployeeCompetenciesPage'
import { EmployeeLearningPage } from '../pages/EmployeeLearningPage'
import { CollaborationPage } from '../pages/CollaborationPage'
import { AiPhotoLabControlRoomPage } from '../pages/AiPhotoLabControlRoomPage'
import { AiPhotoLabKickoffPage } from '../pages/AiPhotoLabKickoffPage'
import { ExecutionPage } from '../pages/ExecutionPage'
import { CompanyCanvasPage } from '../pages/CompanyCanvasPage'
import { ToolExecutionsPage } from '../pages/ToolExecutionsPage'
import { HandoffsPage } from '../pages/HandoffsPage'
import { HandoffDetailsPage } from '../pages/HandoffDetailsPage'
import { SprintPage } from '../pages/SprintPage'
import { WorkdayPage } from '../pages/WorkdayPage'
import { TaskResultsPage } from '../pages/TaskResultsPage'
import { TaskResultDetailsPage } from '../pages/TaskResultDetailsPage'
import { VisualLabPage } from '../pages/VisualLabPage'
import { RunTaskPage } from '../pages/RunTaskPage'

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
        <Route path="canvas" element={<CompanyCanvasPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/new" element={<NewCompanyPage />} />
        <Route path="companies/:id" element={<CompanyPage />} />
        <Route path="organization" element={<OrganizationChartPage />} />
        <Route path="organization/departments/:id" element={<DepartmentPage />} />
        <Route path="organization/teams/:id" element={<TeamPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/new" element={<NewEmployeePage />} />
        <Route path="employees/:id/conversation" element={<LegacyConversationRedirect />} />
        <Route path="employees/:id/memory" element={<EmployeeMemoryPage />} />
        <Route path="employees/:id/competencies" element={<EmployeeCompetenciesPage />} />
        <Route path="employees/:id/learning" element={<EmployeeLearningPage />} />
        <Route path="employees/:id/workspace" element={<EmployeeWorkspacePage />} />
        <Route path="employees/:id/runtime" element={<EmployeeRuntimePage />} />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="execution" element={<ExecutionPage />} />
        <Route path="run-task" element={<RunTaskPage />} />
        <Route path="visual-lab" element={<VisualLabPage />} />
        <Route path="feed" element={<Navigate to="/ops/timeline" replace />} />
        <Route path="timeline" element={<CompanyTimelinePage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="approvals/:id" element={<ApprovalDetailsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:id" element={<ReportPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="runtime/live" element={<RuntimeLivePage />} />
        <Route path="runtime/runs/:id" element={<RuntimeRunPage />} />
        <Route path="runtime" element={<RuntimeSettingsPage />} />
        <Route path="runs/:id" element={<RunDetailsPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="chats" element={<ChatsPage />} />
        <Route path="chats/new" element={<NewChatPage />} />
        <Route path="chats/:id" element={<ChatPage />} />
        <Route path="collaboration" element={<CollaborationPage />} />
        <Route path="collaboration/:id" element={<CollaborationPage />} />
        <Route path="discussions" element={<Navigate to="/ops/chats" replace />} />
        <Route path="discussions/new" element={<Navigate to="/ops/chats/new" replace />} />
        <Route path="discussions/:id" element={<LegacyDiscussionRedirect />} />
        <Route path="presence" element={<PresencePage />} />
        <Route path="workday" element={<WorkdayPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/new" element={<NewProjectPage />} />
        <Route path="projects/project-ai-photo-lab/kickoff" element={<AiPhotoLabKickoffPage />} />
        <Route path="projects/project-ai-photo-lab/control-room" element={<AiPhotoLabControlRoomPage />} />
        <Route path="projects/:id/control-room" element={<AiPhotoLabControlRoomPage />} />
        <Route path="projects/:id" element={<ProjectPage />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="workspaces/new" element={<NewWorkspacePage />} />
        <Route path="workspaces/:id" element={<WorkspacePage />} />
        <Route path="knowledge/collections" element={<KnowledgeCollectionsPage />} />
        <Route path="knowledge/:id" element={<KnowledgeItemPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="tools" element={<ToolsCatalogPage />} />
        <Route path="tools/:id" element={<ToolDetailsPage />} />
        <Route path="tool-executions" element={<ToolExecutionsPage />} />
        <Route path="task-results/:id" element={<TaskResultDetailsPage />} />
        <Route path="task-results" element={<TaskResultsPage />} />
        <Route path="handoffs/:id" element={<HandoffDetailsPage />} />
        <Route path="handoffs" element={<HandoffsPage />} />
        <Route path="sprint/:id" element={<SprintPage />} />
        <Route path="sprint" element={<SprintPage />} />
        <Route path="*" element={<Navigate to="/ops" replace />} />
      </Route>
    </Routes>
  )
}
