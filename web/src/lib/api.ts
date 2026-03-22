export type Role =
  | 'PLATFORM_ADMIN'
  | 'ADMIN'
  | 'DISPATCHER'
  | 'MASTER'
  | 'TECHNICIAN'
  | 'CLIENT'
  | 'TERRITORIAL_MANAGER'
  | 'NETWORK_DIRECTOR'
  | 'STAFF'

export type TicketStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'
export type TicketUrgency = 'URGENT' | 'NOT_URGENT'

export type Me = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  role: Role
  companyId: string
  companyName?: string | null
  isActive?: boolean
}

export type LoginInput = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  user: Me
}

export type RegisterInput = {
  companyName: string
  firstName: string
  lastName: string
  email: string
  password: string
}

export type CompanyType = 'CLIENT' | 'PROVIDER'

export type PlatformCompanyItem = {
  id: string
  name: string
  type: CompanyType
  timezone?: string | null
  autoAssignEnabled: boolean
  allowTechnicianClaim: boolean
  slaStrictMode: boolean
  createdAt: string
  updatedAt: string
  admins: Array<{
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
    avatarUrl?: string | null
    role: Role
    isActive?: boolean
    createdAt?: string
  }>
}

export type CreateCompanyInput = {
  name: string
  type: CompanyType
  timezone?: string
}

export type CreateCompanyAdminInput = {
  firstName: string
  lastName: string
  email: string
  password: string
}

export type UserListItem = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  role: Role
  isActive?: boolean
  createdAt?: string
  companyId?: string
  technicianSpecializations?: Array<{
    specialization: {
      id: string
      name: string
      isActive?: boolean
    }
  }>
}

