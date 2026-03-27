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


export type CompanyType = 'CLIENT' | 'PROVIDER'

export type PublicRequestDefaultType = 'REPAIR' | 'NOTE'
export type PublicRequestLocationPresetMode = 'HIDE_WHEN_VALID' | 'ALWAYS_OPTIONAL'
export type ServiceContractStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ENDED'
export type ServiceContractRole = 'PRIMARY' | 'SECONDARY'

export type ServiceContractItem = {
  id: string
  status: ServiceContractStatus
  role: ServiceContractRole
  startsAt?: string | null
  endsAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  clientCompany: {
    id: string
    name: string
    type: CompanyType
  }
  providerCompany: {
    id: string
    name: string
    type: CompanyType
  }
}

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
  publicRequestEnabled: boolean
  publicRequestToken?: string | null
  publicRequestIntro?: string | null
  publicRequestAllowPhotos: boolean
  publicRequestMaxPhotos: number
  publicRequestRequirePhone: boolean
  publicRequestDefaultType?: PublicRequestDefaultType | null
  publicRequestRateLimitEnabled: boolean
  publicRequestLocationPresetMode?: string | null
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

export type LinkedClientSummary = ServiceContractItem & {
  summary: {
    openTickets: number
    locations: number
    publicRequestEnabled: boolean
  }
}

