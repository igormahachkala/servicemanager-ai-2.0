import React, { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import * as api from './lib/api'
import { LoginPage } from './views/LoginPage'

function lazyExport<P extends object>(loader: () => Promise<Record<string, ComponentType<P>>>, exportName: string) {
  return lazy(() => loader().then((mod) => ({ default: mod[exportName] })))
}

function RouteFallback() {
  return (
    <div className="muted small" style={{ padding: 24 }}>
      Загрузка…
    </div>
  )
}

function LazyRoute<P extends object>({
  component: Comp,
  props,
}: {
  component: React.LazyExoticComponent<ComponentType<P>>
  props?: P
}) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Comp {...((props ?? {}) as P)} />
    </Suspense>
  )
}

const WorkspaceSelectorPage = lazyExport(() => import('./views/WorkspaceSelectorPage'), 'WorkspaceSelectorPage')
const RequestAccessPage = lazyExport(() => import('./views/RequestAccessPage'), 'RequestAccessPage')
const PublicQuickRequestPage = lazyExport(() => import('./views/PublicQuickRequestPage'), 'PublicQuickRequestPage')
const PublicQuickRequestSuccessPage = lazyExport(
  () => import('./views/PublicQuickRequestSuccessPage'),
  'PublicQuickRequestSuccessPage',
)
const Shell = lazyExport(() => import('./ui/Shell'), 'Shell')
const BoardPage = lazyExport(() => import('./views/BoardPage'), 'BoardPage')
const ArchivePage = lazyExport(() => import('./views/ArchivePage'), 'ArchivePage')
const TicketPage = lazyExport(() => import('./views/TicketPage'), 'TicketPage')
const CreateTicketPage = lazyExport(() => import('./views/CreateTicketPage'), 'CreateTicketPage')
const EmployeesPage = lazyExport(() => import('./views/EmployeesPage'), 'EmployeesPage')
const LocationsPage = lazyExport(() => import('./views/LocationsPage'), 'LocationsPage')
const AnalyticsPage = lazyExport(() => import('./views/AnalyticsPage'), 'AnalyticsPage')
const LocationAnalyticsPage = lazyExport(() => import('./views/LocationAnalyticsPage'), 'LocationAnalyticsPage')
const SettingsPage = lazyExport(() => import('./views/SettingsPage'), 'SettingsPage')
const ProblemCategoriesPage = lazyExport(() => import('./views/ProblemCategoriesPage'), 'ProblemCategoriesPage')
const SpecializationsPage = lazyExport(() => import('./views/SpecializationsPage'), 'SpecializationsPage')
const CompanyPage = lazyExport(() => import('./views/CompanyPage'), 'CompanyPage')
const TechnicianPage = lazyExport(() => import('./views/TechnicianPage'), 'TechnicianPage')
const CompaniesPage = lazyExport(() => import('./views/CompaniesPage'), 'CompaniesPage')
const ServiceContractsPage = lazyExport(() => import('./views/ServiceContractsPage'), 'ServiceContractsPage')
const InspectionTemplatesPage = lazyExport(() => import('./views/InspectionTemplatesPage'), 'InspectionTemplatesPage')
const EngineeringAgentPage = lazyExport(() => import('./views/EngineeringAgentPage'), 'EngineeringAgentPage')
const DashboardPage = lazyExport(() => import('./views/DashboardPage'), 'DashboardPage')
const InspectionRunsPage = lazyExport(() => import('./views/InspectionRunsPage'), 'InspectionRunsPage')
const InspectionRunPage = lazyExport(() => import('./views/InspectionRunPage'), 'InspectionRunPage')
const InspectionRunReportPage = lazyExport(() => import('./views/InspectionRunReportPage'), 'InspectionRunReportPage')
const InspectionQuickPage = lazyExport(() => import('./views/InspectionQuickPage'), 'InspectionQuickPage')
const MapPage = lazyExport(() => import('./pages/MapPage'), 'MapPage')
const AccessConstructorPage = lazyExport(() => import('./pages/platform/AccessConstructorPage'), 'AccessConstructorPage')
const PermissionsPage = lazyExport(() => import('./pages/platform/PermissionsPage'), 'PermissionsPage')
const ManagementV2StubPage = lazyExport(() => import('./views/v2/ManagementV2StubPage'), 'ManagementV2StubPage')
const ContractorsRoutePage = lazyExport(() => import('./views/v2/ContractorsRoutePage'), 'ContractorsRoutePage')
const WorkforcePage = lazyExport(() => import('./views/WorkforcePage'), 'WorkforcePage')
const MobileShell = lazyExport(() => import('./mobile/MobileShell'), 'MobileShell')
const MobileHome = lazyExport(() => import('./mobile/MobileHome'), 'MobileHome')
const MobileCreateTicket = lazyExport(() => import('./mobile/MobileCreateTicket'), 'MobileCreateTicket')
const MobileMyTickets = lazyExport(() => import('./mobile/MobileMyTickets'), 'MobileMyTickets')
const MobileProfile = lazyExport(() => import('./mobile/MobileProfile'), 'MobileProfile')
const MobileTicketPage = lazyExport(() => import('./mobile/MobileTicketPage'), 'MobileTicketPage')
const MobileNotificationsPage = lazyExport(() => import('./mobile/MobileNotificationsPage'), 'MobileNotificationsPage')
const MobilePushSettingsPage = lazyExport(() => import('./mobile/MobilePushSettingsPage'), 'MobilePushSettingsPage')
const MobileSettingsPage = lazyExport(() => import('./mobile/MobileSettingsPage'), 'MobileSettingsPage')
const MobileAnalytics = lazyExport(() => import('./mobile/MobileAnalytics'), 'MobileAnalytics')
const MobileChatsPage = lazyExport(() => import('./mobile/MobileChatsPage'), 'MobileChatsPage')
const MobileOfflineQueue = lazyExport(() => import('./mobile/MobileOfflineQueue'), 'MobileOfflineQueue')
const MobileInspectionList = lazyExport(() => import('./mobile/MobileInspectionList'), 'MobileInspectionList')
const MobileInspectionRunPage = lazyExport(() => import('./mobile/MobileInspectionRunPage'), 'MobileInspectionRunPage')
const MobileShiftPage = lazyExport(() => import('./mobile/MobileShiftPage'), 'MobileShiftPage')
const MobileWorkforcePage = lazyExport(() => import('./mobile/MobileWorkforcePage'), 'MobileWorkforcePage')
const MaxApp = lazyExport(() => import('./max/MaxApp'), 'MaxApp')
const ITCompanyPage = lazyExport(() => import('./it-company/pages/ITCompanyPage'), 'ITCompanyPage')
const AIEmployeesPage = lazyExport(() => import('./it-company/pages/AIEmployeesPage'), 'AIEmployeesPage')
const AIEmployeeDetailsPage = lazyExport(() => import('./it-company/pages/AIEmployeeDetailsPage'), 'AIEmployeeDetailsPage')
const MissionControlPage = lazyExport(() => import('./it-company/pages/MissionControlPage'), 'MissionControlPage')
const AIDeveloperPage = lazyExport(() => import('./it-company/pages/AIDeveloperPage'), 'AIDeveloperPage')

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = api.getToken()
  const location = useLocation()
  if (!token) {
    return <Navigate to={api.loginPathWithReturnTo(`${location.pathname}${location.search}${location.hash}`)} replace />
  }
  return <>{children}</>
}

