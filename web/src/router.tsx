import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import * as api from './lib/api'
import { Shell } from './ui/Shell'
import { LoginPage } from './views/LoginPage'
import { WorkspaceSelectorPage } from './views/WorkspaceSelectorPage'
import { RequestAccessPage } from './views/RequestAccessPage'
import { PublicQuickRequestPage } from './views/PublicQuickRequestPage'
import { PublicQuickRequestSuccessPage } from './views/PublicQuickRequestSuccessPage'
import { BoardPage } from './views/BoardPage'
import { ArchivePage } from './views/ArchivePage'
import { TicketPage } from './views/TicketPage'
import { CreateTicketPage } from './views/CreateTicketPage'
import { EmployeesPage } from './views/EmployeesPage'
import { LocationsPage } from './views/LocationsPage'
import { AnalyticsPage } from './views/AnalyticsPage'
import { LocationAnalyticsPage } from './views/LocationAnalyticsPage'
import { SettingsPage } from './views/SettingsPage'
import { ProblemCategoriesPage } from './views/ProblemCategoriesPage'
import { SpecializationsPage } from './views/SpecializationsPage'
import { CompanyPage } from './views/CompanyPage'
import { TechnicianPage } from './views/TechnicianPage'
import { CompaniesPage } from './views/CompaniesPage'
import { ServiceContractsPage } from './views/ServiceContractsPage'
import { InspectionTemplatesPage } from './views/InspectionTemplatesPage'
import { EngineeringAgentPage } from './views/EngineeringAgentPage'
import { IT_COMPANY_ROUTES } from './it-company'
import { DashboardPage } from './views/DashboardPage'
import { InspectionRunsPage } from './views/InspectionRunsPage'
import { InspectionRunPage } from './views/InspectionRunPage'
import { InspectionRunReportPage } from './views/InspectionRunReportPage'
import { InspectionQuickPage } from './views/InspectionQuickPage'
import { MapPage } from './pages/MapPage'
import { AccessConstructorPage } from './pages/platform/AccessConstructorPage'
import { PermissionsPage } from './pages/platform/PermissionsPage'
import { ManagementV2StubPage } from './views/v2/ManagementV2StubPage'
import { ContractorsRoutePage } from './views/v2/ContractorsRoutePage'
import { MobileShell } from './mobile/MobileShell'
import { MobileHome } from './mobile/MobileHome'
import { MobileCreateTicket } from './mobile/MobileCreateTicket'
import { MobileMyTickets } from './mobile/MobileMyTickets'
import { MobileProfile } from './mobile/MobileProfile'
import { MobileTicketPage } from './mobile/MobileTicketPage'
import { MobileNotificationsPage } from './mobile/MobileNotificationsPage'
import { MobileAnalytics } from './mobile/MobileAnalytics'
import { MobileChatsPage } from './mobile/MobileChatsPage'
import { MobileOfflineQueue } from './mobile/MobileOfflineQueue'
import { MobileInspectionList } from './mobile/MobileInspectionList'
import { MobileInspectionRunPage } from './mobile/MobileInspectionRunPage'
import { MaxApp } from './max/MaxApp'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = api.getToken()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Сброс клиентской сессии (QA, смена аккаунта). Без запроса к API. */
function LogoutAndRedirect() {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.clear()
    } catch {
      /* noop */
    }
    try {
      localStorage.clear()
    } catch {
      /* noop */
    }
  }
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
      try {
        sessionStorage.clear()
      } catch {
        /* noop */
      }
      try {
        localStorage.clear()
      } catch {
        /* noop */
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('clear')
      const qs = url.searchParams.toString()
      window.history.replaceState({}, '', `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`)
    }
  }
  if (api.getToken()) return <Navigate to={authHomePath()} replace />
  return <LoginPage />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={api.getToken() ? authHomePath() : '/login'} replace />} />
      <Route path="/login" element={<LoginGate />} />
      <Route path="/request-access" element={api.getToken() ? <Navigate to={authHomePath()} replace /> : <RequestAccessPage />} />
      <Route path="/register" element={<Navigate to="/request-access" replace />} />
      <Route path="/logout" element={<LogoutAndRedirect />} />
      <Route
        path="/workspaces"
        element={
          <RequireAuth>
            <WorkspaceSelectorPage />
          </RequireAuth>
        }
      />
      <Route path="/r/:token" element={<PublicQuickRequestPage />} />
      <Route path="/r/:token/success" element={<PublicQuickRequestSuccessPage />} />

      <Route
        path="/m"
        element={
          <RequireAuth>
            <MobileShell />
          </RequireAuth>
        }
      >
        <Route index element={<MobileHome />} />
        <Route path="create" element={<MobileCreateTicket />} />
        <Route path="my" element={<MobileMyTickets />} />
        <Route path="profile" element={<MobileProfile />} />
        <Route path="notifications" element={<MobileNotificationsPage />} />
        <Route path="analytics" element={<MobileAnalytics />} />
        <Route path="chats" element={<MobileChatsPage />} />
        <Route path="chats/:ticketId" element={<MobileChatsPage />} />
        <Route path="tickets/:id" element={<MobileTicketPage />} />
        <Route path="offline-queue" element={<MobileOfflineQueue />} />
        <Route path="inspection" element={<MobileInspectionList standalone />} />
        <Route path="inspection/:runId" element={<MobileInspectionRunPage />} />
        <Route path="inspection/object/:locationId" element={<MobileInspectionList />} />
      </Route>

      <Route
        path="/"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="board" element={<BoardPage />} />
        <Route path="archive" element={<ArchivePage />} />
        <Route path="tickets" element={<BoardPage />} />
        <Route path="objects" element={<LocationsPage />} />
        <Route path="equipment" element={<ManagementV2StubPage />} />
        <Route path="users" element={<EmployeesPage />} />
        <Route path="contractors" element={<ContractorsRoutePage />} />
        <Route path="acts" element={<ManagementV2StubPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="access-constructor" element={<AccessConstructorPage />} />
        <Route path="assistant" element={<ManagementV2StubPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="service-contracts" element={<ServiceContractsPage />} />
        <Route path="tickets/new" element={<CreateTicketPage />} />
        <Route path="tickets/:id" element={<TicketPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="specializations" element={<SpecializationsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="analytics/locations" element={<LocationAnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="company" element={<CompanyPage />} />
        <Route path="platform/permissions" element={<PermissionsPage />} />
        <Route path="platform/access-constructor" element={<AccessConstructorPage />} />
        <Route path="technician" element={<TechnicianPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="problem-categories" element={<ProblemCategoriesPage />} />
        <Route path="inspection/templates" element={<InspectionTemplatesPage />} />
        <Route path="inspection/runs" element={<InspectionRunsPage />} />
        <Route path="inspection/runs/:id" element={<InspectionRunPage />} />
        <Route path="inspection/quick/:runId" element={<InspectionQuickPage />} />
        <Route path="inspection/runs/:id/report" element={<InspectionRunReportPage />} />
        <Route path="agents/engineering" element={<EngineeringAgentPage />} />
        {IT_COMPANY_ROUTES.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
      </Route>

      <Route path="/max" element={<MaxApp />}>
        <Route element={<MobileShell />}>
          <Route index element={<MobileHome />} />
          <Route path="create" element={<MobileCreateTicket />} />
          <Route path="my" element={<MobileMyTickets />} />
          <Route path="profile" element={<MobileProfile />} />
          <Route path="notifications" element={<MobileNotificationsPage />} />
          <Route path="analytics" element={<MobileAnalytics />} />
          <Route path="chats" element={<MobileChatsPage />} />
          <Route path="chats/:ticketId" element={<MobileChatsPage />} />
          <Route path="tickets/:id" element={<MobileTicketPage />} />
          <Route path="offline-queue" element={<MobileOfflineQueue />} />
          <Route path="inspection" element={<MobileInspectionList standalone />} />
          <Route path="inspection/:runId" element={<MobileInspectionRunPage />} />
        <Route path="inspection/object/:locationId" element={<MobileInspectionList />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
