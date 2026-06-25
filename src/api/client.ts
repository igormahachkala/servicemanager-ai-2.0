/// <reference types="vite/client" />
// ─── ServiceManager.AI — API client ───────────────────────────────────────────
// Контракт сверен с живым бэкендом (web/src/lib/api.ts + backend DTO), не с догадками.
// Источник правды — сервер. Базовый URL берётся из VITE_API_BASE, по умолчанию прод.

const DEFAULT_BASE = 'https://api.servicemanagerai.ru'

export function getBaseUrl(): string {
  // ВАЖНО: обращаемся к import.meta.env ТОЧНЫМ паттерном — Vite подменяет его
  // статически. Опциональная цепочка (import.meta?.env) ломает подмену → не использовать.
  const env = import.meta.env.VITE_API_BASE
  // Явный VITE_API_BASE всегда главнее (напр. http://127.0.0.1:3001 для прямого обращения).
  if (typeof env === 'string' && env.trim() !== '') return env.replace(/\/+$/, '')
  // Dev (vite) без явного base → same-origin → dev-прокси (CORS не возникает).
  if (import.meta.env.DEV) return ''
  // Прод-сборка по умолчанию.
  return DEFAULT_BASE
}

// ─── Token storage (browser) ──────────────────────────────────────────────────
const TOKEN_KEY = 'sma_access_token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(t: string | null): void {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* no-op */ }
}

// ─── Enums / shared types (точно как в backend/prisma + web client) ────────────
export type TicketStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'AWAITING_ACCEPTANCE' | 'DONE' | 'CANCELED'
export type TicketUrgency = 'URGENT' | 'NOT_URGENT'
export type TicketPriority = 'NORMAL' | 'URGENT'
export type Role = string

export type Me = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  role: Role
  companyId: string
  companyName?: string | null
  avatarUrl?: string | null
  isActive?: boolean
  linkedClientCompanyId?: string | null
}

export type LoginInput = { email: string; password: string }
export type LoginResponse = { access_token: string; user: Me }

// Карточка на доске (GET /tickets/board → columns[].cards[])
export type TicketCard = {
  id: string
  ticketNumber?: number
  companyId: string
  title: string
  status: TicketStatus
  urgency: TicketUrgency
  priority?: TicketPriority
  createdAt: string
  slaDueAt: string | null
  slaBreached: boolean
  isChild: boolean
  pointName?: string | null
  location?: { id: string; name: string; city?: string | null; address?: string | null } | null
  equipment?: { id: string; name: string } | null
  category: { id: string; name: string }
  assignedTechnician: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null
  description?: string
  requesterName?: string | null
  assignedTechnicianId?: string | null
  canClaimByCurrentUser?: boolean
}

export type BoardColumn = {
  status: TicketStatus
  total: number
  sla: { breached: number; atRisk: number }
  cards: TicketCard[]
}
export type BoardResponse = {
  columns: BoardColumn[]
  meta: {
    totalTickets: number
    atRiskThresholdMinutes: number
    limitedToLast: number
    scopeCompanyId?: string
    visibilityMode?: 'tenant' | 'provider_primary' | 'platform_observer'
  }
}

// Карточка заявки (GET /tickets/:id)
export type TicketGetOne = {
  id: string
  companyId?: string | null
  ticketNumber?: number | null
  title?: string
  description?: string
  status: TicketStatus
  urgency: TicketUrgency
  priority: TicketPriority
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
  location?: { id: string; name: string; city?: string | null; address?: string | null } | null
  equipment?: { id: string; name: string } | null
  problemCategory: { id: string; name: string; instructions: string | null }
  assignedTechnician: { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null } | null
  meta?: {
    availableStatusTransitions?: TicketStatus[]
    availableActions?: { canClaim: boolean; canStart: boolean; canComplete: boolean; canClose: boolean }
  }
}

export type UpdateTicketStatusInput = { status: TicketStatus; comment?: string }
export type AcceptanceDecision = 'ACCEPT' | 'REJECT'
export type AcceptanceInput = { decision: AcceptanceDecision; comment?: string; attachmentIds?: string[] }

// ─── HTTP core ──────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

