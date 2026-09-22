import React, { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as api from './lib/api'
import { offlineAwareLogout } from './lib/offlineSessionLogout'
import { isDynamicImportFailure, MOBILE_CHUNK_RECOVERY_MESSAGE } from './lib/lazyRouteFailure'
import { IT_COMPANY_ROUTES } from './it-company/routes'
import { LoginPage } from './views/LoginPage'
import { VhodPage } from './views/VhodPage'

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

function LazyRouteFailure({ error }: FallbackProps) {
  if (!isDynamicImportFailure(error)) throw error
  return (
    <div className="mobileSection" role="alert">
      <div className="mobileNotice mobileNoticeError">
        {MOBILE_CHUNK_RECOVERY_MESSAGE}
      </div>
      <button type="button" className="mobileBtn" onClick={() => window.location.reload()}>
        Повторить
      </button>
    </div>
  )
}

function LazyRoute<P extends object>({
  component: Comp,
  props,
}: {
  component: ComponentType<P>
  props?: P
}) {
  const location = useLocation()
  return (
    <ErrorBoundary FallbackComponent={LazyRouteFailure} resetKeys={[location.pathname, location.search]}>
      <Suspense fallback={<RouteFallback />}>
        <Comp {...((props ?? {}) as P)} />
      </Suspense>
    </ErrorBoundary>
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
// SMA-EQUIPMENT-V2-110A: /equipment больше не заглушка.
const EquipmentPage = lazyExport(() => import('./views/EquipmentPage'), 'EquipmentPage')
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
const InspectionSchedulesPage = lazyExport(() => import('./views/InspectionSchedulesPage'), 'InspectionSchedulesPage')
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
// SMA-EQUIPMENT-V2-110A: карточка оборудования на телефоне — только чтение.
const MobileEquipmentPage = lazyExport(() => import('./mobile/MobileEquipmentPage'), 'MobileEquipmentPage')
const MobileInspectionRunPage = lazyExport(() => import('./mobile/MobileInspectionRunPage'), 'MobileInspectionRunPage')
const MobileInspectionStartPage = lazyExport(() => import('./mobile/MobileInspectionStartPage'), 'MobileInspectionStartPage')
const MobileInspectionTodayPage = lazyExport(() => import('./mobile/MobileInspectionTodayPage'), 'MobileInspectionTodayPage')
const MobileShiftPage = lazyExport(() => import('./mobile/MobileShiftPage'), 'MobileShiftPage')
const MobileWorkforcePage = lazyExport(() => import('./mobile/MobileWorkforcePage'), 'MobileWorkforcePage')
const MaxApp = lazyExport(() => import('./max/MaxApp'), 'MaxApp')

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = api.getToken()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: Boolean(token) })

  /*
   * SMA-MOBILE-OFFLINE-INTEGRATION-113D — сверка с офлайн-режимом.
   *
   * Прежняя проверка считала недействительной сессией ЛЮБОЙ отказ `/auth/me` и стирала
   * токен. Для мобильного техника это разрушительно: `/m` обёрнут именно этой проверкой,
   * а первый запрос после возвращения в зону покрытия падает штатно — радио ещё не
   * поднялось. В этот момент приложение стирало токен у человека, у которого на
   * устройстве лежит неотправленная работа. Очередь после этого не уйдёт никогда:
   * отправлять её нечем, а предупреждение о потере работы показывает только осознанный
   * выход.
   *
   * Теперь на вход уводит лишь явный отказ сервера — 401/403. Замысел правки сохранён
   * полностью: недействительная сессия по-прежнему ведёт на вход. Не-авторизационный
   * отказ сессию не трогает, и приложение работает на сохранённых данных, как и
   * задумано офлайн-режимом. То же различие realtime уже делает: сокет сбрасывает
   * авторизацию на AUTH_INVALID и коде 1008, а не на любом обрыве.
   */
  const sessionRejected = api.isSessionRejected(meQ.error)

  React.useEffect(() => {
    if (!sessionRejected) return
    // 005: сессия отвергнута сервером, человек ничего не выбирал. Разбор
    // очереди останавливаем, базу не трогаем: удалять чужую работу без спроса
    // нельзя, а от отправки под другой личностью защищает сверка владельца
    // в координаторе.
    void offlineAwareLogout('session_lost')
    api.clearToken()
    queryClient.clear()
    navigate(api.loginPathWithReturnTo(`${location.pathname}${location.search}${location.hash}`), {
      replace: true,
    })
  }, [location.hash, location.pathname, location.search, sessionRejected, navigate, queryClient])

  if (!token) {
    return <Navigate to={api.loginPathWithReturnTo(`${location.pathname}${location.search}${location.hash}`)} replace />
  }

  /*
   * Заглушку показываем только при живой связи.
   *
   * Без сети `/auth/me` не ответит никогда: запрос уходит в повторы и висит,
   * а экран «Проверяем доступ…» держит техника снаружи его же сохранённой
   * работы — она в этот момент лежит на устройстве и ждёт отправки. Измерено
   * живой приёмкой на Stage: после перезагрузки в офлайне приложение не
   * поднималось вовсе.
   *
   * Рендерить оболочку без подтверждения безопасно: она ничего не решает
   * сама. Каждый запрос по-прежнему авторизует сервер, а явный отказ сессии
   * уводит на вход ветвью выше, когда ответ действительно придёт.
   */
  const connected = typeof navigator === 'undefined' ? true : navigator.onLine !== false

  if (sessionRejected || (meQ.isPending && connected)) {
    return <div className="page"><div className="muted">Проверяем доступ…</div></div>
  }

  return <>{children}</>
}