export type LocationListItem = {
  id: string
  clientCompanyId?: string
  name: string
  city?: string | null
  region?: string | null
  address?: string | null
  platformCode?: string | null
  externalCode?: string | null
  latitude?: number | null
  longitude?: number | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export type CreateLocationInput = {
  name: string
  city?: string
  address?: string
  platformCode: string
  externalCode?: string
  latitude?: number
  longitude?: number
  isActive?: boolean
}

export type UpdateLocationInput = {
  name?: string
  city?: string | null
  address?: string | null
  platformCode?: string
  externalCode?: string | null
  latitude?: number | null
  longitude?: number | null
  isActive?: boolean
}

export type CreateUserInput = {
  firstName?: string
  lastName?: string
  avatarUrl?: string
  email: string
  password: string
  role: Role
}

export type UpdateUserInput = {
  firstName?: string
  lastName?: string
  avatarUrl?: string
  email?: string
  password?: string
  role?: Role
  isActive?: boolean
}

export type ProblemCategoryCoverageTechnician = {
  id: string
  email: string
  matchedSpecializations: Array<{
    id: string
    name: string
    isActive?: boolean
  }>
}

export type ProblemCategoryCoverage = {
  status: 'covered' | 'no_technicians' | 'no_specializations'
  techniciansCount: number
  technicians: ProblemCategoryCoverageTechnician[]
}

export type ProblemCategoryListItem = {
  id: string
  name: string
  instructions?: string | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  specializationLinks?: Array<{
    specializationId: string
    specialization: {
      id: string
      name: string
      isActive?: boolean
    }
  }>
  coverage?: ProblemCategoryCoverage
}

export type CreateProblemCategoryInput = {
  name: string
  instructions?: string | null
  isActive?: boolean
}

export type UpdateProblemCategoryInput = {
  name?: string
  instructions?: string | null
  isActive?: boolean
}

export type SpecializationListItem = {
  id: string
  name: string
  isActive?: boolean
  createdAt?: string
}

export type CreateSpecializationInput = {
  name: string
  isActive?: boolean
}

export type UpdateSpecializationInput = {
  name?: string
  isActive?: boolean
}

export type TechnicianItem = {
  id: string
  email: string
  role: Role
  isActive?: boolean
  createdAt?: string
  technicianSpecializations?: Array<{
    specialization: {
      id: string
      name: string
      isActive?: boolean
    }
  }>
}

export type TechnicianWorkloadItem = {
  technicianId: string
  email: string
  assignedCount: number
  inProgressCount: number
  activeLoad: number
  specializations: Array<{
    id: string
    name: string
    isActive?: boolean
  }>
  tickets: Array<{
    id: string
    status: TicketStatus
    urgency: TicketUrgency
    slaDueAt: string | null
    category: {
      id: string
      name: string
    }
  }>
}

export type AssignmentCandidateTechnician = {
  id: string
  email: string
  matched: boolean
  matchedBy: string[]
  assignedCount?: number
  inProgressCount?: number
  activeLoad?: number
  specializations: Array<{
    id: string
    name: string
    isActive?: boolean
  }>
}

export type AssignmentCandidatesResponse = {
  ticketId: string
  category: {
    id: string
    name: string
  }
  currentAssigneeId: string | null
  requiredSpecializations: Array<{
    id: string
    name: string
    isActive?: boolean
  }>
  matched: AssignmentCandidateTechnician[]
  others: AssignmentCandidateTechnician[]
}

export type TicketAttachmentItem = {
  id: string
  ticketId?: string | null
  originalName: string
  mimeType: string
  sizeBytes: number
  url: string
  createdAt: string
  uploadedBy?: { id: string; email: string } | null
}

export type TicketCard = {
  id: string
  title: string
  status: TicketStatus
  urgency: TicketUrgency
  createdAt: string
  slaDueAt: string | null
  slaBreached: boolean
  isChild: boolean
  category: { id: string; name: string }
  assignedTechnician: { id: string; email: string } | null
}

export type BoardResponse = {
  columns: Array<{
    status: TicketStatus
    total: number
    sla: { breached: number; atRisk: number }
    cards: TicketCard[]
  }>
  meta: { totalTickets: number; atRiskThresholdMinutes: number; limitedToLast: number }
}

export type TicketGetOne = {
  id: string
  title?: string
  description?: string
  status: TicketStatus
  urgency: TicketUrgency
  createdAt: string
  updatedAt: string
  requesterName: string | null
  requesterPhone: string | null
  address: string | null
  pointName: string | null
  problemText: string
  slaMinutes: number | null
  slaDueAt: string | null
  slaBreachedAt: string | null
  assignedTechnicianId: string | null
  problemCategory: { id: string; name: string; instructions: string | null }
  assignedTechnician: { id: string; email: string } | null
}

export type TimelineItem = {
  at: string
  source: 'history' | 'event' | 'status_history' | 'domain_event'
  timelineEvent?: string | null
  domainType?: string
  type?: string
  title: string
  actor: { id: string; email: string } | null
  payload: any
}

export type TimelineResponse = {
  ticketId: string
  timeline?: TimelineItem[]
  history?: any[]
  events?: any[]
  items?: TimelineItem[]
  meta: {
    statusHistoryCount?: number
    domainEventCount?: number
    historyCount?: number
    eventCount?: number
  }
}

export type CreateTicketInput = {
  locationId: string
  categoryId: string
  urgency?: TicketUrgency
  title?: string | null
  description?: string | null
  attachmentIds?: string[]
  requesterName?: string | null
  requesterPhone?: string | null
  address?: string | null
  pointName?: string | null
  slaMinutes?: number | null
}

export type UpdateTicketInput = {
  problemCategoryId?: string
  problemText?: string
  urgency?: TicketUrgency
  requesterName?: string | null
  requesterPhone?: string | null
  address?: string | null
  pointName?: string | null
}

export type CreateTicketResponse = {
  ticket: {
    id: string
    title?: string
    description?: string
  }
  generated?: {
    title: string
    description: string
    possibleCauses?: string[]
    recommendedActions?: string[]
  }
  autoAssigned?: boolean
}

export type DraftTicketAttachment = TicketAttachmentItem

export type UpdateTicketStatusInput = {
  status: TicketStatus
  comment?: string
}

export type MapDominantStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'NONE'

export type MapLocationItem = {
  locationId: string
  name: string
  address?: string | null
  latitude: number
  longitude: number
  ticketsToday: number
  newCount: number
  inProgressCount: number
  doneCount: number
  dominantStatus: MapDominantStatus
}

export type MapLocationDetail = {
  locationId: string
  name: string
  address?: string | null
  latitude: number | null
  longitude: number | null
  summary: {
    total: number
    newCount: number
    inProgressCount: number
    doneCount: number
  }
  recentTickets: Array<{
    id: string
    title: string
    status: TicketStatus
    createdAt: string
  }>
}

export type AnalyticsOverviewResponse = {
  createdCount: number
  openByStatus: {
    NEW: number
    ASSIGNED: number
    IN_PROGRESS: number
  }
  sla: {
    breachedCount: number
    evaluatedCount?: number
    okPercent?: number
    breachedPercent?: number
  }
  timing: {
    evaluatedTickets: number
    meanTimeToAssignMinutes: number
    meanTimeToResolveMinutes: number
    note?: string
  }
  throughputByTechnician: Array<{
    technicianId: string
    technicianEmail?: string
    doneCount: number
  }>
  workloadByTechnician?: Array<{
    technicianId: string
    technicianEmail?: string
    assignedCount: number
    inProgressCount: number
    activeCount: number
  }>
  summary?: {
    backlogOpenTotal: number
    unassignedOpenTickets: number
  }
  note?: string
  now: string
}

export type CompanySettings = {
  id: string
  name: string
  autoAssignEnabled: boolean
  timezone: string
  allowTechnicianClaim: boolean
  slaStrictMode: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateCompanyInput = {
  name?: string
  autoAssignEnabled?: boolean
  timezone?: string
  allowTechnicianClaim?: boolean
  slaStrictMode?: boolean
}

const BASE_URL_KEY = 'sm_base_url'
const TOKEN_KEY = 'sm_token'
const COMPANY_LABEL_KEY = 'sm_company_label'
const USER_ROLE_KEY = 'sm_user_role'

function readBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3001'
  return localStorage.getItem(BASE_URL_KEY) || 'http://localhost:3001'
}

function normalizeBaseUrl(url: string): string {
  return (url || 'http://localhost:3001').trim().replace(/\/+$/, '')
}

export function getBaseUrl(): string {
  return normalizeBaseUrl(readBaseUrl())
}

export function setBaseUrl(url: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(BASE_URL_KEY, normalizeBaseUrl(url))
}

export function getToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_ROLE_KEY)
}