type RequestOpts = {
  method?: string
  body?: unknown
  auth?: boolean // default true
  signal?: AbortSignal
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opts
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })
  const text = await res.text()
  let parsed: unknown = undefined
  if (text) { try { parsed = JSON.parse(text) } catch { parsed = text } }
  if (!res.ok) {
    const msg = (parsed && typeof parsed === 'object' && 'message' in (parsed as any))
      ? String((parsed as any).message)
      : `HTTP ${res.status}`
    throw new ApiError(res.status, msg, parsed)
  }
  return parsed as T
}

// ─── Linked scope (провайдер-техник → linkedClientCompanyId клиента) ───────────
// Web-паттерн (web/src/hooks/useLinkedBoardScope.ts + lib/api.ts): для TECHNICIAN
// scope = первый clientCompany.id из /technicians/me/bound-contexts, который
// прокидывается query-параметром во все ticket-запросы. Резолвится при логине и
// ПЕРСИСТИТСЯ в localStorage (как токен) — чтобы пережить reload без повторного login.
const LINKED_SCOPE_KEY = 'sma_linked_scope'
let linkedScope: string | null = (() => { try { return localStorage.getItem(LINKED_SCOPE_KEY) } catch { return null } })()
export function setLinkedScope(id: string | null): void {
  linkedScope = id || null
  try { id ? localStorage.setItem(LINKED_SCOPE_KEY, id) : localStorage.removeItem(LINKED_SCOPE_KEY) } catch { /* no-op */ }
}
export function getLinkedScope(): string | null { return linkedScope }
/** Добавляет linkedClientCompanyId к пути, если scope установлен и его там ещё нет. */
function withScope(path: string): string {
  if (!linkedScope || path.includes('linkedClientCompanyId')) return path
  return `${path}${path.includes('?') ? '&' : '?'}linkedClientCompanyId=${encodeURIComponent(linkedScope)}`
}

// ─── Endpoints ────────────────────────────────────────────────────────────────
export async function login(input: LoginInput): Promise<LoginResponse> {
  const res = await request<LoginResponse>('/auth/login', { method: 'POST', auth: false, body: input })
  if (res?.access_token) setToken(res.access_token)
  // Резолв linked-scope (как в web):
  //  • TECHNICIAN → первый clientCompany.id из bound-contexts;
  //  • прочие провайдер-роли (ADMIN/DISPATCHER…) → из service-contracts/linked-clients (ACTIVE+PRIMARY → ACTIVE → первый).
  // CLIENT-компания linked-клиентов не имеет → scope останется null (она владеет своими заявками).
  setLinkedScope(null)
  if (res?.user?.role === 'TECHNICIAN') {
    try {
      const ctxs = await technicianBoundContexts()
      const picked = (Array.isArray(ctxs) ? ctxs : []).map((c) => c?.clientCompany?.id).find(Boolean) || null
      setLinkedScope(picked)
    } catch { /* scope опционален — не валим логин */ }
  } else {
    try {
      const rows = await serviceContractsLinkedClients()
      const arr = Array.isArray(rows) ? rows : []
      const pick = arr.find((r) => r.status === 'ACTIVE' && r.role === 'PRIMARY') || arr.find((r) => r.status === 'ACTIVE') || arr[0]
      setLinkedScope(pick?.clientCompany?.id || null)
    } catch { /* нет linked-клиентов (напр. CLIENT-компания) — scope null */ }
  }
  return res
}

export function logout(): void { setToken(null); setLinkedScope(null) }

export async function me(): Promise<Me> {
  return request<Me>('/auth/me')
}

export async function board(params?: {
  take?: number
  status?: TicketStatus
  locationId?: string
  includeArchived?: boolean
  linkedClientCompanyId?: string
}): Promise<BoardResponse> {
  const s = new URLSearchParams()
  if (params?.take) s.set('take', String(params.take))
  if (params?.status) s.set('status', params.status)
  if (params?.locationId) s.set('locationId', params.locationId)
  if (params?.includeArchived) s.set('includeArchived', 'true')
  if (params?.linkedClientCompanyId) s.set('linkedClientCompanyId', params.linkedClientCompanyId)
  const suffix = s.toString() ? `?${s.toString()}` : ''
  return request<BoardResponse>(withScope(`/tickets/board${suffix}`))
}

/** Доступные для claim заявки (для техника). */
export async function availableTickets(linkedClientCompanyId?: string): Promise<TicketCard[]> {
  const s = new URLSearchParams()
  if (linkedClientCompanyId) s.set('linkedClientCompanyId', linkedClientCompanyId)
  const suffix = s.toString() ? `?${s.toString()}` : ''
  return request<TicketCard[]>(withScope(`/tickets/available${suffix}`))
}

