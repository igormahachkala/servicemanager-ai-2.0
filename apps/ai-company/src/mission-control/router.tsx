import { lazy } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { MissionControlShell } from './layout/MissionControlShell'

// Every page is its own chunk: the panel loads only the screen being opened
// (the single 2.5 MB bundle was slow over the internet). Suspense: PlatformShell.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const CompaniesPage = lazy(() => import('../pages/CompaniesPage').then((m) => ({ default: m.CompaniesPage })))
const CompanyPage = lazy(() => import('../pages/CompanyPage').then((m) => ({ default: m.CompanyPage })))
const NewCompanyPage = lazy(() => import('../pages/NewCompanyPage').then((m) => ({ default: m.NewCompanyPage })))
const NotificationsPage = lazy(() => import('../pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const OrganizationChartPage = lazy(() => import('../pages/OrganizationChartPage').then((m) => ({ default: m.OrganizationChartPage })))
const DepartmentPage = lazy(() => import('../pages/DepartmentPage').then((m) => ({ default: m.DepartmentPage })))
const TeamPage = lazy(() => import('../pages/TeamPage').then((m) => ({ default: m.TeamPage })))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })))
const NewEmployeePage = lazy(() => import('./pages/NewEmployeePage').then((m) => ({ default: m.NewEmployeePage })))
const EmployeeProfilePage = lazy(() => import('./pages/EmployeeProfilePage').then((m) => ({ default: m.EmployeeProfilePage })))
const TasksPage = lazy(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })))
const ToolsCatalogPage = lazy(() => import('./pages/ToolsCatalogPage').then((m) => ({ default: m.ToolsCatalogPage })))
const ToolDetailsPage = lazy(() => import('./pages/ToolDetailsPage').then((m) => ({ default: m.ToolDetailsPage })))
const PresencePage = lazy(() => import('../pages/PresencePage').then((m) => ({ default: m.PresencePage })))
const ProjectsPage = lazy(() => import('../pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const NewProjectPage = lazy(() => import('../pages/NewProjectPage').then((m) => ({ default: m.NewProjectPage })))
const ProjectPage = lazy(() => import('../pages/ProjectPage').then((m) => ({ default: m.ProjectPage })))
const WorkspacesPage = lazy(() => import('./pages/WorkspacesPage').then((m) => ({ default: m.WorkspacesPage })))
const NewWorkspacePage = lazy(() => import('./pages/NewWorkspacePage').then((m) => ({ default: m.NewWorkspacePage })))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })))
const EmployeeMemoryPage = lazy(() => import('../pages/EmployeeMemoryPage').then((m) => ({ default: m.EmployeeMemoryPage })))
const KnowledgePage = lazy(() => import('../pages/KnowledgePage').then((m) => ({ default: m.KnowledgePage })))
const KnowledgeItemPage = lazy(() => import('../pages/KnowledgeItemPage').then((m) => ({ default: m.KnowledgeItemPage })))
const KnowledgeCollectionsPage = lazy(() => import('../pages/KnowledgeCollectionsPage').then((m) => ({ default: m.KnowledgeCollectionsPage })))
const ApprovalsPage = lazy(() => import('../pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })))
const ApprovalDetailsPage = lazy(() => import('../pages/ApprovalDetailsPage').then((m) => ({ default: m.ApprovalDetailsPage })))
const ReportsPage = lazy(() => import('../pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const ReportPage = lazy(() => import('../pages/ReportPage').then((m) => ({ default: m.ReportPage })))
const AuditPage = lazy(() => import('../pages/AuditPage').then((m) => ({ default: m.AuditPage })))
const CompanyTimelinePage = lazy(() => import('../pages/CompanyTimelinePage').then((m) => ({ default: m.CompanyTimelinePage })))
const ActivityPage = lazy(() => import('../pages/ActivityPage').then((m) => ({ default: m.ActivityPage })))
const EmployeeRuntimePage = lazy(() => import('../pages/EmployeeRuntimePage').then((m) => ({ default: m.EmployeeRuntimePage })))
const EmployeeWorkspacePage = lazy(() => import('../pages/EmployeeWorkspacePage').then((m) => ({ default: m.EmployeeWorkspacePage })))
const RuntimeLivePage = lazy(() => import('../pages/RuntimeLivePage').then((m) => ({ default: m.RuntimeLivePage })))
const RuntimeRunPage = lazy(() => import('../pages/RuntimeRunPage').then((m) => ({ default: m.RuntimeRunPage })))
const RuntimeSettingsPage = lazy(() => import('../pages/RuntimeSettingsPage').then((m) => ({ default: m.RuntimeSettingsPage })))
const RunsPage = lazy(() => import('../pages/RunsPage').then((m) => ({ default: m.RunsPage })))
const RunDetailsPage = lazy(() => import('../pages/RunDetailsPage').then((m) => ({ default: m.RunDetailsPage })))
const ChatsPage = lazy(() => import('../pages/ChatsPage').then((m) => ({ default: m.ChatsPage })))
const ChatPage = lazy(() => import('../pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const NewChatPage = lazy(() => import('../pages/NewChatPage').then((m) => ({ default: m.NewChatPage })))
const EmployeeCompetenciesPage = lazy(() => import('../pages/EmployeeCompetenciesPage').then((m) => ({ default: m.EmployeeCompetenciesPage })))
const EmployeeLearningPage = lazy(() => import('../pages/EmployeeLearningPage').then((m) => ({ default: m.EmployeeLearningPage })))
const CollaborationPage = lazy(() => import('../pages/CollaborationPage').then((m) => ({ default: m.CollaborationPage })))
const AiPhotoLabControlRoomPage = lazy(() => import('../pages/AiPhotoLabControlRoomPage').then((m) => ({ default: m.AiPhotoLabControlRoomPage })))
const AiPhotoLabKickoffPage = lazy(() => import('../pages/AiPhotoLabKickoffPage').then((m) => ({ default: m.AiPhotoLabKickoffPage })))
const ExecutionPage = lazy(() => import('../pages/ExecutionPage').then((m) => ({ default: m.ExecutionPage })))
const AnalysisTasksPage = lazy(() => import('../pages/AnalysisTasksPage').then((m) => ({ default: m.AnalysisTasksPage })))
const CompanyCanvasPage = lazy(() => import('../pages/CompanyCanvasPage').then((m) => ({ default: m.CompanyCanvasPage })))
const ToolExecutionsPage = lazy(() => import('../pages/ToolExecutionsPage').then((m) => ({ default: m.ToolExecutionsPage })))
const HandoffsPage = lazy(() => import('../pages/HandoffsPage').then((m) => ({ default: m.HandoffsPage })))
const HandoffDetailsPage = lazy(() => import('../pages/HandoffDetailsPage').then((m) => ({ default: m.HandoffDetailsPage })))
const SprintPage = lazy(() => import('../pages/SprintPage').then((m) => ({ default: m.SprintPage })))
const WorkdayPage = lazy(() => import('../pages/WorkdayPage').then((m) => ({ default: m.WorkdayPage })))
const TaskResultsPage = lazy(() => import('../pages/TaskResultsPage').then((m) => ({ default: m.TaskResultsPage })))
const TaskResultDetailsPage = lazy(() => import('../pages/TaskResultDetailsPage').then((m) => ({ default: m.TaskResultDetailsPage })))
const VisualLabPage = lazy(() => import('../pages/VisualLabPage').then((m) => ({ default: m.VisualLabPage })))
const CompanyOperatingDayPage = lazy(() => import('../pages/CompanyOperatingDayPage').then((m) => ({ default: m.CompanyOperatingDayPage })))
const RunTaskPage = lazy(() => import('../pages/RunTaskPage').then((m) => ({ default: m.RunTaskPage })))
const OwnerMorningReportPage = lazy(() => import('../pages/OwnerMorningReportPage').then((m) => ({ default: m.OwnerMorningReportPage })))
const EmployeeOperatingDayPage = lazy(() => import('../pages/EmployeeOperatingDayPage').then((m) => ({ default: m.EmployeeOperatingDayPage })))

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
        <Route path="morning-report" element={<OwnerMorningReportPage />} />
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
        <Route path="employees/:id/today" element={<EmployeeOperatingDayPage />} />
        <Route path="employees/:id/workspace" element={<EmployeeWorkspacePage />} />
        <Route path="employees/:id/runtime" element={<EmployeeRuntimePage />} />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="execution" element={<ExecutionPage />} />
        <Route path="run-task" element={<RunTaskPage />} />
        <Route path="analysis" element={<AnalysisTasksPage />} />
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
        <Route path="day" element={<CompanyOperatingDayPage />} />
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
