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

export type ImpersonateResponse = {
  access_token: string
  impersonated: boolean
  company: {
    id: string
    name: string
  }
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
  brandName?: string | null
  legalName?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  taxId?: string | null
  registrationNumber?: string | null
  logoUrl?: string | null
  signatureLineName?: string | null
  signatureLineTitle?: string | null
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
  requiredSpecializationsCount?: number
  fallbackMode?: boolean
  note?: string
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


export type TechnicianBoundContext = {
  clientCompany: {
    id: string
    name: string
    type: CompanyType
  }
  locationScope: 'ALL_COMPANY_LOCATIONS' | 'SELECTED_LOCATIONS'
  bindingCount: number
  locations: LocationListItem[]
  categories: ProblemCategoryListItem[]
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
  matchReason?: 'category_specialization' | 'fallback_no_category_specializations' | 'no_match'
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
  location?: {
    id: string
    name: string
    platformCode?: string | null
    externalCode?: string | null
    city?: string | null
    address?: string | null
  }
  meta?: {
    matchingMode?: 'category_specializations' | 'fallback_no_category_specializations'
    explanation?: string
    scopeCompanyId?: string
    workforceCompanyId?: string
    visibilityMode?: 'tenant' | 'provider_primary' | 'platform_observer'
  }
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
  pointName?: string | null
  location?: {
    id: string
    name: string
    platformCode?: string | null
    externalCode?: string | null
    city?: string | null
    address?: string | null
  } | null
  equipment?: {
    id: string
    name: string
    type?: string | null
    status?: string | null
  } | null
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
    visibilityMode?: 'tenant' | 'provider_primary' | 'platform_observer'
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
  location?: {
    id: string
    name: string
    platformCode?: string | null
    externalCode?: string | null
    city?: string | null
    region?: string | null
    address?: string | null
    latitude?: number | null
    longitude?: number | null
    isActive?: boolean
  } | null
  equipment?: {
    id: string
    name: string
    type?: string | null
    status?: string | null
  } | null
  problemCategory: { id: string; name: string; instructions: string | null }
  assignedTechnician: { id: string; email: string } | null
  meta?: {
    scopeCompanyId?: string
    visibilityMode?: 'tenant' | 'provider_primary' | 'platform_observer'
    canClaimByCurrentUser?: boolean
    claimAvailabilityReason?: string | null
    availableStatusTransitions?: TicketStatus[]
  }
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
  equipmentId?: string | null
  categoryId: string
  urgency?: TicketUrgency
  clientCompanyId?: string | null
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
  equipmentId?: string | null
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
    visibilityMode?: 'tenant' | 'provider_primary' | 'platform_observer'
  }
}

export type TicketContextAnalyticsResponse = {
  byLocation: Array<{
    locationId: string
    locationName: string
    total: number
    NEW: number
    IN_PROGRESS: number
    DONE: number
  }>
  byEquipment: Array<{
    equipmentId: string
    equipmentName: string
    locationId: string | null
    locationName: string | null
    total: number
    NEW: number
    IN_PROGRESS: number
    DONE: number
  }>
  meta: {
    totalTickets: number
    scopeCompanyId?: string
    visibilityMode?: 'tenant' | 'provider_primary' | 'platform_observer'
  }
}

export type CompanySettings = {
  id: string
  name: string
  brandName?: string | null
  legalName?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  taxId?: string | null
  registrationNumber?: string | null
  logoUrl?: string | null
  signatureLineName?: string | null
  signatureLineTitle?: string | null
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
  brandName?: string | null
  legalName?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  taxId?: string | null
  registrationNumber?: string | null
  logoUrl?: string | null
  signatureLineName?: string | null
  signatureLineTitle?: string | null
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
const PLATFORM_BACKUP_KEY = 'platform_access_token_backup'
const PLATFORM_BACKUP_ROLE_KEY = 'platform_user_role_backup'
const PLATFORM_BACKUP_COMPANY_LABEL_KEY = 'platform_company_label_backup'
const IMPERSONATION_META_KEY = 'impersonation_meta'

export type ImpersonationMeta = {
  companyId: string
  companyName: string
  startedAt: string
}

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

export function resolveFileUrl(url: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  const normalized = url.startsWith('/') ? url : '/' + url
  return getBaseUrl() + normalized
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

export function getImpersonationMeta(): ImpersonationMeta | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(IMPERSONATION_META_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as ImpersonationMeta
    if (!parsed?.companyId || !parsed?.companyName) return null
    return parsed
  } catch {
    return null
  }
}

export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(PLATFORM_BACKUP_KEY) && !!getImpersonationMeta()
}

