export type Role =
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
  role: Role
  companyId: string
}

export type LoginInput = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
}

export type RegisterInput = {
  companyName: string
  email: string
  password: string
}

export type UserListItem = {
  id: string
  email: string
  role: Role
  isActive?: boolean
  createdAt?: string
  companyId?: string
}

export type CreateUserInput = {
  email: string
  password: string
  role: Role
}

export type UpdateUserInput = {
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
  source: 'status_history' | 'domain_event'
  type: string
  title: string
  actor: { id: string; email: string } | null
  payload: any
}

export type TimelineResponse = {
  ticketId: string
  items: TimelineItem[]
  meta: { statusHistoryCount: number; domainEventCount: number }
}

export type CreateTicketInput = {
  problemText: string
  urgency: TicketUrgency
  problemCategoryId: string
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

export type CreateTicketResponse = any

export type UpdateTicketStatusInput = {
  status: TicketStatus
  comment?: string
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

function readBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000'
  return localStorage.getItem(BASE_URL_KEY) || 'http://localhost:3000'
}

function normalizeBaseUrl(url: string): string {
  return (url || 'http://localhost:3000').trim().replace(/\/+$/, '')
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
}

export function getCompanyLabel(me?: Partial<Me> | null): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(COMPANY_LABEL_KEY)
    if (saved && saved.trim()) return saved.trim()
  }

  if (!me) return 'Компания'
  if (me.email) return me.email
  return 'Компания'
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

export async function registerCompany(input: RegisterInput): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: {
      companyName: input.companyName,
      email: input.email,
      password: input.password,
    },
  })
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

export async function company(): Promise<CompanySettings> {
  return request<CompanySettings>('/company')
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

export async function board(): Promise<BoardResponse> {
  return request<BoardResponse>('/tickets/board')
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
  return request<TimelineResponse>(`/tickets/${id}/timeline`)
}

export async function timeline(id: string): Promise<TimelineResponse> {
  return ticketTimeline(id)
}

export async function timelineTicket(id: string): Promise<any> {
  return request<any>(`/timeline/tickets/${id}`)
}

export async function assignmentCandidates(id: string): Promise<AssignmentCandidatesResponse> {
  return request<AssignmentCandidatesResponse>(`/tickets/${id}/assignment-candidates`)
}

export async function getTicketAssignmentCandidates(id: string): Promise<AssignmentCandidatesResponse> {
  return assignmentCandidates(id)
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

export async function analyticsOverview(): Promise<AnalyticsOverviewResponse> {
  return request<AnalyticsOverviewResponse>('/analytics/overview')
}