export async function ticket(id: string): Promise<TicketGetOne> {
  return request<TicketGetOne>(withScope(`/tickets/${id}`))
}

export async function setStatus(id: string, input: UpdateTicketStatusInput): Promise<unknown> {
  return request(withScope(`/tickets/${id}/status`), { method: 'PATCH', body: input })
}

export async function claim(id: string): Promise<unknown> {
  return request(withScope(`/tickets/${id}/claim`), { method: 'POST' })
}

export async function addComment(id: string, comment: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(withScope(`/tickets/${id}/comments`), { method: 'POST', body: { comment } })
}

export async function acceptance(id: string, input: AcceptanceInput): Promise<unknown> {
  return request(withScope(`/tickets/${id}/acceptance`), { method: 'POST', body: input })
}

// ─── Attachments (фото-отчёты) ─────────────────────────────────────────────────
// Контракт сверен с backend/src/tickets/ticket-attachments.service.ts:
// POST /tickets/:id/attachments — multipart, поле "file", лимит 25 МБ, только изображения,
// сервер сам ставит purpose=WORK_REPORT. GET — список (orderBy createdAt asc).
export type TicketAttachmentPurpose = 'REQUEST' | 'WORK_REPORT'
export type TicketAttachment = {
  id: string
  ticketId: string | null
  originalName: string
  mimeType: string
  sizeBytes: number
  url: string
  purpose: TicketAttachmentPurpose
  createdAt: string
  uploadedBy?: { id: string; email: string } | null
}

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024 // 25 МБ — как в FileInterceptor бэка
export const ATTACHMENT_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export async function listAttachments(id: string): Promise<TicketAttachment[]> {
  return request<TicketAttachment[]>(withScope(`/tickets/${id}/attachments`))
}