/** Сброс клиентской сессии (QA, смена аккаунта). Без запроса к API. */
function LogoutAndRedirect() {
  api.clearClientBrowserStorage()
  return <Navigate to="/login" replace />
}

/** `/login?clear=1` — очистка storage до редиректа по токену (удобно для QA без отдельного маршрута). */
function authHomePath() {
  return api.appendScopeToPath(api.getHomeRoute())
}

function LoginGate() {
  if (typeof window !== 'undefined') {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('clear') === '1') {
      api.clearClientBrowserStorage()
      const url = new URL(window.location.href)
      url.searchParams.delete('clear')
      const qs = url.searchParams.toString()
      window.history.replaceState({}, '', `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`)
    }
  }
  if (api.getToken()) {
    const returnTo =
      typeof window !== 'undefined'
        ? api.getReturnToFromSearch(window.location.search)
        : ''
    return <Navigate to={returnTo ? api.workspacePathWithReturnTo(returnTo) : authHomePath()} replace />
  }
  return <LoginPage />
}

export function AppRoutes() {
  React.useEffect(() => {
    api.initializeBrowserStorage()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Navigate to={api.getToken() ? authHomePath() : '/login'} replace />} />
      <Route path="/login" element={<LoginGate />} />
      <Route
        path="/request-access"
        element={api.getToken() ? <Navigate to={authHomePath()} replace /> : <LazyRoute component={RequestAccessPage} />}
      />
      <Route path="/register" element={<Navigate to="/request-access" replace />} />
      <Route path="/logout" element={<LogoutAndRedirect />} />
      <Route
        path="/workspaces"
        element={
          <RequireAuth>
            <LazyRoute component={WorkspaceSelectorPage} />
          </RequireAuth>
        }
      />
      <Route path="/r/:token" element={<LazyRoute component={PublicQuickRequestPage} />} />
      <Route path="/r/:token/success" element={<LazyRoute component={PublicQuickRequestSuccessPage} />} />

      <Route
        path="/m"
        element={
          <RequireAuth>
            <LazyRoute component={MobileShell} />
          </RequireAuth>
        }
      >
        <Route index element={<LazyRoute component={MobileHome} />} />
        <Route path="create" element={<LazyRoute component={MobileCreateTicket} />} />
        <Route path="my" element={<LazyRoute component={MobileMyTickets} />} />
        <Route path="profile" element={<LazyRoute component={MobileProfile} />} />
        <Route path="notifications" element={<LazyRoute component={MobileNotificationsPage} />} />
        <Route path="push-settings" element={<LazyRoute component={MobilePushSettingsPage} />} />
        <Route path="settings" element={<LazyRoute component={MobileSettingsPage} />} />
        <Route path="analytics" element={<LazyRoute component={MobileAnalytics} />} />
        <Route path="shift" element={<LazyRoute component={MobileShiftPage} />} />
        <Route path="workforce" element={<LazyRoute component={MobileWorkforcePage} />} />
        <Route path="chats" element={<LazyRoute component={MobileChatsPage} />} />
        <Route path="chats/:ticketId" element={<LazyRoute component={MobileChatsPage} />} />
        <Route path="tickets/:id" element={<LazyRoute component={MobileTicketPage} />} />
        <Route path="offline-queue" element={<LazyRoute component={MobileOfflineQueue} />} />
        <Route path="inspection" element={<LazyRoute component={MobileInspectionList} props={{ standalone: true }} />} />
        <Route path="inspection/:runId" element={<LazyRoute component={MobileInspectionRunPage} />} />
        <Route path="inspection/object/:locationId" element={<LazyRoute component={MobileInspectionList} />} />
      </Route>

      <Route
        path="/"
        element={
          <RequireAuth>
            <LazyRoute component={Shell} />
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<LazyRoute component={DashboardPage} />} />
        <Route path="board" element={<LazyRoute component={BoardPage} />} />
        <Route path="archive" element={<LazyRoute component={ArchivePage} />} />
        <Route path="tickets" element={<LazyRoute component={BoardPage} />} />
        <Route path="objects" element={<LazyRoute component={LocationsPage} />} />
        <Route path="equipment" element={<LazyRoute component={ManagementV2StubPage} />} />
        <Route path="users" element={<LazyRoute component={EmployeesPage} />} />
        <Route path="contractors" element={<LazyRoute component={ContractorsRoutePage} />} />
        <Route path="acts" element={<LazyRoute component={ManagementV2StubPage} />} />
        <Route path="permissions" element={<LazyRoute component={PermissionsPage} />} />
        <Route path="access-constructor" element={<LazyRoute component={AccessConstructorPage} />} />
        <Route path="assistant" element={<LazyRoute component={ManagementV2StubPage} />} />
        <Route path="companies" element={<LazyRoute component={CompaniesPage} />} />
        <Route path="service-contracts" element={<LazyRoute component={ServiceContractsPage} />} />
        <Route path="tickets/new" element={<LazyRoute component={CreateTicketPage} />} />
        <Route path="tickets/:id" element={<LazyRoute component={TicketPage} />} />
        <Route path="locations" element={<LazyRoute component={LocationsPage} />} />
        <Route path="employees" element={<LazyRoute component={EmployeesPage} />} />
        <Route path="specializations" element={<LazyRoute component={SpecializationsPage} />} />
        <Route path="analytics" element={<LazyRoute component={AnalyticsPage} />} />
        <Route path="workforce" element={<LazyRoute component={WorkforcePage} />} />
        <Route path="analytics/locations" element={<LazyRoute component={LocationAnalyticsPage} />} />
        <Route path="settings" element={<LazyRoute component={SettingsPage} />} />
        <Route path="company" element={<LazyRoute component={CompanyPage} />} />
        <Route path="platform/permissions" element={<LazyRoute component={PermissionsPage} />} />
        <Route path="platform/access-constructor" element={<LazyRoute component={AccessConstructorPage} />} />
        <Route path="technician" element={<LazyRoute component={TechnicianPage} />} />
        <Route path="map" element={<LazyRoute component={MapPage} />} />
        <Route path="problem-categories" element={<LazyRoute component={ProblemCategoriesPage} />} />
        <Route path="inspection/templates" element={<LazyRoute component={InspectionTemplatesPage} />} />
        <Route path="inspection/runs" element={<LazyRoute component={InspectionRunsPage} />} />
        <Route path="inspection/runs/:id" element={<LazyRoute component={InspectionRunPage} />} />
        <Route path="inspection/quick/:runId" element={<LazyRoute component={InspectionQuickPage} />} />
        <Route path="inspection/runs/:id/report" element={<LazyRoute component={InspectionRunReportPage} />} />
        <Route path="agents/engineering" element={<LazyRoute component={EngineeringAgentPage} />} />
        <Route path="it" element={<LazyRoute component={ITCompanyPage} />} />
        <Route path="it/employees" element={<LazyRoute component={AIEmployeesPage} />} />
        <Route path="it/employees/:slug" element={<LazyRoute component={AIEmployeeDetailsPage} />} />
        <Route path="it/mission-control" element={<LazyRoute component={MissionControlPage} />} />
        <Route path="it/ai-developer" element={<LazyRoute component={AIDeveloperPage} />} />
      </Route>

      <Route path="/max" element={<LazyRoute component={MaxApp} />}>
        <Route element={<LazyRoute component={MobileShell} />}>
          <Route index element={<LazyRoute component={MobileHome} />} />
          <Route path="create" element={<LazyRoute component={MobileCreateTicket} />} />
          <Route path="my" element={<LazyRoute component={MobileMyTickets} />} />
          <Route path="profile" element={<LazyRoute component={MobileProfile} />} />
          <Route path="notifications" element={<LazyRoute component={MobileNotificationsPage} />} />
          <Route path="push-settings" element={<LazyRoute component={MobilePushSettingsPage} />} />
          <Route path="settings" element={<LazyRoute component={MobileSettingsPage} />} />
          <Route path="analytics" element={<LazyRoute component={MobileAnalytics} />} />
          <Route path="shift" element={<LazyRoute component={MobileShiftPage} />} />
          <Route path="workforce" element={<LazyRoute component={MobileWorkforcePage} />} />
          <Route path="chats" element={<LazyRoute component={MobileChatsPage} />} />
          <Route path="chats/:ticketId" element={<LazyRoute component={MobileChatsPage} />} />
          <Route path="tickets/:id" element={<LazyRoute component={MobileTicketPage} />} />
          <Route path="offline-queue" element={<LazyRoute component={MobileOfflineQueue} />} />
          <Route path="inspection" element={<LazyRoute component={MobileInspectionList} props={{ standalone: true }} />} />
          <Route path="inspection/:runId" element={<LazyRoute component={MobileInspectionRunPage} />} />
          <Route path="inspection/object/:locationId" element={<LazyRoute component={MobileInspectionList} />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