export function getUserRole(): Role | '' {
  if (typeof window === 'undefined') return ''
  return (localStorage.getItem(USER_ROLE_KEY) || '') as Role | ''
}

export function setUserRole(role?: string | null) {
  if (typeof window === 'undefined') return
  const normalized = (role || '').trim()
  if (!normalized) {
    localStorage.removeItem(USER_ROLE_KEY)
    return
  }
  localStorage.setItem(USER_ROLE_KEY, normalized)
}

export function getHomeRoute(role?: string | null): string {
  const resolvedRole = (role || getUserRole() || '').trim()
  return resolvedRole === 'PLATFORM_ADMIN' ? '/companies' : '/board'
}

export function getCompanyLabel(me?: Partial<Me> | null): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(COMPANY_LABEL_KEY)
    if (saved && saved.trim()) return saved.trim()
  }

  if (!me) return 'Company'
  if (me.companyName) return me.companyName
  if (me.email) return me.email
  return 'Company'
}

export function setCompanyLabel(label: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(COMPANY_LABEL_KEY, (label || '').trim())
}

export function extractCreatedTicketId(payload: any): string | null {
  if (!payload) return null
  if (typeof payload.id === 'string' && payload.id) return payload.id
  if (typeof payload.ticketId === 'string' && payload.ticketId) return payload.ticketId
  if (typeof payload.ticket?.id === 'string' && payload.ticket.id) return payload.ticket.id
  if (typeof payload.data?.id === 'string' && payload.data.id) return payload.data.id
  return null
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  auth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  if (options.auth !== false) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const text = await res.text()
  let data: any = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(',')
        : String(data.message)
      : `HTTP ${res.status}`

    throw new Error(message)
  }

  return data as T
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: {
      email: input.email,
      password: input.password,
    },
  })
}

export async function register(input: RegisterInput): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: {
      companyName: input.companyName,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: input.password,
    },
  })
}

export async function registerCompany(input: RegisterInput): Promise<LoginResponse> {
  return register(input)
}

export async function me(): Promise<Me> {
  return request<Me>('/auth/me')
}