// multipart-загрузка файла: НЕ ставим Content-Type вручную (браузер сам добавит boundary)
async function postFile<T>(path: string, file: File): Promise<T> {
  const fd = new FormData()
  fd.append('file', file)
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${getBaseUrl()}${withScope(path)}`, { method: 'POST', headers, body: fd })
  const text = await res.text()
  let parsed: unknown = undefined
  if (text) { try { parsed = JSON.parse(text) } catch { parsed = text } }
  if (!res.ok) {
    const msg = (parsed && typeof parsed === 'object' && 'message' in (parsed as any))
      ? String((parsed as any).message)
      : `HTTP ${res.status}`
    throw new ApiError(res.status, msg, parsed)
  }
  return parsed as T
}

/** Фото-отчёт к существующей заявке (purpose=WORK_REPORT). */
export async function uploadAttachment(id: string, file: File): Promise<TicketAttachment> {
  return postFile<TicketAttachment>(`/tickets/${id}/attachments`, file)
}

/** Черновое вложение ДО создания заявки (purpose=REQUEST). Возвращает {id} для attachmentIds. */
export async function uploadDraftAttachment(file: File): Promise<TicketAttachment> {
  return postFile<TicketAttachment>(`/tickets/attachments/upload`, file)
}

/** URL для <img src> защищённого вложения: добавляет ?token=<JWT> (GET /uploads принимает токен в query). */
export function attachmentSrc(url: string): string {
  if (!url) return ''
  const token = getToken()
  const sep = url.includes('?') ? '&' : '?'
  return `${getBaseUrl()}${url}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`
}

// ─── Справочники + создание заявки ─────────────────────────────────────────────
// Контракт сверён с реальными ответами стейджа (backend locations/problem-categories
// контроллеры скоупят по query-параметру `companyId`).
export type LocationItem = {
  id: string
  name: string
  platformCode?: string | null
  externalCode?: string | null
  city?: string | null
  region?: string | null
  address?: string | null
  isActive?: boolean
  clientCompanyId?: string | null
}
export type ProblemCategoryItem = {
  id: string
  name: string
  instructions?: string | null
  isActive?: boolean
}

/** Контексты техника (для провайдера: к каким client-компаниям/локациям он привязан). */
export type BoundContext = {
  clientCompany: { id: string; name: string; type: string }
  locations?: LocationItem[]
  categories?: ProblemCategoryItem[]
}

export type CreateTicketInput = {
  locationId: string
  problemCategoryId?: string
  categoryId?: string
  title?: string
  description?: string
  problemText?: string
  urgency?: TicketUrgency
  priority?: TicketPriority
  attachmentIds?: string[]
  requesterName?: string
  requesterPhone?: string
  slaMinutes?: number
  createMode?: 'quick' | 'full'
  /** Для провайдера: создать заявку в scope linked-client компании. */
  clientCompanyId?: string
}
/** POST /tickets возвращает обёртку — реальный id заявки в .ticket.id (сверено runtime). */
export type CreateTicketResult = {
  ticket: { id: string; ticketNumber?: number | null; status: TicketStatus; [k: string]: unknown }
  autoAssigned?: boolean
  candidates?: unknown
  generated?: unknown
  instructions?: unknown
}

function companyScopeSuffix(companyId?: string): string {
  return companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
}

export async function locations(companyId?: string): Promise<LocationItem[]> {
  return request<LocationItem[]>(`/locations${companyScopeSuffix(companyId)}`)
}

export async function problemCategories(companyId?: string): Promise<ProblemCategoryItem[]> {
  return request<ProblemCategoryItem[]>(`/problem-categories${companyScopeSuffix(companyId)}`)
}

export async function technicianBoundContexts(): Promise<BoundContext[]> {
  return request<BoundContext[]>(`/technicians/me/bound-contexts`)
}

export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  return request<CreateTicketResult>(withScope('/tickets'), { method: 'POST', body: input })
}

// ─── Назначение техника (провайдер-сторона; клиент → 403) ──────────────────────
// GET /tickets/:id/assignment-candidates → {matched[], others[], ...}; PUT /tickets/:id/assign/:technicianId.
export type AssignmentCandidate = {
  id: string
  email: string
  matched?: boolean
  matchReason?: string
  assignedCount: number
  inProgressCount: number
  activeLoad: number
  specializations: unknown[]
}
export type AssignmentCandidatesResponse = {
  ticketId: string
  category?: { id: string; name: string } | null
  location?: { id: string; name: string } | null
  currentAssigneeId: string | null
  requiredSpecializations: unknown[]
  matched: AssignmentCandidate[]
  others: AssignmentCandidate[]
  meta?: Record<string, unknown>
}
export async function getAssignmentCandidates(ticketId: string): Promise<AssignmentCandidatesResponse> {
  return request<AssignmentCandidatesResponse>(withScope(`/tickets/${ticketId}/assignment-candidates`))
}
/** Назначить техника. ВНИМАНИЕ: реальный контракт — PUT /assign/:technicianId (id в пути, не тело). */
export async function assignTicket(ticketId: string, technicianId: string): Promise<TicketGetOne> {
  return request<TicketGetOne>(withScope(`/tickets/${ticketId}/assign/${technicianId}`), { method: 'PUT' })
}

// Linked-клиенты провайдера (для scope не-техника) — GET /service-contracts/linked-clients.
export type LinkedClientRow = { id: string; status?: string; role?: string; clientCompany?: { id: string; name: string } | null }
export async function serviceContractsLinkedClients(): Promise<LinkedClientRow[]> {
  return request<LinkedClientRow[]>('/service-contracts/linked-clients')
}

// ─── Обходы (inspection) ───────────────────────────────────────────────────────
// Контракт сверён с backend/src/inspection (controller + DTO) и web/src/lib/api.ts.
export type InspectionRunItemStatus = 'PENDING' | 'OK' | 'ISSUE' | 'CRITICAL' | 'SKIPPED'
export type InspectionRunStatus = 'IN_PROGRESS' | 'COMPLETED'
export type InspectionReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export type InspectionTemplateItem = { id: string; title: string; description?: string | null; sortOrder: number; isRequired: boolean }
export type InspectionTemplate = { id: string; companyId: string; name: string; description?: string | null; isActive: boolean; createdAt: string; updatedAt: string; items: InspectionTemplateItem[] }

export type InspectionRunItemAttachment = { id: string; runItemId: string; originalName: string; mimeType: string; sizeBytes: number; url: string; createdAt: string }
export type InspectionRunItem = {
  id: string; runId: string; templateItemId?: string | null
  title: string; description?: string | null; sortOrder: number; isRequired: boolean
  status: InspectionRunItemStatus; requiresRepair: boolean; comment?: string | null
  ticketId?: string | null; ticket?: { id: string; status: TicketStatus } | null
  attachments: InspectionRunItemAttachment[]
}
export type InspectionRunListItem = {
  id: string; title: string; status: InspectionRunStatus; reportStatus?: InspectionReportStatus
  completedAt?: string | null; createdAt: string; updatedAt: string
  template: { id: string; name: string }
  location: { id: string; name: string; city?: string | null }
  equipment?: { id: string; name: string } | null
  _count: { items: number }
}
export type InspectionRun = InspectionRunListItem & {
  companyId: string; templateId: string; locationId: string
  location: { id: string; name: string; city?: string | null; address?: string | null; platformCode?: string | null }
  items: InspectionRunItem[]
}

export type StartRunInput = { templateId: string; locationId: string; equipmentId?: string; title?: string }
export type CreateTemplateInput = { name: string; description?: string; items: Array<{ title: string; description?: string; sortOrder?: number; isRequired?: boolean }> }
export type UpdateRunItemInput = { status?: InspectionRunItemStatus; requiresRepair?: boolean; comment?: string }
export type CreateTicketFromItemInput = { categoryId: string; title?: string; description?: string }

export const INSPECTION_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024 // 10 МБ — как в FileInterceptor

export async function inspectionTemplates(): Promise<InspectionTemplate[]> {
  return request<InspectionTemplate[]>('/inspection/templates')
}
export async function createTemplate(input: CreateTemplateInput): Promise<InspectionTemplate> {
  return request<InspectionTemplate>('/inspection/templates', { method: 'POST', body: input })
}
export async function inspectionRuns(): Promise<InspectionRunListItem[]> {
  return request<InspectionRunListItem[]>('/inspection/runs')
}
export async function inspectionRun(id: string): Promise<InspectionRun> {
  return request<InspectionRun>(`/inspection/runs/${id}`)
}
export async function startRun(input: StartRunInput): Promise<InspectionRun> {
  return request<InspectionRun>('/inspection/runs', { method: 'POST', body: input })
}
export async function updateRunItem(runId: string, itemId: string, input: UpdateRunItemInput): Promise<InspectionRunItem> {
  return request<InspectionRunItem>(`/inspection/runs/${runId}/items/${itemId}`, { method: 'PATCH', body: input })
}
export async function uploadRunItemPhoto(runId: string, itemId: string, file: File): Promise<InspectionRunItemAttachment> {
  return postFile<InspectionRunItemAttachment>(`/inspection/runs/${runId}/items/${itemId}/attachments`, file)
}
export async function createTicketFromItem(runId: string, itemId: string, input: CreateTicketFromItemInput): Promise<unknown> {
  return request(`/inspection/runs/${runId}/items/${itemId}/create-ticket`, { method: 'POST', body: input })
}
export async function completeRun(id: string): Promise<InspectionRun> {
  return request<InspectionRun>(`/inspection/runs/${id}/complete`, { method: 'POST' })
}

// ─── Оборудование (equipment) ───────────────────────────────────────────────────
// Контракт сверён со стейджем + backend (CreateEquipmentDto = {locationId,name,type}).
// В модели НЕТ: serial, model, manufacturer, qrCode, description.
export type Equipment = {
  id: string
  name: string
  type: string   // UPPERCASE-строка («КОНДИЦИОНЕР», «ЭЛЕКТРИКА» …) — бэк апперкейсит
  status: string // ACTIVE | MAINTENANCE | BROKEN (свободная строка, не enum)
  locationId: string
  companyId: string
  createdAt: string
  updatedAt: string
  location: { id: string; name: string; platformCode?: string | null; city?: string | null; address?: string | null; isActive?: boolean }
}

/** Список оборудования по локации (плоского GET /equipment нет). */
export async function getEquipmentByLocation(locationId: string): Promise<Equipment[]> {
  return request<Equipment[]>(withScope(`/equipment/location/${locationId}`))
}
export async function getEquipmentById(id: string): Promise<Equipment> {
  return request<Equipment>(withScope(`/equipment/${id}`))
}

// ─── Чаты (timeline заявки) ──────────────────────────────────────────────────────
// Выделенного chat/messages API НЕТ. «Чат» заявки = лента timeline,
// сообщения = COMMENT_ADDED, отправка = POST /tickets/:id/comments (уже есть addComment).
// Поля сверены со стейджем (smoke): payload у STATUS_CHANGED = {fromStatus,toStatus,comment?}.
export type TimelineEvent = {
  at: string
  source: string
  timelineEvent: string  // COMMENT_ADDED | STATUS_CHANGED | TICKET_CREATED | …
  domainType: string
  title: string
  actor: { id: string; email: string } | null
  payload: Record<string, any>
}
export type TimelineResponse = {
  ticketId: string
  timeline: TimelineEvent[]
  history?: unknown
  events?: unknown
  meta?: unknown
}
export async function getTicketTimeline(ticketId: string): Promise<TimelineResponse> {
  return request<TimelineResponse>(withScope(`/timeline/tickets/${ticketId}`))
}

/** Плоский список заявок (GET /tickets) — для списка «чатов». */
export type TicketListItem = {
  id: string
  ticketNumber?: number | null
  status: TicketStatus
  problemText?: string | null
  pointName?: string | null
  locationId?: string | null
  location?: { id: string; name: string; city?: string | null } | null
  problemCategory?: { id: string; name: string } | null
  createdAt: string
  statusUpdatedAt?: string | null
}
export async function ticketsList(status?: TicketStatus): Promise<TicketListItem[]> {
  const suffix = status ? `?status=${status}` : ''
  return request<TicketListItem[]>(withScope(`/tickets${suffix}`))
}

/** Заявки по локации. ВНИМАНИЕ: GET /tickets игнорирует ?locationId (whitelist) → фильтруем на клиенте. */
export async function getTicketsByLocation(locationId: string, status?: TicketStatus): Promise<TicketListItem[]> {
  const all = await ticketsList(status)
  return (Array.isArray(all) ? all : []).filter((t) => (t.locationId || t.location?.id) === locationId)
}

// ─── Аналитика ───────────────────────────────────────────────────────────────────
// Типы — только реальные поля из полного JSON (ШАГ 0). timing.* в МИНУТАХ.
export type AnalyticsLocationStat = {
  locationId: string; locationName: string; total: number
  NEW: number; IN_PROGRESS: number; AWAITING_ACCEPTANCE: number; DONE: number
}
export type AnalyticsContextResponse = {
  byLocation: AnalyticsLocationStat[]
  byEquipment: unknown[]
  meta: { totalTickets: number; scopeCompanyId?: string; visibilityMode?: string }
}
export type WorkloadTech = { technicianId: string; technicianEmail: string; assignedCount: number; inProgressCount: number; activeCount: number }
export type ThroughputTech = { technicianId: string; technicianEmail: string; doneCount: number }
export type AnalyticsOverviewResponse = {
  createdCount: number
  openByStatus: Record<string, number>
  bySource: Record<string, number>
  summary: { backlogOpenTotal: number; unassignedOpenTickets: number }
  sla: { evaluatedCount: number; breachedCount: number; okPercent: number; breachedPercent: number }
  timing: { evaluatedTickets: number; meanTimeToAssignMinutes: number; meanTimeToResolveMinutes: number }
  workloadByTechnician: WorkloadTech[]
  throughputByTechnician: ThroughputTech[]
  meta?: { scopeCompanyId?: string; visibilityMode?: string }
}

/** Контекст по заявкам (доступен и TECHNICIAN, и ADMIN) — разбивка по локациям/статусам. */
export async function getTicketsAnalyticsContext(): Promise<AnalyticsContextResponse> {
  return request<AnalyticsContextResponse>(withScope('/tickets/analytics/context'))
}
/** Обзор (только ADMIN/MASTER/DISPATCHER/NETWORK_DIRECTOR; для техника вернёт 403). */
export async function getAnalyticsOverview(): Promise<AnalyticsOverviewResponse> {
  return request<AnalyticsOverviewResponse>('/analytics/overview')
}

export const api = {
  getBaseUrl, getToken, setToken,
  login, logout, me, board, availableTickets, ticket,
  setStatus, claim, addComment, acceptance,
  listAttachments, uploadAttachment, uploadDraftAttachment, attachmentSrc,
  locations, problemCategories, technicianBoundContexts, createTicket,
  inspectionTemplates, createTemplate, inspectionRuns, inspectionRun, startRun,
  updateRunItem, uploadRunItemPhoto, createTicketFromItem, completeRun,
  getEquipmentByLocation, getEquipmentById,
  getTicketTimeline, ticketsList,
  getTicketsAnalyticsContext, getAnalyticsOverview,
}
export default api