function RequireManagementAccess({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  React.useEffect(() => {
    if (!meQ.isError) return
    // 005: сессия отвергнута сервером, человек ничего не выбирал. Разбор
    // очереди останавливаем, базу не трогаем: удалять чужую работу без спроса
    // нельзя, а от отправки под другой личностью защищает сверка владельца
    // в координаторе.
    void offlineAwareLogout('session_lost')
    api.clearToken()
    queryClient.clear()
    navigate(api.loginPathWithReturnTo(`${location.pathname}${location.search}${location.hash}`), {
      replace: true,
    })
  }, [location.hash, location.pathname, location.search, meQ.isError, navigate, queryClient])

  if (meQ.isLoading || meQ.isError) {
    return <div className="page"><div className="muted">Проверяем доступ…</div></div>
  }

  if (!meQ.data) {
    return <Navigate to="/login" replace />
  }

  if (!meQ.data.canAccessManagementSurface) {
    return (
      <div className="page" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 48 }}>
        <div className="card">
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Управленческая часть недоступна</h1>
          <p className="muted">Для вашей роли доступна мобильная версия ServiceManager.</p>
          <a href="/m" style={{ display: 'inline-block', marginTop: 16 }}>Открыть мобильную версию</a>
        </div>
      </div>
    )
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

function LandingGate() {
  if (api.getToken()) {
    return <Navigate to={authHomePath()} replace />
  }
  return <VhodPage />
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
      typeof window !== 'undefined' ? api.getReturnToFromSearch(window.location.search) : ''
    const workspace =
      typeof window !== 'undefined' ? api.getWorkspaceFromSearch(window.location.search) : ''
    if (returnTo || workspace) {
      return <Navigate to={api.workspacePathWithReturnTo(returnTo, workspace)} replace />
    }
    return <Navigate to={authHomePath()} replace />
  }
  return <LoginPage />
}

export function AppRoutes() {
  React.useEffect(() => {
    api.initializeBrowserStorage()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<LandingGate />} />
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
        <Route path="inspection/today" element={<LazyRoute component={MobileInspectionTodayPage} />} />
        <Route path="inspection/start" element={<LazyRoute component={MobileInspectionStartPage} />} />
        <Route path="inspection/:runId" element={<LazyRoute component={MobileInspectionRunPage} />} />
        <Route path="inspection/object/:locationId" element={<LazyRoute component={MobileInspectionList} />} />
        <Route path="equipment" element={<LazyRoute component={MobileEquipmentPage} />} />
        <Route path="equipment/:id" element={<LazyRoute component={MobileEquipmentPage} />} />
      </Route>

      <Route
        path="/"
        element={
          <RequireAuth>
            <RequireManagementAccess>
              <LazyRoute component={Shell} />
            </RequireManagementAccess>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<LazyRoute component={DashboardPage} />} />
        <Route path="board" element={<LazyRoute component={BoardPage} />} />
        <Route path="archive" element={<LazyRoute component={ArchivePage} />} />
        <Route path="tickets" element={<LazyRoute component={BoardPage} />} />
        <Route path="objects" element={<LazyRoute component={LocationsPage} />} />
        <Route path="equipment" element={<LazyRoute component={EquipmentPage} />} />
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
        <Route path="inspection/schedules" element={<LazyRoute component={InspectionSchedulesPage} />} />
        <Route path="inspection/runs/:id" element={<LazyRoute component={InspectionRunPage} />} />
        <Route path="inspection/quick/:runId" element={<LazyRoute component={InspectionQuickPage} />} />
        <Route path="inspection/runs/:id/report" element={<LazyRoute component={InspectionRunReportPage} />} />
        <Route path="agents/engineering" element={<LazyRoute component={EngineeringAgentPage} />} />
        {IT_COMPANY_ROUTES.map(({ path, Component }) => (
          <Route key={path} path={path} element={<LazyRoute component={Component} />} />
        ))}
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
          <Route path="inspection/today" element={<LazyRoute component={MobileInspectionTodayPage} />} />
          <Route path="inspection/start" element={<LazyRoute component={MobileInspectionStartPage} />} />
          <Route path="inspection/:runId" element={<LazyRoute component={MobileInspectionRunPage} />} />
          <Route path="inspection/object/:locationId" element={<LazyRoute component={MobileInspectionList} />} />
        <Route path="equipment" element={<LazyRoute component={MobileEquipmentPage} />} />
        <Route path="equipment/:id" element={<LazyRoute component={MobileEquipmentPage} />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