export function clearImpersonationState() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PLATFORM_BACKUP_KEY)
  localStorage.removeItem(PLATFORM_BACKUP_ROLE_KEY)
  localStorage.removeItem(PLATFORM_BACKUP_COMPANY_LABEL_KEY)
  localStorage.removeItem(IMPERSONATION_META_KEY)
}

export function beginImpersonationSession(payload: ImpersonateResponse) {
  if (typeof window === 'undefined') return

  const currentToken = getToken()
  if (currentToken && !localStorage.getItem(PLATFORM_BACKUP_KEY)) {
    localStorage.setItem(PLATFORM_BACKUP_KEY, currentToken)
    localStorage.setItem(PLATFORM_BACKUP_ROLE_KEY, getUserRole() || 'PLATFORM_ADMIN')
    localStorage.setItem(PLATFORM_BACKUP_COMPANY_LABEL_KEY, getCompanyLabel())
  }

  setToken(payload.access_token)
  setUserRole('ADMIN')
  setCompanyLabel(payload.company.name)
  localStorage.setItem(
    IMPERSONATION_META_KEY,
    JSON.stringify({
      companyId: payload.company.id,
      companyName: payload.company.name,
      startedAt: new Date().toISOString(),
    } satisfies ImpersonationMeta),
  )
}

export function exitImpersonationSession(): boolean {
  if (typeof window === 'undefined') return false

  const backupToken = localStorage.getItem(PLATFORM_BACKUP_KEY)
  if (!backupToken) {
    clearToken()
    return false
  }

  const backupRole = localStorage.getItem(PLATFORM_BACKUP_ROLE_KEY) || 'PLATFORM_ADMIN'
  const backupCompanyLabel = localStorage.getItem(PLATFORM_BACKUP_COMPANY_LABEL_KEY) || 'ServiceManager Platform'

  setToken(backupToken)
  setUserRole(backupRole)
  setCompanyLabel(backupCompanyLabel)
  clearImpersonationState()
  return true
}

export function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_ROLE_KEY)
  localStorage.removeItem(COMPANY_LABEL_KEY)
  clearImpersonationState()
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

export async function impersonate(companyId: string): Promise<ImpersonateResponse> {
  return request<ImpersonateResponse>('/auth/impersonate', {
    method: 'POST',
    body: { companyId },
  })
}

export async function me(): Promise<Me> {
  return request<Me>('/auth/me')
}

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  return request<UserListItem>('/users', {
    method: 'POST',
    body: input,
  })
}

export async function users(companyId?: string): Promise<UserListItem[]> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<UserListItem[]>('/users' + suffix)
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