export async function users(): Promise<UserListItem[]> {
  return request<UserListItem[]>('/users')
}

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  return request<UserListItem>('/users', {
    method: 'POST',
    body: input,
  })
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<UserListItem> {
  return request<UserListItem>(`/users/${userId}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function deactivateUser(userId: string): Promise<UserListItem> {
  return request<UserListItem>(`/users/${userId}/deactivate`, {
    method: 'PATCH',
  })
}

export async function activateUser(userId: string): Promise<UserListItem> {
  return request<UserListItem>(`/users/${userId}/activate`, {
    method: 'PATCH',
  })
}

export async function updateUserSpecializations(
  userId: string,
  specializationIds: string[],
): Promise<UserListItem> {
  return request<UserListItem>(`/users/${userId}/specializations`, {
    method: 'PUT',
    body: { specializationIds },
  })
}

export async function specializations(): Promise<SpecializationListItem[]> {
  return request<SpecializationListItem[]>('/specializations')
}

export async function createSpecialization(input: CreateSpecializationInput): Promise<SpecializationListItem> {
  return request<SpecializationListItem>('/specializations', {
    method: 'POST',
    body: input,
  })
}

export async function updateSpecialization(id: string, input: UpdateSpecializationInput): Promise<SpecializationListItem> {
  return request<SpecializationListItem>(`/specializations/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function setSpecializationStatus(id: string, isActive: boolean): Promise<SpecializationListItem> {
  return request<SpecializationListItem>(`/specializations/${id}/status`, {
    method: 'PATCH',
    body: { isActive },
  })
}

export async function problemCategories(): Promise<ProblemCategoryListItem[]> {
  return request<ProblemCategoryListItem[]>('/problem-categories')
}

export async function createProblemCategory(input: CreateProblemCategoryInput): Promise<ProblemCategoryListItem> {
  return request<ProblemCategoryListItem>('/problem-categories', {
    method: 'POST',
    body: input,
  })
}

export async function updateProblemCategory(id: string, input: UpdateProblemCategoryInput): Promise<ProblemCategoryListItem> {
  return request<ProblemCategoryListItem>(`/problem-categories/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function setProblemCategoryStatus(id: string, isActive: boolean): Promise<ProblemCategoryListItem> {
  return request<ProblemCategoryListItem>(`/problem-categories/${id}/status`, {
    method: 'PATCH',
    body: { isActive },
  })
}

export async function setProblemCategorySpecializations(
  categoryId: string,
  specializationIds: string[],
): Promise<ProblemCategoryListItem> {
  return request<ProblemCategoryListItem>(`/problem-categories/${categoryId}/specializations`, {
    method: 'PUT',
    body: { specializationIds },
  })
}

export async function technicians(): Promise<TechnicianItem[]> {
  return request<TechnicianItem[]>('/technicians')
}

export async function technicianMe(): Promise<TechnicianItem> {
  return request<TechnicianItem>('/technicians/me')
}

export async function techniciansWorkload(): Promise<TechnicianWorkloadItem[]> {
  return request<TechnicianWorkloadItem[]>('/technicians/workload')
}

export async function setTechnicianSpecializations(
  technicianId: string,
  specializationIds: string[],
): Promise<TechnicianItem> {
  return request<TechnicianItem>(`/technicians/${technicianId}/specializations`, {
    method: 'PUT',
    body: { specializationIds },
  })
}

export async function companies(): Promise<PlatformCompanyItem[]> {
  return request<PlatformCompanyItem[]>('/companies')
}

export async function createCompany(input: CreateCompanyInput): Promise<PlatformCompanyItem> {
  return request<PlatformCompanyItem>('/companies', {
    method: 'POST',
    body: input,
  })
}

export async function createCompanyAdmin(companyId: string, input: CreateCompanyAdminInput): Promise<UserListItem> {
  return request<UserListItem>(
    "/companies/" + companyId + "/admins",
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function company(): Promise<CompanySettings> {
  return request<CompanySettings>('/company')
}

export async function locations(): Promise<LocationListItem[]> {
  return request<LocationListItem[]>('/locations')
}

export async function createLocation(input: CreateLocationInput): Promise<LocationListItem> {
  return request<LocationListItem>('/locations', {
    method: 'POST',
    body: input,
  })
}

export async function updateLocation(id: string, input: UpdateLocationInput): Promise<LocationListItem> {
  return request<LocationListItem>(`/locations/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function setLocationStatus(id: string, isActive: boolean): Promise<LocationListItem> {
  return request<LocationListItem>(`/locations/${id}/status`, {
    method: 'PATCH',
    body: { isActive },
  })
}

export async function updateCompany(input: UpdateCompanyInput): Promise<CompanySettings> {
  return request<CompanySettings>('/company', {
    method: 'PATCH',
    body: input,
  })
}

export async function updateCompanyAutoAssign(autoAssignEnabled: boolean): Promise<CompanySettings> {
  return request<CompanySettings>('/company/auto-assign', {
    method: 'PATCH',
    body: { enabled: autoAssignEnabled },
  })
}

export async function board(params?: { take?: number }): Promise<BoardResponse> {
  const search = new URLSearchParams()

  if (params?.take) {
    search.set('take', String(params.take))
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<BoardResponse>(`/tickets/board${suffix}`)
}

export async function tickets(): Promise<any[]> {
  return request<any[]>('/tickets')
}

export async function availableTickets(): Promise<any[]> {
  return request<any[]>('/tickets/available')
}

export async function ticket(id: string): Promise<TicketGetOne> {
  return request<TicketGetOne>(`/tickets/${id}`)
}

export async function getTicket(id: string): Promise<TicketGetOne> {
  return ticket(id)
}

export async function ticketTimeline(id: string): Promise<TimelineResponse> {
  return request<TimelineResponse>(`/timeline/tickets/${id}`)
}

export async function timeline(id: string): Promise<TimelineResponse> {
  return ticketTimeline(id)
}

export async function timelineTicket(id: string): Promise<TimelineResponse> {
  return ticketTimeline(id)
}

export async function assignmentCandidates(id: string): Promise<AssignmentCandidatesResponse> {
  return request<AssignmentCandidatesResponse>(`/tickets/${id}/assignment-candidates`)
}

export async function getTicketAssignmentCandidates(id: string): Promise<AssignmentCandidatesResponse> {
  return assignmentCandidates(id)
}

export async function uploadDraftTicketAttachment(file: File): Promise<DraftTicketAttachment> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${getBaseUrl()}/tickets/attachments/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })

  const text = await res.text()
  let data: any = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(',')
        : String(data.message)
      : `HTTP ${res.status}`

    throw new Error(message)
  }

  return data as DraftTicketAttachment
}

export async function deleteDraftTicketAttachment(attachmentId: string): Promise<any> {
  return request<any>(`/tickets/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
}

export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResponse> {
  return request<CreateTicketResponse>('/tickets', {
    method: 'POST',
    body: input,
  })
}

export async function createChildTicket(parentId: string, input: CreateTicketInput): Promise<CreateTicketResponse> {
  return request<CreateTicketResponse>(`/tickets/${parentId}/child`, {
    method: 'POST',
    body: input,
  })
}

export async function updateTicket(id: string, input: UpdateTicketInput): Promise<any> {
  return request<any>(`/tickets/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function changeTicketCategory(id: string, problemCategoryId: string): Promise<any> {
  return request<any>(`/tickets/${id}/category`, {
    method: 'PATCH',
    body: { problemCategoryId },
  })
}

export async function assignTicket(id: string, technicianId: string): Promise<any> {
  return request<any>(`/tickets/${id}/assign/${technicianId}`, {
    method: 'PUT',
  })
}

export async function claimTicket(id: string): Promise<any> {
  return request<any>(`/tickets/${id}/claim`, {
    method: 'POST',
  })
}

export async function claim(id: string): Promise<any> {
  return claimTicket(id)
}

export async function updateTicketStatus(id: string, input: UpdateTicketStatusInput): Promise<any> {
  return request<any>(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: input,
  })
}

export async function ticketAttachments(id: string): Promise<TicketAttachmentItem[]> {
  return request<TicketAttachmentItem[]>(`/tickets/${id}/attachments`)
}

export async function uploadTicketAttachment(id: string, file: File): Promise<any> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${getBaseUrl()}/tickets/${id}/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })

  const text = await res.text()
  let data: any = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(',')
        : String(data.message)
      : `HTTP ${res.status}`

    throw new Error(message)
  }

  return data
}

export async function deleteTicketAttachment(id: string, attachmentId: string): Promise<any> {
  return request<any>(`/tickets/${id}/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
}

export async function mapLocations(): Promise<MapLocationItem[]> {
  return request<MapLocationItem[]>('/map/locations')
}

export async function mapLocation(locationId: string): Promise<MapLocationDetail> {
  return request<MapLocationDetail>(`/map/locations/${locationId}`)
}

export async function analyticsOverview(): Promise<AnalyticsOverviewResponse> {
  return request<AnalyticsOverviewResponse>('/analytics/overview')
}

export function resolveFileUrl(url: string): string {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${getBaseUrl()}${url}`
  return `${getBaseUrl()}/${url}`
}