export type BoardResponse = {
  columns: Array<{
    status: TicketStatus
    total: number
    sla: { breached: number; atRisk: number }
    cards: TicketCard[]
  }>
  meta: {
    totalTickets: number
    atRiskThresholdMinutes: number
    limitedToLast: number
    scopeCompanyId?: string
    visibilityMode?: 'tenant' | 'provider_primary'
  }
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
  bySource?: {
    INTERNAL: number
    PUBLIC_QUICK_REQUEST: number
  }
  publicIntake?: {
    total: number
    resolved: number
    resolvedPercent: number
    byType: {
      REPAIR: number
      NOTE: number
    }
    byDay: Array<{ day: string; total: number }>
    byLocation: Array<{
      locationId: string
      locationName: string
      city?: string | null
      total: number
      repairCount: number
      noteCount: number
      resolvedCount: number
    }>
    byEquipment: Array<{
      equipmentId: string
      name: string
      type: string
      total: number
    }>
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
  meta?: {
    scopeCompanyId?: string
    visibilityMode?: 'tenant' | 'provider_primary'
  }
}

export type CompanySettings = {
  id: string
  name: string
  type?: CompanyType
  autoAssignEnabled: boolean
  timezone: string
  allowTechnicianClaim: boolean
  slaStrictMode: boolean
  createdAt: string
  updatedAt: string
  publicRequestEnabled: boolean
  publicRequestToken?: string | null
  publicRequestIntro?: string | null
  publicRequestAllowPhotos: boolean
  publicRequestMaxPhotos: number
  publicRequestRequirePhone: boolean
  publicRequestDefaultType?: PublicRequestDefaultType | null
  publicRequestRateLimitEnabled: boolean
  publicRequestLocationPresetMode?: string | null
  clientContracts?: Array<{
    id: string
    status: ServiceContractStatus
    role: ServiceContractRole
    startsAt?: string | null
    endsAt?: string | null
    notes?: string | null
    updatedAt: string
    providerCompany: {
      id: string
      name: string
      type: CompanyType
    }
  }>
  providerContracts?: Array<{
    id: string
    status: ServiceContractStatus
    role: ServiceContractRole
    startsAt?: string | null
    endsAt?: string | null
    notes?: string | null
    updatedAt: string
    clientCompany: {
      id: string
      name: string
      type: CompanyType
    }
  }>
}

export type UpdateCompanyInput = {
  name?: string
  autoAssignEnabled?: boolean
  timezone?: string
  allowTechnicianClaim?: boolean
  slaStrictMode?: boolean
  publicRequestEnabled?: boolean
  publicRequestIntro?: string | null
  publicRequestAllowPhotos?: boolean
  publicRequestMaxPhotos?: number
  publicRequestRequirePhone?: boolean
  publicRequestDefaultType?: PublicRequestDefaultType | null
  publicRequestRateLimitEnabled?: boolean
  publicRequestLocationPresetMode?: string | null
}

export type CreateServiceContractInput = {
  clientCompanyId: string
  providerCompanyId: string
  status?: ServiceContractStatus
  role?: ServiceContractRole
  startsAt?: string
  endsAt?: string
  notes?: string
}

export type UpdateServiceContractInput = {
  status?: ServiceContractStatus
  role?: ServiceContractRole
  startsAt?: string | null
  endsAt?: string | null
  notes?: string | null
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

export function getPublicAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'http://localhost:4173'
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

export async function regeneratePlatformCompanyPublicRequestToken(companyId: string): Promise<PlatformCompanyItem> {
  return request<PlatformCompanyItem>("/companies/" + companyId + "/public-request/token", {
    method: 'PATCH',
  })
}

export async function company(): Promise<CompanySettings> {
  return request<CompanySettings>('/company')
}

export async function linkedClients(): Promise<LinkedClientSummary[]> {
  return request<LinkedClientSummary[]>('/service-contracts/linked-clients')
}

export async function getLinkedClients(): Promise<LinkedClientSummary[]> {
  return linkedClients()
}

export async function linkedProviders(): Promise<ServiceContractItem[]> {
  return request<ServiceContractItem[]>('/service-contracts/linked-providers')
}

export async function serviceContracts(): Promise<ServiceContractItem[]> {
  return request<ServiceContractItem[]>('/service-contracts')
}

export async function serviceContract(id: string): Promise<ServiceContractItem> {
  return request<ServiceContractItem>('/service-contracts/' + id)
}

export async function createServiceContract(input: CreateServiceContractInput): Promise<ServiceContractItem> {
  return request<ServiceContractItem>('/service-contracts', {
    method: 'POST',
    body: input,
  })
}

export async function updateServiceContract(id: string, input: UpdateServiceContractInput): Promise<ServiceContractItem> {
  return request<ServiceContractItem>('/service-contracts/' + id, {
    method: 'PATCH',
    body: input,
  })
}

export async function companyServiceContracts(companyId: string): Promise<ServiceContractItem[]> {
  return request<ServiceContractItem[]>('/companies/' + companyId + '/service-contracts')
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

export async function regenerateCompanyPublicRequestToken(): Promise<CompanySettings> {
  return request<CompanySettings>('/company/public-request/token', {
    method: 'PATCH',
  })
}

export function buildPublicRequestLink(token?: string | null, locationId?: string | null): string {
  if (!token) return ''
  const url = new URL('/r/' + token, getPublicAppBaseUrl())
  if (locationId) url.searchParams.set('locationId', locationId)
  return url.toString()
}

export async function board(params?: { take?: number; linkedClientCompanyId?: string }): Promise<BoardResponse> {
  const search = new URLSearchParams()

  if (params?.take) {
    search.set('take', String(params.take))
  }
  if (params?.linkedClientCompanyId) {
    search.set('linkedClientCompanyId', params.linkedClientCompanyId)
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

export async function analyticsOverview(linkedClientCompanyId?: string): Promise<AnalyticsOverviewResponse> {
  const search = new URLSearchParams()
  if (linkedClientCompanyId) {
    search.set('linkedClientCompanyId', linkedClientCompanyId)
  }
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<AnalyticsOverviewResponse>('/analytics/overview' + suffix)
}

export function resolveFileUrl(url: string): string {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${getBaseUrl()}${url}`
  return `${getBaseUrl()}/${url}`
}


export type PublicRequestContext = {
  companyName: string
  introText: string
  publicRequestEnabled: boolean
  requestTypes: Array<'repair' | 'note'>
  defaultRequestType: 'repair' | 'note'
  featureFlags: {
    equipmentSelection: boolean
    photoUpload: boolean
  }
  limits: {
    maxPhotos: number
    requirePhone: boolean
  }
  presetLocationMode?: string | null
  presetLocation?: PublicRequestLocation | null
}

export type PublicRequestLocation = {
  id: string
  name: string
  city?: string | null
  address?: string | null
  externalCode?: string | null
  platformCode?: string | null
  equipmentCount: number
}

export type PublicRequestEquipment = {
  id: string
  name: string
  type: string
}

export type PublicQuickRequestChannel = 'direct_link' | 'qr'

export type PublicQuickRequestInput = {
  locationId: string
  equipmentId?: string | null
  requestType: 'repair' | 'note'
  description: string
  phone?: string
  name?: string | null
  presetLocationId?: string | null
  channel?: PublicQuickRequestChannel
  publicLinkVersion?: string
}

export type PublicQuickRequestResponse = {
  ticketId: string
  ticketNumber?: string | null
  source: 'PUBLIC_QUICK_REQUEST'
  requestType: 'repair' | 'note'
  presetLocation?: boolean
  channel?: PublicQuickRequestChannel
}

export async function publicRequestContext(token: string, locationId?: string | null): Promise<PublicRequestContext> {
  const search = new URLSearchParams()
  if (locationId) search.set('locationId', locationId)
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<PublicRequestContext>('/public/request/context/' + encodeURIComponent(token) + suffix, { auth: false })
}

export async function publicRequestLocations(token: string, q?: string): Promise<PublicRequestLocation[]> {
  const search = new URLSearchParams()
  if (q?.trim()) search.set('q', q.trim())
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<PublicRequestLocation[]>('/public/request/locations/' + encodeURIComponent(token) + suffix, { auth: false })
}

export async function publicRequestLocationEquipment(token: string, locationId: string): Promise<PublicRequestEquipment[]> {
  const search = new URLSearchParams({ token })
  return request<PublicRequestEquipment[]>('/public/request/locations/' + locationId + '/equipment?' + search.toString(), { auth: false })
}

export async function submitPublicQuickRequest(
  token: string,
  input: PublicQuickRequestInput,
  photos: File[] = [],
): Promise<PublicQuickRequestResponse> {
  const formData = new FormData()
  formData.append('locationId', input.locationId)
  if (input.equipmentId) formData.append('equipmentId', input.equipmentId)
  formData.append('requestType', input.requestType)
  formData.append('description', input.description)
  if (input.phone?.trim()) formData.append('phone', input.phone)
  if (input.name?.trim()) formData.append('name', input.name.trim())
  if (input.presetLocationId) formData.append('presetLocationId', input.presetLocationId)
  if (input.channel) formData.append('channel', input.channel)
  if (input.publicLinkVersion) formData.append('publicLinkVersion', input.publicLinkVersion)
  for (const photo of photos) {
    formData.append('photos', photo)
  }

  const res = await fetch(getBaseUrl() + '/public/request/' + encodeURIComponent(token), {
    method: 'POST',
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
      : 'HTTP ' + res.status

    throw new Error(message)
  }

  return data as PublicQuickRequestResponse
}