export async function getTechnicianBoundContexts(): Promise<TechnicianBoundContext[]> {
  return request<TechnicianBoundContext[]>('/technicians/me/bound-contexts')
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

export async function company(companyId?: string, linkedClientCompanyId?: string): Promise<CompanySettings> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  if (linkedClientCompanyId) search.set('linkedClientCompanyId', linkedClientCompanyId)
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<CompanySettings>('/company' + suffix)
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

export async function locations(companyId?: string): Promise<LocationListItem[]> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<LocationListItem[]>('/locations' + suffix)
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

export type TicketScopeParams = {
  companyId?: string
  linkedClientCompanyId?: string
}

function normalizeTicketScope(scope?: string | TicketScopeParams): TicketScopeParams {
  if (!scope) return {}
  if (typeof scope === 'string') return { companyId: scope }
  return scope
}

function buildTicketScopeSuffix(scope?: string | TicketScopeParams): string {
  const normalized = normalizeTicketScope(scope)
  const search = new URLSearchParams()

  if (normalized.companyId) search.set('companyId', normalized.companyId)
  if (normalized.linkedClientCompanyId) search.set('linkedClientCompanyId', normalized.linkedClientCompanyId)

  return search.toString() ? `?${search.toString()}` : ''
}

export async function board(params?: {
  take?: number
  linkedClientCompanyId?: string
  companyId?: string
  locationId?: string
  equipmentId?: string
  status?: TicketStatus
}): Promise<BoardResponse> {
  const search = new URLSearchParams()

  if (params?.take) {
    search.set('take', String(params.take))
  }
  if (params?.locationId) {
    search.set('locationId', params.locationId)
  }
  if (params?.equipmentId) {
    search.set('equipmentId', params.equipmentId)
  }
  if (params?.linkedClientCompanyId) {
    search.set('linkedClientCompanyId', params.linkedClientCompanyId)
  }
  if (params?.companyId) {
    search.set('companyId', params.companyId)
  }
  if (params?.status) {
    search.set('status', params.status)
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

export async function ticket(id: string, scope?: string | TicketScopeParams): Promise<TicketGetOne> {
  return request<TicketGetOne>(`/tickets/${id}${buildTicketScopeSuffix(scope)}`)
}

export async function getTicket(id: string, scope?: string | TicketScopeParams): Promise<TicketGetOne> {
  return ticket(id, scope)
}

export async function ticketTimeline(id: string, scope?: string | TicketScopeParams): Promise<TimelineResponse> {
  return request<TimelineResponse>(`/timeline/tickets/${id}${buildTicketScopeSuffix(scope)}`)
}
export async function timeline(id: string, scope?: string | TicketScopeParams): Promise<TimelineResponse> {
  return ticketTimeline(id, scope)
}

export async function timelineTicket(id: string, scope?: string | TicketScopeParams): Promise<TimelineResponse> {
  return ticketTimeline(id, scope)
}

export async function assignmentCandidates(id: string, scope?: string | TicketScopeParams): Promise<AssignmentCandidatesResponse> {
  return request<AssignmentCandidatesResponse>(`/tickets/${id}/assignment-candidates${buildTicketScopeSuffix(scope)}`)
}

export async function getTicketAssignmentCandidates(id: string, scope?: string | TicketScopeParams): Promise<AssignmentCandidatesResponse> {
  return assignmentCandidates(id, scope)
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

export async function updateTicket(id: string, input: UpdateTicketInput, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}${buildTicketScopeSuffix(scope)}`, {
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

export async function assignTicket(id: string, technicianId: string, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}/assign/${technicianId}${buildTicketScopeSuffix(scope)}`, {
    method: 'PUT',
  })
}

export async function claimTicket(id: string, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}/claim${buildTicketScopeSuffix(scope)}`, {
    method: 'POST',
  })
}

export async function claim(id: string, scope?: string | TicketScopeParams): Promise<any> {
  return claimTicket(id, scope)
}

export async function updateTicketStatus(id: string, input: UpdateTicketStatusInput, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}/status${buildTicketScopeSuffix(scope)}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function ticketAttachments(id: string, scope?: string | TicketScopeParams): Promise<TicketAttachmentItem[]> {
  return request<TicketAttachmentItem[]>(`/tickets/${id}/attachments${buildTicketScopeSuffix(scope)}`)
}

export async function uploadTicketAttachment(id: string, file: File, scope?: string | TicketScopeParams): Promise<any> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${getBaseUrl()}/tickets/${id}/attachments${buildTicketScopeSuffix(scope)}`, {
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

export async function deleteTicketAttachment(id: string, attachmentId: string, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}/attachments/${attachmentId}${buildTicketScopeSuffix(scope)}`, {
    method: 'DELETE',
  })
}

export async function mapLocations(): Promise<MapLocationItem[]> {
  return request<MapLocationItem[]>('/map/locations')
}

export async function mapLocation(locationId: string): Promise<MapLocationDetail> {
  return request<MapLocationDetail>(`/map/locations/${locationId}`)
}

export async function analyticsOverview(params?: { linkedClientCompanyId?: string; companyId?: string }): Promise<AnalyticsOverviewResponse> {
  const search = new URLSearchParams()
  if (params?.linkedClientCompanyId) {
    search.set('linkedClientCompanyId', params.linkedClientCompanyId)
  }
  if (params?.companyId) {
    search.set('companyId', params.companyId)
  }
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<AnalyticsOverviewResponse>('/analytics/overview' + suffix)
}

export async function ticketContextAnalytics(params?: {
  linkedClientCompanyId?: string
  companyId?: string
  locationId?: string
  equipmentId?: string
}): Promise<TicketContextAnalyticsResponse> {
  const search = new URLSearchParams()
  if (params?.linkedClientCompanyId) search.set('linkedClientCompanyId', params.linkedClientCompanyId)
  if (params?.companyId) search.set('companyId', params.companyId)
  if (params?.locationId) search.set('locationId', params.locationId)
  if (params?.equipmentId) search.set('equipmentId', params.equipmentId)
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<TicketContextAnalyticsResponse>('/tickets/analytics/context' + suffix)
}


export type EquipmentListItem = {
  id: string
  locationId?: string
  name: string
  type: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

export type InspectionTemplateItem = {
  id: string
  title: string
  description?: string | null
  sortOrder: number
  isRequired: boolean
  createdAt?: string
  updatedAt?: string
}

export type InspectionTemplate = {
  id: string
  companyId: string
  name: string
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  items: InspectionTemplateItem[]
}

export type InspectionRunItemStatus = 'PENDING' | 'OK' | 'ISSUE' | 'CRITICAL' | 'SKIPPED'
export type InspectionRunStatus = 'IN_PROGRESS' | 'COMPLETED'
export type InspectionReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export type InspectionRunItemAttachment = {
  id: string
  runItemId: string
  originalName: string
  mimeType: string
  sizeBytes: number
  url: string
  createdAt: string
}

export type InspectionLinkedTicket = {
  id: string
  status: TicketStatus
  urgency: TicketUrgency
  createdAt: string
}

export type InspectionRunItem = {
  id: string
  runId: string
  templateItemId?: string | null
  title: string
  description?: string | null
  sortOrder: number
  isRequired: boolean
  status: InspectionRunItemStatus
  requiresRepair: boolean
  comment?: string | null
  ticketId?: string | null
  createdAt: string
  updatedAt: string
  ticket?: InspectionLinkedTicket | null
  attachments: InspectionRunItemAttachment[]
}

export type InspectionRun = {
  id: string
  companyId: string
  templateId: string
  locationId: string
  equipmentId?: string | null
  title: string
  status: InspectionRunStatus
  reportStatus?: InspectionReportStatus
  reportSubmittedAt?: string | null
  reportReviewedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  template: {
    id: string
    name: string
  }
  performedBy?: {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
  } | null
  location: {
    id: string
    name: string
    city?: string | null
    address?: string | null
    platformCode?: string | null
  }
  equipment?: {
    id: string
    name: string
    type: string
    status?: string
  } | null
  items: InspectionRunItem[]
}

export type InspectionRunListItem = {
  id: string
  title: string
  status: InspectionRunStatus
  reportStatus?: InspectionReportStatus
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  template: {
    id: string
    name: string
  }
  location: {
    id: string
    name: string
    city?: string | null
  }
  equipment?: {
    id: string
    name: string
  } | null
  _count: {
    items: number
  }
}

export type InspectionRunSummary = {
  totalItems: number
  okCount: number
  issueCount: number
  criticalCount: number
  skippedCount?: number
  repairRequiredCount: number
  createdTicketsCount: number
}

export type InspectionRunReportMeta = {
  status: InspectionReportStatus
  approvedAt?: string | null
  submittedAt?: string | null
  submittedBy?: {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
  } | null
  reviewedAt?: string | null
  reviewedBy?: {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
  } | null
  reviewComment?: string | null
}

export type InspectionRunReportDocumentParty = {
  id: string
  name: string
  legalName?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  taxId?: string | null
  registrationNumber?: string | null
  signatureLineName?: string | null
  signatureLineTitle?: string | null
}

export type InspectionRunReport = {
  run: {
    id: string
    status: InspectionRunStatus
    startedAt: string
    completedAt?: string | null
    performedBy?: {
      id: string
      email: string
      firstName?: string | null
      lastName?: string | null
    } | null
    template: {
      id: string
      name: string
    }
    location: {
      id: string
      name: string
      platformCode?: string | null
      city?: string | null
      address?: string | null
    }
    equipment?: {
      id: string
      name: string
      type: string
    } | null
  }
  document: {
    title: string
    number: string
    date?: string | null
    executorCompany: InspectionRunReportDocumentParty
    clientCompany: InspectionRunReportDocumentParty
  }
  reportMeta: InspectionRunReportMeta
  items: Array<{
    id: string
    title: string
    description?: string | null
    status: InspectionRunItemStatus
    comment?: string | null
    requiresRepair: boolean
    attachments: Array<{
      id: string
      url: string
      mimeType: string
      originalName?: string
    }>
    ticket?: {
      id: string
      status: TicketStatus
      problemText: string
    } | null
  }>
  summary: InspectionRunSummary
}

export type StartInspectionRunInput = {
  templateId: string
  locationId: string
  equipmentId?: string
  title?: string
}

export type UpdateInspectionRunItemInput = {
  status?: InspectionRunItemStatus
  requiresRepair?: boolean
  comment?: string
}

export type CreateTicketFromInspectionItemInput = {
  categoryId: string
  title?: string
  description?: string
  urgency?: TicketUrgency
}

export type ReviewInspectionRunReportInput = {
  decision: 'APPROVED' | 'REJECTED'
  comment?: string
}

export type CompleteInspectionRunResponse = {
  run: InspectionRun
  summary: InspectionRunSummary
}
export async function equipmentByLocation(locationId: string): Promise<EquipmentListItem[]> {
  return request<EquipmentListItem[]>('/equipment/location/' + locationId)
}

export async function getInspectionTemplates(): Promise<InspectionTemplate[]> {
  return request<InspectionTemplate[]>('/inspection/templates')
}

export async function createInspectionTemplate(input: {
  name: string
  description?: string
  items: Array<{
    title: string
    description?: string
    sortOrder?: number
    isRequired?: boolean
  }>
}): Promise<InspectionTemplate> {
  return request<InspectionTemplate>('/inspection/templates', {
    method: 'POST',
    body: input,
  })
}

export async function getInspectionRuns(): Promise<InspectionRunListItem[]> {
  return request<InspectionRunListItem[]>('/inspection/runs')
}

export async function getInspectionRun(id: string): Promise<InspectionRun> {
  return request<InspectionRun>('/inspection/runs/' + id)
}

export async function startInspectionRun(input: StartInspectionRunInput): Promise<InspectionRun> {
  return request<InspectionRun>('/inspection/runs', {
    method: 'POST',
    body: input,
  })
}

export async function updateInspectionRunItem(
  runId: string,
  itemId: string,
  input: UpdateInspectionRunItemInput,
): Promise<InspectionRunItem> {
  return request<InspectionRunItem>(`/inspection/runs/${runId}/items/${itemId}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function uploadInspectionRunItemAttachment(
  runId: string,
  itemId: string,
  file: File,
): Promise<InspectionRunItemAttachment> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${getBaseUrl()}/inspection/runs/${runId}/items/${itemId}/attachments`, {
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

  return data as InspectionRunItemAttachment
}

export async function createTicketFromInspectionItem(
  runId: string,
  itemId: string,
  input: CreateTicketFromInspectionItemInput,
): Promise<{
  item: InspectionRunItem
  ticket: CreateTicketResponse['ticket'] & { status?: TicketStatus; urgency?: TicketUrgency; createdAt?: string }
  generated?: CreateTicketResponse['generated']
  autoAssigned?: boolean
}> {
  return request(`/inspection/runs/${runId}/items/${itemId}/create-ticket`, {
    method: 'POST',
    body: input,
  })
}

export async function getInspectionRunReport(id: string): Promise<InspectionRunReport> {
  return request<InspectionRunReport>('/inspection/runs/' + id + '/report')
}

export async function submitInspectionRunReport(id: string): Promise<InspectionRunReport> {
  return request<InspectionRunReport>('/inspection/runs/' + id + '/report/submit', {
    method: 'POST',
    body: {},
  })
}

export async function reviewInspectionRunReport(
  id: string,
  input: ReviewInspectionRunReportInput,
): Promise<InspectionRunReport> {
  return request<InspectionRunReport>('/inspection/runs/' + id + '/report/review', {
    method: 'POST',
    body: input,
  })
}

export async function completeInspectionRun(runId: string): Promise<CompleteInspectionRunResponse> {
  return request<CompleteInspectionRunResponse>(`/inspection/runs/${runId}/complete`, {
    method: 'POST',
  })
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



export async function downloadInspectionRunReportExport(
  id: string,
  format: 'docx' = 'docx',
): Promise<{ blob: Blob; fileName: string }> {
  const token = getToken()
  const url = new URL(getBaseUrl() + '/inspection/runs/' + id + '/report/export')
  url.searchParams.set('format', format)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: token ? { Authorization: 'Bearer ' + token } : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    let data: any = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(',')
        : String(data.message)
      : 'HTTP ' + res.status
    throw new Error(message)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') || ''
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i)
  return {
    blob,
    fileName: match?.[1] || 'work-act.' + format,
  }
}



