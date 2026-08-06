export type Role =
  | 'PLATFORM_ADMIN'
  | 'ADMIN'
  /** Если бэкенд отдаёт отдельное значение роли провайдера-админа */
  | 'ADMIN_PROVIDER'
  | 'DISPATCHER'
  | 'MASTER'
  | 'TECHNICIAN'
  | 'CLIENT'
  | 'TERRITORIAL_MANAGER'
  | 'NETWORK_DIRECTOR'
  | 'STAFF'

/** Полное админ-меню десктопа (сотрудники, справочники, точки) — только эти роли. */
export function isFullAdminDesktopNavRole(role?: Role | null): boolean {
  return role === 'PLATFORM_ADMIN' || role === 'ADMIN' || role === 'ADMIN_PROVIDER'
}

export type TicketStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'AWAITING_ACCEPTANCE' | 'DONE' | 'CANCELED'
export type TicketUrgency = 'URGENT' | 'NOT_URGENT'

/** SLA-приоритет окна ответа (срок от создания: NORMAL 24ч, URGENT 2ч на бэкенде). */
export type TicketPriority = 'NORMAL' | 'URGENT'

export type Me = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  phone?: string | null
  role: Role
  companyId: string
  companyName?: string | null
  isActive?: boolean
  /** Серверный флаг доступа к скрытому модулю Engineering Agent (owner-only). */
  canAccessEngineeringAgent?: boolean
  /** Если бэкенд добавит подсказку контура для техника — используем при мобильном входе без getLinkedClients */
  linkedClientCompanyId?: string | null
  linkedClientCompanyIds?: string[] | null
}

export type NotificationItem = {
  id: string
  companyId: string
  userId: string
  type: string
  title: string
  message: string
  entityType: string
  entityId: string
  linkedClientCompanyId?: string | null
  readAt?: string | null
  createdAt: string
}

export type NotificationsListResponse = {
  items: NotificationItem[]
  unreadCount: number
}

/**
 * Типы in-app уведомлений. Список выровнен под реальные `type:` события бэкенда
 * (notifications.service.ts + sla.worker.service.ts) — 13 типов. Расширять при добавлении на бэке.
 */
export type InAppNotificationType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.claimed'
  | 'ticket.status_changed'
  | 'ticket.category_changed'
  | 'ticket.assignment_requested'
  | 'ticket.awaiting_acceptance'
  | 'ticket.accepted'
  | 'ticket.rejected'
  | 'ticket.comment_added'
  | 'ticket.attachment_uploaded'
  | 'ticket.sla_warning'
  | (string & {})

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  'ticket.created': 'Заявка создана',
  'ticket.updated': 'Заявка обновлена',
  'ticket.assigned': 'Техник назначен',
  'ticket.claimed': 'Взята в работу',
  'ticket.status_changed': 'Статус изменён',
  'ticket.category_changed': 'Категория изменена',
  'ticket.assignment_requested': 'Запрос назначения',
  'ticket.awaiting_acceptance': 'Отправлена на приёмку',
  'ticket.accepted': 'Работа принята',
  'ticket.rejected': 'Работа не принята',
  'ticket.comment_added': 'Новый комментарий',
  'ticket.attachment_uploaded': 'Новое фото',
  'ticket.sla_warning': 'Скоро дедлайн',
}

/** Короткая метка типа для чипа в UI (fallback — сам type). */
export function getNotificationTypeLabel(type: string): string {
  const t = (type || '').trim()
  if (!t) return 'Уведомление'
  return NOTIFICATION_TYPE_LABELS[t] || t
}

/**
 * CSS-модификатор для `mobileNotifType--*`: ticketCreated | ticketAssigned | … | other
 */
export function getNotificationTypeTone(type: string): string {
  const map: Record<string, string> = {
    'ticket.created': 'ticketCreated',
    'ticket.updated': 'statusChanged',
    'ticket.assigned': 'ticketAssigned',
    'ticket.claimed': 'ticketClaimed',
    'ticket.status_changed': 'statusChanged',
    'ticket.category_changed': 'statusChanged',
    'ticket.assignment_requested': 'assignmentRequested',
    'ticket.awaiting_acceptance': 'statusChanged',
    'ticket.accepted': 'ticketClaimed',
    'ticket.rejected': 'slaOverdue',
    'ticket.comment_added': 'ticketCreated',
    'ticket.attachment_uploaded': 'ticketCreated',
    'ticket.sla_warning': 'slaWarning',
  }
  return map[(type || '').trim()] || 'other'
}

/** Дата/время уведомления: «Сегодня, 14:05» / «Вчера, …» / полная дата. */
export function formatNotificationDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diffDays = Math.round((sod(now) - sod(d)) / 86400000)
    const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 0) return `Сегодня, ${timeStr}`
    if (diffDays === 1) return `Вчера, ${timeStr}`
    if (d.getFullYear() !== now.getFullYear()) {
      return d.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
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

export type IdentityCompany = {
  id: string
  name: string
  legalName?: string | null
  brandName?: string | null
  type?: CompanyType | null
}

export type TicketActorIdentity = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  role?: Role | string | null
  companyId?: string | null
  company?: IdentityCompany | null
  phone?: string | null
}

export type PublicRequestDefaultType = 'REPAIR' | 'NOTE'
export type PublicRequestLocationPresetMode = 'HIDE_WHEN_VALID' | 'ALWAYS_OPTIONAL'
export type ServiceContractStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ENDED'
export type ServiceContractRole = 'PRIMARY' | 'SECONDARY'
export type ServiceContractLocationMode = 'ALL_LOCATIONS' | 'SELECTED_LOCATIONS' | 'INHERIT_PRIMARY'

export type ServiceContractItem = {
  id: string
  status: ServiceContractStatus
  role: ServiceContractRole
  locationMode: ServiceContractLocationMode
  effectiveLocationScope?: {
    mode: 'tenant_wide' | 'bound_locations' | 'restricted_empty'
    locationIds: string[]
  } | null
  locationSummary?: {
    mode: ServiceContractLocationMode
    totalLocations: number
    selectedLocations: number
    effectiveLocations: number
  }
  startsAt?: string | null
  endsAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  locations: Array<{
    locationId: string
    location: Pick<LocationListItem, 'id' | 'name' | 'address' | 'platformCode'>
  }>
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
  phone?: string | null
  role: Role
  isActive?: boolean
  isExecutor?: boolean
  deletedAt?: string | null
  createdAt?: string
  companyId?: string
  technicianSpecializations?: Array<{
    specialization: {
      id: string
      name: string
      isActive?: boolean
    }
  }>
  locationBindings?: Array<{
    companyId?: string
    locationId?: string
  }>
  accessScopes?: Array<{
    companyId?: string
    locationMode?: 'SELECTED_LOCATIONS' | 'RESTRICTED_EMPTY'
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
  deletedAt?: string | null
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
  phone?: string
  email: string
  password: string
  role: Role
}

export type UpdateUserInput = {
  firstName?: string
  lastName?: string
  avatarUrl?: string
  phone?: string
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
  locationScope: 'ALL_COMPANY_LOCATIONS' | 'SELECTED_LOCATIONS' | 'RESTRICTED_EMPTY'
  locationScopeMode: 'LEGACY_AUTO' | 'SELECTED_LOCATIONS' | 'RESTRICTED_EMPTY'
  bindingCount: number
  locations: LocationListItem[]
  categories: ProblemCategoryListItem[]
}

/** Первый clientCompany.id из bound-contexts — это linkedClientCompanyId для мобильного scope техника. */
export function pickFirstTechnicianBoundLinkedClientCompanyId(contexts: TechnicianBoundContext[]): string {
  for (const row of contexts || []) {
    const id = (row.clientCompany?.id || '').trim()
    if (id) return id
  }
  return ''
}

export type TechnicianLocationBindingsResponse = {
  companyId: string
  locationIds: string[]
  locationScope: 'ALL_COMPANY_LOCATIONS' | 'SELECTED_LOCATIONS' | 'RESTRICTED_EMPTY'
  locationScopeMode: 'LEGACY_AUTO' | 'SELECTED_LOCATIONS' | 'RESTRICTED_EMPTY'
  hasExplicitRestrictions: boolean
  availableLocations: LocationListItem[]
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
  firstName?: string | null
  lastName?: string | null
  role?: Role | string | null
  companyId?: string | null
  company?: IdentityCompany | null
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

export type SmartAssignResult = {
  assigned: boolean
  technicianId: string | null
  technicianName: string | null
  reason: string
  candidatesCount: number
  assignmentDecision?: {
    ticketId: string
    technicianId: string
    reason: string
    createdAt: string
  }
  ticket?: TicketGetOne
}

export type AssignmentDecisionItem = {
  ticketId: string
  technicianId: string | null
  candidatesCount: number
  reason: string
  createdAt: string
}

export type AssignmentCandidatesResponse = {
  ticketId: string | null
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
  /** Некоторые ответы API могут дублировать имя файла */
  filename?: string | null
  mimeType: string
  sizeBytes: number
  url: string
  /** Если появится в API — приоритетнее относительного `url` для скачивания */
  downloadUrl?: string | null
  path?: string | null
  purpose?: 'REQUEST' | 'WORK_REPORT' | string | null
  createdAt: string
  uploadedBy?: { id: string; email: string } | null
}

export type TicketCard = {
  id: string
  ticketNumber?: number
  companyId: string
  company?: IdentityCompany | null
  title: string
  status: TicketStatus
  urgency: TicketUrgency
  /** С бэкенда board; при отсутствии трактуем как NORMAL. */
  priority?: TicketPriority
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
  assignedTechnician: TicketActorIdentity | null
  /** Текст заявки (с board). */
  description?: string
  /** Имя заявителя, если есть (с board). */
  requesterName?: string | null
  /** Кто создал заявку (для честного фильтра «Мои заявки»). */
  createdByUserId?: string | null
  /** Кто создал заявку; расширено для display-only identity без изменения прав. */
  createdByUser?: TicketActorIdentity | null
  /** Дублируем id исполнителя отдельно от объекта исполнителя. */
  assignedTechnicianId?: string | null
  /** Для TECHNICIAN на board: согласовано с правилами claim по специализации (см. tickets.query.service). */
  canClaimByCurrentUser?: boolean
  /** Техник уже отправил запрос назначения по этой NEW-заявке (см. tickets.query.service). */
  assignmentRequestedByCurrentUser?: boolean
  /** Если бэкенд начнёт отдавать причину на доске — покажем на карточке без отдельного getTicket. */
  claimAvailabilityReason?: string | null
  /** Первое image-вложение (REQUEST приоритетнее) для превью на карточке. */
  attachmentPreviewUrl?: string | null
  /** Количество image-вложений на заявке. */
  imageAttachmentCount?: number
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
  /** Tenant заявки (у linked-client заявки — id клиента). Нужен для согласования scope мутаций. */
  companyId?: string | null
  company?: IdentityCompany | null
  ticketNumber?: number | null
  title?: string
  description?: string
  status: TicketStatus
  urgency: TicketUrgency
  priority: TicketPriority
  urgencyReason?: string | null
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
  assignedTechnician: TicketActorIdentity | null
  createdByUserId?: string | null
  createdByUser?: TicketActorIdentity | null
  parentId?: string | null
  parent?: {
    id: string
    problemText?: string | null
    status: TicketStatus
    createdAt: string
    location?: {
      id: string
      name: string
      platformCode?: string | null
      city?: string | null
      address?: string | null
    } | null
  } | null
  children?: Array<{
    id: string
    status: TicketStatus
    urgency: TicketUrgency
    priority?: TicketPriority
    slaDueAt?: string | null
    problemText?: string | null
    createdAt: string
    parentId?: string | null
    location?: {
      id: string
      name: string
      platformCode?: string | null
      city?: string | null
      address?: string | null
    } | null
    problemCategory?: {
      id: string
      name: string
    } | null
    assignedTechnician?: { id: string; email: string } | null
  }>
  meta?: {
    scopeCompanyId?: string
    visibilityMode?: 'tenant' | 'provider_primary' | 'platform_observer'
    canClaimByCurrentUser?: boolean
    claimAvailabilityReason?: string | null
    assignmentRequestedByCurrentUser?: boolean
    availableStatusTransitions?: TicketStatus[]
    /** Политика + воркфлоу: единый источник для кнопок (без хардкода прав на фронте). */
    availableActions?: {
      canClaim: boolean
      canStart: boolean
      canComplete: boolean
      canClose: boolean
      canAccept?: boolean
      canReject?: boolean
    }
    /** Подсказки, когда действие недоступно (ключи совпадают с availableActions). */
    availableActionHints?: Partial<{
      canClaim: string | null
      canStart: string | null
      canComplete: string | null
      canClose: string | null
      canAccept: string | null
      canReject: string | null
    }>
  }
}

export type TimelineItem = {
  at: string
  source: 'history' | 'event' | 'status_history' | 'domain_event'
  timelineEvent?: string | null
  domainType?: string
  type?: string
  title: string
  actor: TicketActorIdentity | null
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
  createMode?: 'quick' | 'full'
  postCreateAction?: 'leave_unassigned' | 'claim_self' | 'assign_employee'
  assignTechnicianId?: string | null
  equipmentId?: string | null
  categoryId: string
  urgency?: TicketUrgency
  priority?: TicketPriority
  urgencyReason?: string | null
  clientCompanyId?: string | null
  title?: string | null
  description?: string | null
  comment?: string | null
  attachmentIds?: string[]
  requesterName?: string | null
  requesterPhone?: string | null
  address?: string | null
  pointName?: string | null
  slaMinutes?: number | null
}

export type UpdateTicketInput = {
  problemCategoryId?: string
  locationId?: string
  equipmentId?: string | null
  problemText?: string
  urgency?: TicketUrgency
  requesterName?: string | null
  requesterPhone?: string | null
  address?: string | null
  pointName?: string | null
  comment?: string | null
}

export type CreateTicketResponse = {
  ticket: {
    id: string
    ticketNumber?: number | null
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

export type CreateChildTicketInput = {
  problemCategoryId: string
  problemText: string
  urgency?: TicketUrgency
  priority?: TicketPriority
  slaMinutes?: number
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

export type LocationAnalyticsItem = {
  locationId: string
  locationName: string
  city: string | null
  address: string | null
  totalTickets: number
  newTickets: number
  inProgressTickets: number
  doneTickets: number
  overdueTickets: number
  categories: Array<{
    categoryId: string
    categoryName: string
    ticketsCount: number
    overdueCount: number
  }>
}

export type LocationAnalyticsResponse = {
  items: LocationAnalyticsItem[]
  summary: {
    totalLocations: number
    totalTickets: number
    totalOverdue: number
    inProgressTotal: number
    doneTotal: number
  }
  meta?: {
    scopeCompanyId?: string
    visibilityMode?: string
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
  locationMode?: ServiceContractLocationMode
  startsAt?: string
  endsAt?: string
  notes?: string
  locationIds?: string[]
}

export type UpdateServiceContractInput = {
  clientCompanyId?: string
  providerCompanyId?: string
  status?: ServiceContractStatus
  role?: ServiceContractRole
  locationMode?: ServiceContractLocationMode
  startsAt?: string | null
  endsAt?: string | null
  notes?: string | null
  locationIds?: string[]
}

const BASE_URL_KEY = 'sm_base_url'
const TOKEN_KEY = 'sm_token'
const COMPANY_LABEL_KEY = 'sm_company_label'
const USER_ROLE_KEY = 'sm_user_role'
const LAST_SCOPE_KEY = 'sm_last_scope'
const SCOPE_OWNER_USER_ID_KEY = 'sm_scope_owner_user_id'
const SCOPE_OWNER_COMPANY_ID_KEY = 'sm_scope_owner_company_id'
const SCOPE_OWNER_ROLE_KEY = 'sm_scope_owner_role'
const PLATFORM_BACKUP_KEY = 'platform_access_token_backup'
const PLATFORM_BACKUP_ROLE_KEY = 'platform_user_role_backup'
const PLATFORM_BACKUP_COMPANY_LABEL_KEY = 'platform_company_label_backup'
const IMPERSONATION_META_KEY = 'impersonation_meta'

// Current local Docker backend runtime
const FALLBACK_API_BASE_URL = 'http://localhost:3000'

export type ImpersonationMeta = {
  companyId: string
  companyName: string
  startedAt: string
}

type ScopeOwner = {
  userId?: string
  companyId?: string
  role?: Role | string
}

type PersistedScope = TicketScopeParams & {
  ownerUserId?: string
  ownerCompanyId?: string
  ownerRole?: Role | string
}

function readBaseUrl(): string {
  const envBaseUrl = resolveEnvApiBaseUrl()
  if (typeof window === 'undefined') return envBaseUrl
  if (canUseManualBackendConfig()) {
    return normalizeBaseUrl(localStorage.getItem(BASE_URL_KEY) || envBaseUrl)
  }
  return envBaseUrl
}

function normalizeBaseUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '')
}

function resolveEnvApiBaseUrl(): string {
  const fromEnv = normalizeBaseUrl(String(import.meta.env.VITE_API_BASE_URL || ''))
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeBaseUrl(window.location.origin)
  }
  return FALLBACK_API_BASE_URL
}

export function canUseManualBackendConfig(): boolean {
  return !!import.meta.env.DEV
}

export function getBaseUrl(): string {
  return normalizeBaseUrl(readBaseUrl()) || FALLBACK_API_BASE_URL
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

/** Абсолютный URL файла вложения тикета с JWT-токеном в query (?token=) для <img> тегов. */
export function resolveTicketAttachmentUrl(
  attachment: {
    url?: string | null
    downloadUrl?: string | null
    path?: string | null
  },
): string {
  const raw =
    (typeof attachment.downloadUrl === 'string' && attachment.downloadUrl.trim()) ||
    (typeof attachment.url === 'string' && attachment.url.trim()) ||
    (typeof attachment.path === 'string' && attachment.path.trim()) ||
    ''
  const base = resolveFileUrl(raw)
  if (!base.includes('/uploads/ticket-attachments/')) return base
  return appendUploadToken(base)
}

/** Абсолютный URL файла вложения чек-листа с JWT-токеном в query (?token=) для <img> тегов. */
export function resolveInspectionAttachmentUrl(
  attachment: {
    url?: string | null
  },
): string {
  const raw = (typeof attachment.url === 'string' && attachment.url.trim()) || ''
  const base = resolveFileUrl(raw)
  if (!base.includes('/uploads/inspection-run-items/')) return base
  return appendUploadToken(base)
}

/** Appends ?token=<jwt> to a protected /uploads/* URL. Safe to call on already-signed URLs. */
function appendUploadToken(base: string): string {
  const token = getToken()
  if (!token) return base
  try {
    const parsed = new URL(base)
    parsed.searchParams.set('token', token)
    return parsed.toString()
  } catch {
    return base
  }
}

export function isProtectedUploadUrl(url: string): boolean {
  return url.includes('/uploads/ticket-attachments/') || url.includes('/uploads/inspection-run-items/')
}

/** Loads a protected upload with Authorization header when <img> cannot render it. */
export async function fetchProtectedUploadBlob(url: string): Promise<Blob | null> {
  const token = getToken()
  if (!token || !url) return null

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
    if (!response.ok) return null
    return await response.blob()
  } catch {
    return null
  }
}

export function setBaseUrl(url: string) {
  if (typeof window === 'undefined') return
  if (!canUseManualBackendConfig()) return
  const normalized = normalizeBaseUrl(url)
  if (!normalized) {
    localStorage.removeItem(BASE_URL_KEY)
    return
  }
  localStorage.setItem(BASE_URL_KEY, normalized)
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
  const backupCompanyLabel = localStorage.getItem(PLATFORM_BACKUP_COMPANY_LABEL_KEY) || 'Сервис Менеджер'

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
  // НЕ чистим persisted scope (sm_last_scope) при logout/истечении токена — дефолтный контур
  // должен переживать перезаход (вариант «дефолт на устройстве»). Безопасно: ключ owner-keyed
  // (ownerUserId/ownerCompanyId) → у другого пользователя ownerMatches не сойдётся → его дефолт [0].
  // Явная очистка дефолта осталась: снятие галочки «по умолчанию» (clearPersistedScope),
  // hard-reset /logout (LogoutAndRedirect) и QA `?clear=1` — там localStorage.clear() намеренный.
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
  const resolvedRole = role || getUserRole()
  if (resolvedRole === 'PLATFORM_ADMIN') return '/companies'
  if (resolvedRole === 'TECHNICIAN') return '/m'
  return '/board'
}

/** Клиентские роли: linked-scope в URL для них не используется как у провайдера. */
export function isClientRole(role?: string | null): boolean {
  return role === 'CLIENT' || role === 'NETWORK_DIRECTOR'
}

/** Провайдерские роли: ручное назначение техника с мобильной главной (PUT /tickets/:id/assign/:technicianId). */
export function isProviderTicketAssignRole(role?: string | null): boolean {
  return (
    role === 'ADMIN' ||
    role === 'ADMIN_PROVIDER' ||
    role === 'DISPATCHER' ||
    role === 'MASTER' ||
    role === 'STAFF'
  )
}

/**
 * SMA-ACCEPTANCE-ROLE-GAP-001: client-company management roles allowed to accept/reject work.
 * Must be combined with a client-company (tenant) check at the call site — the CLIENT requester
 * and all provider-side roles are excluded.
 */
export function isClientAcceptanceRole(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'TERRITORIAL_MANAGER' || role === 'NETWORK_DIRECTOR'
}

/** Мобильная главная: полевые действия (взять/начать/закрыть) — только TECHNICIAN (POST /claim и start/done на бэкенде). */
export function allowMobileHomeFieldTicketActions(role?: Role | string | null): boolean {
  return role === 'TECHNICIAN'
}

/** Основное действие техника на карточке заявки (мобильная деталка). */
export function mobileTechnicianTicketPrimaryAction(
  ticket: Pick<TicketGetOne, 'status' | 'assignedTechnicianId' | 'assignedTechnician'>,
  meUserId: string | undefined,
): 'claim' | 'start' | null {
  if (!meUserId) return null
  const assigneeId = (ticket.assignedTechnicianId || ticket.assignedTechnician?.id || '').trim() || null
  if (ticket.status === 'NEW' && !assigneeId) return 'claim'
  if (ticket.status === 'ASSIGNED' && assigneeId === meUserId) return 'start'
  return null
}

/**
 * Роли провайдера: при выборе «мобильная версия» на /login запрашиваем getLinkedClients(),
 * выбираем дефолтного linked-клиента и кладём linkedClientCompanyId в scope/URL.
 * TECHNICIAN сюда не входит — для техника linked только из persisted/URL (без getLinkedClients).
 */
export function shouldFetchDefaultLinkedClientOnMobileEntry(role?: Role | string | null): boolean {
  if (!role) return false
  return (
    role === 'ADMIN' ||
    role === 'ADMIN_PROVIDER' ||
    role === 'MASTER' ||
    role === 'DISPATCHER' ||
    role === 'TERRITORIAL_MANAGER' ||
    role === 'STAFF'
  )
}

/** Linked-клиент из профиля `/auth/me` (без запроса service-contracts). */
export function getLinkedClientCompanyIdFromMe(me?: Pick<Me, 'linkedClientCompanyId' | 'linkedClientCompanyIds'> | null): string {
  if (!me) return ''
  const single = typeof me.linkedClientCompanyId === 'string' ? me.linkedClientCompanyId.trim() : ''
  if (single) return single
  const ids = me.linkedClientCompanyIds
  if (Array.isArray(ids)) {
    for (const raw of ids) {
      const id = typeof raw === 'string' ? raw.trim() : ''
      if (id) return id
    }
  }
  return ''
}

export type TechnicianMobileLinkedSource = 'persisted' | 'me' | 'none'

/**
 * Для TECHNICIAN: только persisted/URL scope и поля me — без getLinkedClients.
 * Приоритет: явный postLoginScope → localStorage scope для owner → поля me.
 */
export function resolveTechnicianMobileLinkedClientCompanyId(params: {
  profile: Me
  postLoginScope: TicketScopeParams
}): { linkedClientCompanyId: string; source: TechnicianMobileLinkedSource } {
  const owner: ScopeOwner = {
    userId: params.profile.id,
    companyId: params.profile.companyId,
    role: params.profile.role,
  }
  const fromExplicit = (params.postLoginScope.linkedClientCompanyId || '').trim()
  if (fromExplicit) {
    return { linkedClientCompanyId: fromExplicit, source: 'persisted' }
  }
  const fromStorage = getLinkedClientCompanyId(owner).trim()
  if (fromStorage) {
    return { linkedClientCompanyId: fromStorage, source: 'persisted' }
  }
  const fromMe = getLinkedClientCompanyIdFromMe(params.profile).trim()
  if (fromMe) {
    return { linkedClientCompanyId: fromMe, source: 'me' }
  }
  return { linkedClientCompanyId: '', source: 'none' }
}

/** Дефолтный linked-клиент для мобильного входа: только id из ответа API. ACTIVE+PRIMARY → ACTIVE → первый элемент. */
export function pickDefaultLinkedClientCompanyId(contracts: LinkedClientSummary[]): string {
  if (!contracts?.length) return ''
  const activePrimary = contracts.find((c) => c.status === 'ACTIVE' && c.role === 'PRIMARY')
  if (activePrimary?.clientCompany?.id) return activePrimary.clientCompany.id.trim()
  const firstActive = contracts.find((c) => c.status === 'ACTIVE')
  if (firstActive?.clientCompany?.id) return firstActive.clientCompany.id.trim()
  return (contracts[0]?.clientCompany?.id || '').trim()
}

function readPersistedScope(): PersistedScope | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LAST_SCOPE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedScope
  } catch {
    return null
  }
}

function readScopeOwnerContext(): ScopeOwner {
  if (typeof window === 'undefined') return {}
  return {
    userId: localStorage.getItem(SCOPE_OWNER_USER_ID_KEY) || undefined,
    companyId: localStorage.getItem(SCOPE_OWNER_COMPANY_ID_KEY) || undefined,
    role: localStorage.getItem(SCOPE_OWNER_ROLE_KEY) || undefined,
  }
}

/**
 * Приводит owner к ScopeOwner с userId. Колл-сайты передают объект Me (поле `id`, не `userId`),
 * поэтому маппим `id → userId` в одной точке — иначе persist-гард `!resolvedOwner.userId` молча
 * глотает запись в sm_last_scope (контур/галочка «не сохраняются»). Делается тут, чтобы не править 9 колл-сайтов.
 */
function coerceScopeOwner(owner?: ScopeOwner): ScopeOwner | undefined {
  if (!owner) return undefined
  return {
    userId: owner.userId || (owner as { id?: string }).id || undefined,
    companyId: owner.companyId,
    role: owner.role,
  }
}

function ownerMatches(owner?: ScopeOwner, persisted?: PersistedScope | null): boolean {
  if (!owner?.companyId || !persisted?.ownerCompanyId) return false
  if (owner.companyId !== persisted.ownerCompanyId) return false
  if (owner.userId && persisted.ownerUserId && owner.userId !== persisted.ownerUserId) return false
  return true
}

function normalizeScopeForOwner(scope: TicketScopeParams, owner?: ScopeOwner): TicketScopeParams {
  if (isClientRole(owner?.role || null)) {
    return { companyId: scope.companyId }
  }
  return scope
}

function getStoredScopeForOwner(owner?: ScopeOwner): TicketScopeParams {
  const resolvedOwner = coerceScopeOwner(owner) || readScopeOwnerContext()
  const persisted = readPersistedScope()
  if (!ownerMatches(resolvedOwner, persisted)) return {}
  return normalizeScopeForOwner(
    {
      linkedClientCompanyId: persisted?.linkedClientCompanyId || undefined,
      companyId: persisted?.companyId || undefined,
    },
    resolvedOwner,
  )
}

export function syncScopeOwnerProfile(user?: Pick<Me, 'id' | 'companyId' | 'role'> | null) {
  if (typeof window === 'undefined') return
  if (!user?.id || !user.companyId) {
    localStorage.removeItem(SCOPE_OWNER_USER_ID_KEY)
    localStorage.removeItem(SCOPE_OWNER_COMPANY_ID_KEY)
    localStorage.removeItem(SCOPE_OWNER_ROLE_KEY)
    return
  }
  localStorage.setItem(SCOPE_OWNER_USER_ID_KEY, user.id)
  localStorage.setItem(SCOPE_OWNER_COMPANY_ID_KEY, user.companyId)
  localStorage.setItem(SCOPE_OWNER_ROLE_KEY, user.role)
}

export function clearPersistedScope() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LAST_SCOPE_KEY)
  localStorage.removeItem(SCOPE_OWNER_USER_ID_KEY)
  localStorage.removeItem(SCOPE_OWNER_COMPANY_ID_KEY)
  localStorage.removeItem(SCOPE_OWNER_ROLE_KEY)
}

export function restoreScopeForUser(user?: Pick<Me, 'id' | 'companyId' | 'role'> | null): TicketScopeParams {
  if (!user?.id || !user.companyId) {
    clearPersistedScope()
    return {}
  }
  const owner: ScopeOwner = { userId: user.id, companyId: user.companyId, role: user.role }
  const persisted = readPersistedScope()
  if (!ownerMatches(owner, persisted)) {
    localStorage.removeItem(LAST_SCOPE_KEY)
    syncScopeOwnerProfile(user)
    return {}
  }
  syncScopeOwnerProfile(user)
  return normalizeScopeForOwner(
    {
      linkedClientCompanyId: persisted?.linkedClientCompanyId || undefined,
      companyId: persisted?.companyId || undefined,
    },
    owner,
  )
}

export function getLinkedClientCompanyId(owner?: ScopeOwner): string {
  if (typeof window === 'undefined') return ''
  const fromUrl = new URLSearchParams(window.location.search).get('linkedClientCompanyId') || ''
  if (fromUrl.trim()) return fromUrl.trim()
  return (getStoredScopeForOwner(owner).linkedClientCompanyId || '').trim()
}

/**
 * Сохранён ли контур «по умолчанию» в localStorage (без учёта URL-параметра) для владельца.
 * Используется галочкой «контур по умолчанию» — переиспользует тот же персист (LAST_SCOPE_KEY).
 */
export function getPersistedLinkedClientCompanyId(owner?: ScopeOwner): string {
  if (typeof window === 'undefined') return ''
  return (getStoredScopeForOwner(owner).linkedClientCompanyId || '').trim()
}

export function getObserverCompanyId(owner?: ScopeOwner): string {
  if (typeof window === 'undefined') return ''
  const fromUrl = new URLSearchParams(window.location.search).get('companyId') || ''
  if (fromUrl.trim()) return fromUrl.trim()
  return (getStoredScopeForOwner(owner).companyId || '').trim()
}

export function persistScopeFromSearchParams(search: URLSearchParams, owner?: ScopeOwner) {
  if (typeof window === 'undefined') return
  const resolvedOwner = coerceScopeOwner(owner) || readScopeOwnerContext()
  if (!resolvedOwner.userId || !resolvedOwner.companyId) return
  const normalized = normalizeScopeForOwner(
    {
      linkedClientCompanyId: (search.get('linkedClientCompanyId') || '').trim() || undefined,
      companyId: (search.get('companyId') || '').trim() || undefined,
    },
    resolvedOwner,
  )
  const linkedClientCompanyId = normalized.linkedClientCompanyId || ''
  const companyId = normalized.companyId || ''
  if (!linkedClientCompanyId && !companyId) return
  localStorage.setItem(
    LAST_SCOPE_KEY,
    JSON.stringify({
      linkedClientCompanyId,
      companyId,
      ownerUserId: resolvedOwner.userId,
      ownerCompanyId: resolvedOwner.companyId,
      ownerRole: resolvedOwner.role,
    } satisfies PersistedScope),
  )
}

export function getScopeSearchSuffix(scope?: TicketScopeParams, owner?: ScopeOwner): string {
  const resolvedScope: TicketScopeParams = scope || {
    linkedClientCompanyId: getLinkedClientCompanyId(owner) || undefined,
    companyId: getObserverCompanyId(owner) || undefined,
  }
  const search = new URLSearchParams()
  if (resolvedScope.linkedClientCompanyId) search.set('linkedClientCompanyId', resolvedScope.linkedClientCompanyId)
  if (resolvedScope.companyId) search.set('companyId', resolvedScope.companyId)
  const suffix = search.toString()
  return suffix ? `?${suffix}` : ''
}

export function appendScopeToPath(path: string, scope?: TicketScopeParams, owner?: ScopeOwner): string {
  const suffix = getScopeSearchSuffix(scope, owner)
  if (!suffix) return path
  return `${path}${path.includes('?') ? '&' : '?'}${suffix.slice(1)}`
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

/** Ошибка HTTP API с кодом ответа (для дружелюбных сообщений на мобилке). */
export class ApiRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    Object.setPrototypeOf(this, new.target.prototype)
  }
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

    throw new ApiRequestError(message, res.status)
  }

  return data as T
}

function normalizeArrayResponse<T>(payload: unknown, candidates: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  for (const key of candidates) {
    const value = record[key]
    if (Array.isArray(value)) return value as T[]
  }
  return []
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

export async function fetchNotifications(): Promise<NotificationsListResponse> {
  return request<NotificationsListResponse>('/notifications')
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  })
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean; updated: number }> {
  return request<{ ok: boolean; updated: number }>('/notifications/read-all', {
    method: 'PATCH',
  })
}

// --- Push-уведомления (Web Push) ---------------------------------------------
// Контракт см. docs/PUSH_NOTIFICATIONS_ARCHITECTURE_V1.md §4.2.
// Эндпоинтов пока нет на бэкенде (backend — shared zone, отдельный раунд согласования).
// Фронт написан "вперёд" под точный контракт — при появлении бэкенда изменений не требуется.

export type PushPreference = {
  chat: boolean
  ticketNew: boolean
  assignment: boolean
  statusChange: boolean
  acceptance: boolean
  acceptanceReject: boolean
  sla: boolean
  news: boolean
  quietHoursFrom?: number | null
  quietHoursTo?: number | null
}

export async function getPushVapidPublicKey(): Promise<{ key: string }> {
  return request<{ key: string }>('/push/vapid-public-key')
}

export async function subscribeToPushBackend(input: {
  endpoint: string
  keys: { p256dh: string; auth: string }
  platform?: string
  declarative?: boolean
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/push/subscriptions', {
    method: 'POST',
    body: input,
  })
}

export async function unsubscribeFromPushBackend(endpoint: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/push/subscriptions', {
    method: 'DELETE',
    body: { endpoint },
  })
}

export async function pushSubscriptionHeartbeat(endpoint: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/push/subscriptions/heartbeat', {
    method: 'POST',
    body: { endpoint },
  })
}

export async function getPushPreferences(): Promise<PushPreference> {
  return request<PushPreference>('/push/preferences')
}

export async function updatePushPreferences(patch: Partial<PushPreference>): Promise<PushPreference> {
  return request<PushPreference>('/push/preferences', {
    method: 'PATCH',
    body: patch,
  })
}

export async function sendTestPush(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/push/test', { method: 'POST' })
}

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  return request<UserListItem>('/users', {
    method: 'POST',
    body: input,
  })
}

export async function users(companyId?: string, opts?: { q?: string; includeDeleted?: boolean }): Promise<UserListItem[]> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  if (opts?.q) search.set('q', opts.q)
  if (opts?.includeDeleted) search.set('includeDeleted', 'true')
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

export async function deleteUser(userId: string): Promise<UserListItem> {
  return request<UserListItem>(`/users/${userId}`, {
    method: 'DELETE',
  })
}

export async function restoreUser(userId: string): Promise<UserListItem> {
  return request<UserListItem>(`/users/${userId}/restore`, {
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

export async function deleteSpecialization(id: string): Promise<void> {
  await request<unknown>(`/specializations/${id}`, {
    method: 'DELETE',
  })
}

/** `companyId` — query для GET /problem-categories: tenant, чьи категории нужны (у провайдера в linked-scope это id клиента). */
export async function problemCategories(companyId?: string): Promise<ProblemCategoryListItem[]> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? '?' + search.toString() : ''
  const response = await request<unknown>('/problem-categories' + suffix)
  return normalizeArrayResponse<ProblemCategoryListItem>(response, [
    'items',
    'problemCategories',
    'categories',
    'data',
  ])
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

export async function deleteProblemCategory(id: string): Promise<void> {
  await request<unknown>(`/problem-categories/${id}`, {
    method: 'DELETE',
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

export async function getTechnicianBoundContexts(linkedClientCompanyId?: string): Promise<TechnicianBoundContext[]> {
  const search = new URLSearchParams()
  const linked = (linkedClientCompanyId ?? '').trim()
  if (linked) search.set('linkedClientCompanyId', linked)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<TechnicianBoundContext[]>(`/technicians/me/bound-contexts${suffix}`)
}

export async function getTechnicianLocationBindings(
  userId: string,
  params?: { companyId?: string },
): Promise<TechnicianLocationBindingsResponse> {
  const search = new URLSearchParams()
  if (params?.companyId) search.set('companyId', params.companyId)
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<TechnicianLocationBindingsResponse>(`/technicians/${userId}/location-bindings${suffix}`)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function setTechnicianLocationBindings(
  userId: string,
  payload: { companyId?: string; locationIds: string[] },
): Promise<TechnicianLocationBindingsResponse> {
  const normalizedCompanyId = (payload.companyId ?? '').trim()
  const body: { companyId?: string; locationIds: string[] } = {
    locationIds: payload.locationIds,
  }
  if (normalizedCompanyId && isUuid(normalizedCompanyId)) {
    body.companyId = normalizedCompanyId
  }
  return request<TechnicianLocationBindingsResponse>(`/technicians/${userId}/location-bindings`, {
    method: 'PUT',
    body,
  })
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

// ── Permissions (read-only catalog/matrix; PLATFORM_ADMIN) ─────────────────────
export type PermissionCatalogItem = {
  code: string
  name: string
  category: string
  description?: string | null
  businessLabel?: string
  productDomain?: string
  riskLevel?: 'low' | 'medium' | 'high'
  recommendedRoles?: string[]
}

export type PermissionMatrixEntry = {
  role: string
  companyType: 'CLIENT' | 'PROVIDER' | null
  permissions: string[]
}

export async function fetchPermissionCatalog(): Promise<PermissionCatalogItem[]> {
  const res = await request<{ blocks: PermissionCatalogItem[] }>('/permissions/catalog')
  return res.blocks || []
}

export async function fetchPermissionMatrix(): Promise<PermissionMatrixEntry[]> {
  const res = await request<{ roles: PermissionMatrixEntry[] }>('/permissions/matrix')
  return res.roles || []
}

export type PermissionMatrixChange = {
  role: string
  companyType: 'CLIENT' | 'PROVIDER' | null
  add: string[]
  remove: string[]
}

/** PATCH /permissions/matrix — применить add/remove дельты (PLATFORM_ADMIN). Возвращает обновлённую матрицу. */
export async function applyPermissionChanges(changes: PermissionMatrixChange[]): Promise<PermissionMatrixEntry[]> {
  const res = await request<{ roles: PermissionMatrixEntry[] }>('/permissions/matrix', {
    method: 'PATCH',
    body: { changes },
  })
  return res.roles || []
}

// ── Access Constructor V1 endpoints ─────────────────────────────────────────
export type AccessConstructorCompany = {
  id: string
  name: string
  type: CompanyType
}

export type AccessConstructorUser = UserListItem & {
  companyId?: string
}

export type AccessPermissionMeta = {
  code: string
  name: string
  description?: string | null
}

export type AccessPermissionEntry = AccessPermissionMeta & {
  source: 'role' | 'override'
}

export type AccessConstructorListEntry = {
  user: AccessConstructorUser
  permissions: {
    roleCodes: string[]
    overrideCodes: string[]
    effectiveCodes: string[]
    counts: {
      role: number
      overrides: number
      effective: number
    }
  }
}

export type AccessConstructorUsersResponse = {
  company: AccessConstructorCompany
  users: AccessConstructorListEntry[]
}

export type AccessLocationMode = 'LEGACY_AUTO' | 'SELECTED_LOCATIONS' | 'RESTRICTED_EMPTY'
export type AccessIssueFlag = 'no_locations' | 'stale_bindings' | 'elevated_overrides' | 'restricted_empty' | string

export type AccessSummaryEntry = {
  user: AccessConstructorUser
  role: Role
  company: AccessConstructorCompany
  companyType: CompanyType
  isActive: boolean
  additiveOverrideCount: number
  effectiveLocationBindingCount: number
  staleBindingCount: number
  availableClientContourCount: number
  accessibleCompanyCount: number
  accessibleLocationCount: number
  locationMode: AccessLocationMode
  ticketVisibilityMode: string
  issueFlags: AccessIssueFlag[]
  permissions: {
    roleCodes: string[]
    overrideCodes: string[]
    effectiveCodes: string[]
  }
}

export type AccessSummaryResponse = {
  company: AccessConstructorCompany
  page: {
    total: number
    skip: number
    take: number
  }
  users: AccessSummaryEntry[]
}

export type AccessSummaryQuery = {
  companyId?: string
  q?: string
  role?: string
  status?: 'active' | 'inactive' | ''
  issue?: string
  skip?: number
  take?: number
}

export type AccessEffectivePermissionsResponse = {
  company: AccessConstructorCompany
  user: AccessConstructorUser
  permissions: {
    role: AccessPermissionEntry[]
    overrides: AccessPermissionEntry[]
    effective: AccessPermissionEntry[]
    codes: {
      role: string[]
      overrides: string[]
      effective: string[]
    }
  }
}

export type AccessUserOverridesResponse = {
  company: AccessConstructorCompany
  user: AccessConstructorUser
  overrides: AccessPermissionMeta[]
  codes: string[]
  count: number
}

export type AccessClientContour = {
  id: string
  name: string
  type: CompanyType
  serviceContractId: string | null
  role: ServiceContractRole | 'OWN_CLIENT'
  status: string
}

export type AccessClientContoursResponse = {
  company: AccessConstructorCompany
  contours: AccessClientContour[]
  count: number
}

export type AccessLocationBinding = {
  id: string
  companyId: string
  locationId: string
  createdAt: string
  location: {
    id: string
    clientCompanyId: string
    name: string
    platformCode: string
    city?: string | null
    region?: string | null
    address?: string | null
    isActive: boolean
    deletedAt?: string | null
  }
}

export type AccessLocationBindingsResponse = {
  company: AccessConstructorCompany
  user: AccessConstructorUser
  bindings: AccessLocationBinding[]
  count: number
  staleBindings: AccessLocationBinding[]
  staleCount: number
  locationMode: AccessLocationMode
  explicitLocationMode?: Exclude<AccessLocationMode, 'LEGACY_AUTO'> | null
  emptyBindingSemantics: string
}

export type AccessPreviewResponse = {
  company: AccessConstructorCompany
  user: AccessConstructorUser
  baseRole: Role
  companyType: CompanyType
  permissions: {
    effectiveCodes: string[]
    roleCodes: string[]
    userAdditiveOverrideCodes: string[]
  }
  locationBindings: {
    mode: 'legacy_auto' | 'restricted_empty' | 'bound_locations' | string
    locationMode: AccessLocationMode
    explicitMode?: Exclude<AccessLocationMode, 'LEGACY_AUTO'> | null
    selected: AccessLocationBinding[]
    selectedCount: number
    stale: AccessLocationBinding[]
    staleCount: number
    emptyBindingSemantics: string
  }
  availableLinkedClientContours: AccessClientContour[]
  estimates: {
    accessibleCompanyCount: number
    accessibleLocationCount: number
  }
  ticketVisibilityMode: string
}

export type AccessDraftPreviewResponse = {
  company: AccessConstructorCompany
  user: AccessConstructorUser
  current: {
    additiveOverrideCount: number
    locationCount: number
    companyCount: number
    ticketVisibilityMode: string
  }
  proposed: {
    additiveOverrideCount: number
    locationCount: number
    companyCount: number
    ticketVisibilityMode: string
  }
  addedCapabilities: string[]
  removedCapabilities: string[]
  invalidSelections: string[]
  warnings: string[]
  saveRejected: boolean
  saveBlockers: Array<{
    code: string
    message: string
    minimumMigration?: string
  }>
  preview: AccessPreviewResponse
}

export type AccessLocationOption = {
  id: string
  displayName: string
  name: string
  platformCode: string
  region?: string | null
  address?: string | null
  active: boolean
  available: boolean
}

export type AccessLocationOptionsResponse = {
  company: AccessConstructorCompany
  clients: Array<{
    client: AccessClientContour
    cities: Array<{
      city: string
      locations: AccessLocationOption[]
    }>
  }>
}

export type AccessLocationBindingGroup =
  | { mode: 'REPLACE_SELECTED'; clientCompanyId: string; locationIds: string[] }
  | { mode: 'CLEAR_RESTRICTED_EMPTY'; clientCompanyId?: string }
  | { mode: 'NO_CHANGE'; clientCompanyId?: string }

function withCompanyScope(path: string, companyId?: string): string {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? '?' + search.toString() : ''
  return path + suffix
}

function withQuery(path: string, params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const suffix = search.toString() ? '?' + search.toString() : ''
  return path + suffix
}

export async function fetchAccessConstructorUsers(companyId?: string): Promise<AccessConstructorUsersResponse> {
  return request<AccessConstructorUsersResponse>(withCompanyScope('/permissions/users', companyId))
}

export async function fetchAccessSummary(query: AccessSummaryQuery = {}): Promise<AccessSummaryResponse> {
  return request<AccessSummaryResponse>(
    withQuery('/permissions/users/access-summary', {
      companyId: query.companyId,
      q: query.q,
      role: query.role,
      status: query.status,
      issue: query.issue,
      skip: query.skip,
      take: query.take,
    }),
  )
}

export async function fetchAccessEffectivePermissions(
  userId: string,
  companyId?: string,
): Promise<AccessEffectivePermissionsResponse> {
  return request<AccessEffectivePermissionsResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/effective`, companyId),
  )
}

export async function fetchAccessUserOverrides(userId: string, companyId?: string): Promise<AccessUserOverridesResponse> {
  return request<AccessUserOverridesResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/overrides`, companyId),
  )
}

export async function grantAccessUserPermissions(
  userId: string,
  codes: string[],
  companyId?: string,
): Promise<AccessEffectivePermissionsResponse> {
  return request<AccessEffectivePermissionsResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/permissions`, companyId),
    {
      method: 'POST',
      body: { codes },
    },
  )
}

export async function removeAccessUserPermissions(
  userId: string,
  codes: string[],
  companyId?: string,
): Promise<AccessEffectivePermissionsResponse> {
  return request<AccessEffectivePermissionsResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/permissions/remove`, companyId),
    {
      method: 'POST',
      body: { codes },
    },
  )
}

export async function fetchAccessLocationBindings(
  userId: string,
  companyId?: string,
): Promise<AccessLocationBindingsResponse> {
  return request<AccessLocationBindingsResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/location-bindings`, companyId),
  )
}

export type AccessLocationBindingsInput = {
  locationIds: string[]
  clientCompanyId?: string
}

export async function replaceAccessLocationBindings(
  userId: string,
  input: AccessLocationBindingsInput,
  companyId?: string,
): Promise<AccessLocationBindingsResponse> {
  return request<AccessLocationBindingsResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/location-bindings`, companyId),
    {
      method: 'PUT',
      body: input,
    },
  )
}

export async function replaceAllAccessLocationBindings(
  userId: string,
  groups: AccessLocationBindingGroup[],
  companyId?: string,
): Promise<AccessLocationBindingsResponse> {
  return request<AccessLocationBindingsResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/location-bindings/all`, companyId),
    {
      method: 'PUT',
      body: { groups },
    },
  )
}

export async function removeAccessLocationBindings(
  userId: string,
  input: AccessLocationBindingsInput,
  companyId?: string,
): Promise<AccessLocationBindingsResponse> {
  return request<AccessLocationBindingsResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/location-bindings/remove`, companyId),
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function fetchAccessClientContours(companyId?: string): Promise<AccessClientContoursResponse> {
  return request<AccessClientContoursResponse>(withCompanyScope('/permissions/client-contours', companyId))
}

export async function fetchAccessPreview(userId: string, companyId?: string): Promise<AccessPreviewResponse> {
  return request<AccessPreviewResponse>(withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/preview`, companyId))
}

export async function fetchAccessDraftPreview(
  userId: string,
  input: {
    additivePermissionCodes?: string[]
    locationIds?: string[]
    selectedClientContourIds?: string[]
  },
  companyId?: string,
): Promise<AccessDraftPreviewResponse> {
  return request<AccessDraftPreviewResponse>(
    withCompanyScope(`/permissions/users/${encodeURIComponent(userId)}/preview-draft`, companyId),
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function fetchAccessLocationOptions(
  clientCompanyIds: string[],
  companyId?: string,
): Promise<AccessLocationOptionsResponse> {
  return request<AccessLocationOptionsResponse>(
    withQuery('/permissions/location-options', {
      companyId,
      clientCompanyIds: clientCompanyIds.join(','),
    }),
  )
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

/** `companyId` — query для GET /locations: tenant локаций (у провайдера в linked-scope это id клиента). */
export async function locations(companyId?: string, opts?: { includeDeleted?: boolean }): Promise<LocationListItem[]> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  if (opts?.includeDeleted) search.set('includeDeleted', 'true')
  const suffix = search.toString() ? '?' + search.toString() : ''
  const response = await request<unknown>('/locations' + suffix)
  return normalizeArrayResponse<LocationListItem>(response, [
    'items',
    'locations',
    'data',
  ])
}

/**
 * `companyId` — query для POST /locations: контур клиента, которому принадлежит точка.
 * У провайдера в linked-scope это id выбранного клиента; для клиента — не передаётся (свой tenant).
 * Бэкенд резолвит владельца как CLIENT (см. SMA-P0-CREATE-TICKET-DATA-CONSISTENCY-001).
 */
export async function createLocation(input: CreateLocationInput, companyId?: string): Promise<LocationListItem> {
  const suffix = companyId ? '?companyId=' + encodeURIComponent(companyId) : ''
  return request<LocationListItem>('/locations' + suffix, {
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

export async function deleteLocation(id: string): Promise<LocationListItem> {
  return request<LocationListItem>(`/locations/${id}`, {
    method: 'DELETE',
  })
}

export async function restoreLocation(id: string): Promise<LocationListItem> {
  return request<LocationListItem>(`/locations/${id}/restore`, {
    method: 'PATCH',
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
  includeArchived?: boolean
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
  if (params?.includeArchived) {
    search.set('includeArchived', 'true')
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<BoardResponse>(`/tickets/board${suffix}`)
}

export async function tickets(): Promise<any[]> {
  return request<any[]>('/tickets')
}

export async function availableTickets(linkedClientCompanyId?: string): Promise<any[]> {
  const search = new URLSearchParams()
  if (linkedClientCompanyId) search.set('linkedClientCompanyId', linkedClientCompanyId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<any[]>(`/tickets/available${suffix}`)
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

export async function createAssignmentCandidates(params: {
  clientCompanyId?: string
  locationId: string
  categoryId: string
}): Promise<AssignmentCandidatesResponse> {
  const search = new URLSearchParams()
  if (params.clientCompanyId) search.set('clientCompanyId', params.clientCompanyId)
  search.set('locationId', params.locationId)
  search.set('categoryId', params.categoryId)
  return request<AssignmentCandidatesResponse>(`/tickets/create-assignment-candidates?${search.toString()}`)
}

export async function getTicketAssignmentCandidates(id: string, scope?: string | TicketScopeParams): Promise<AssignmentCandidatesResponse> {
  return assignmentCandidates(id, scope)
}

export async function uploadDraftTicketAttachment(file: File): Promise<DraftTicketAttachment> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file, file.name || 'photo.jpg')

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

export async function createTicket(input: CreateTicketInput, scope?: string | TicketScopeParams): Promise<CreateTicketResponse> {
  return request<CreateTicketResponse>(`/tickets${buildTicketScopeSuffix(scope)}`, {
    method: 'POST',
    body: input,
  })
}

export async function createChildTicket(parentId: string, input: CreateChildTicketInput): Promise<CreateTicketResponse> {
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

/** PUT /tickets/:id/assign/:technicianId — scope (linkedClientCompanyId) через buildTicketScopeSuffix. */
export async function assignTicket(id: string, technicianId: string, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}/assign/${technicianId}${buildTicketScopeSuffix(scope)}`, {
    method: 'PUT',
  })
}

export async function smartAssignTicket(id: string, scope?: string | TicketScopeParams): Promise<SmartAssignResult> {
  return request<SmartAssignResult>(`/tickets/${id}/assign-smart${buildTicketScopeSuffix(scope)}`, {
    method: 'POST',
  })
}

export async function latestAssignmentDecision(
  id: string,
  scope?: string | TicketScopeParams,
): Promise<AssignmentDecisionItem | null> {
  return request<AssignmentDecisionItem | null>(
    `/tickets/${id}/assignment-decision${buildTicketScopeSuffix(scope)}`,
  )
}

export async function claimTicket(id: string, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}/claim${buildTicketScopeSuffix(scope)}`, {
    method: 'POST',
  })
}

export async function claim(id: string, scope?: string | TicketScopeParams): Promise<any> {
  return claimTicket(id, scope)
}

/** Техник просит диспетчера назначить его (claim по специализации недоступен). */
export async function requestTicketAssignment(
  id: string,
  scope?: string | TicketScopeParams,
): Promise<{ ok: true; notified: number; alreadyRequested: boolean }> {
  return request<{ ok: true; notified: number; alreadyRequested: boolean }>(
    `/tickets/${id}/request-assignment${buildTicketScopeSuffix(scope)}`,
    {
      method: 'POST',
    },
  )
}

export async function updateTicketStatus(id: string, input: UpdateTicketStatusInput, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}/status${buildTicketScopeSuffix(scope)}`, {
    method: 'PATCH',
    body: input,
  })
}

/** SMA-ACCEPTANCE-005: клиентское решение по приёмке работ (контракт backend: POST /tickets/:id/acceptance). */
export type TicketAcceptanceDecision = 'ACCEPT' | 'REJECT'
export type TicketAcceptanceInput = {
  decision: TicketAcceptanceDecision
  comment?: string
  attachmentIds?: string[]
}
export async function decideTicketAcceptance(id: string, input: TicketAcceptanceInput, scope?: string | TicketScopeParams): Promise<any> {
  return request<any>(`/tickets/${id}/acceptance${buildTicketScopeSuffix(scope)}`, {
    method: 'POST',
    body: input,
  })
}

export async function addTicketComment(id: string, comment: string, scope?: string | TicketScopeParams): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/tickets/${id}/comments${buildTicketScopeSuffix(scope)}`, {
    method: 'POST',
    body: { comment },
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

export async function analyticsLocations(params?: {
  linkedClientCompanyId?: string
  companyId?: string
  locationId?: string
  categoryId?: string
  from?: string
  to?: string
  minTickets?: number
}): Promise<LocationAnalyticsResponse> {
  const search = new URLSearchParams()
  if (params?.linkedClientCompanyId) search.set('linkedClientCompanyId', params.linkedClientCompanyId)
  if (params?.companyId) search.set('companyId', params.companyId)
  if (params?.locationId) search.set('locationId', params.locationId)
  if (params?.categoryId) search.set('categoryId', params.categoryId)
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  if (params?.minTickets != null) search.set('minTickets', String(params.minTickets))
  const suffix = search.toString() ? '?' + search.toString() : ''
  return request<LocationAnalyticsResponse>('/analytics/locations' + suffix)
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
export async function equipmentByLocation(locationId: string, companyId?: string): Promise<EquipmentListItem[]> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<EquipmentListItem[]>('/equipment/location/' + locationId + suffix)
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

export type InspectionFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL'
  | 'CUSTOM'

export type InspectionSchedule = {
  id: string
  companyId: string
  name: string
  frequency: InspectionFrequency
  intervalDays?: number | null
  startDate: string
  nextDueAt: string
  leadTimeDays: number
  graceDays: number
  isActive: boolean
  lastGeneratedAt?: string | null
  lastRunId?: string | null
  createdAt: string
  updatedAt: string
  template: { id: string; name: string }
  location: { id: string; name: string; city?: string | null; platformCode?: string | null }
  equipment?: { id: string; name: string; type?: string | null } | null
  assignedTo?: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null
  _count?: { runs: number }
}

export type CreateInspectionScheduleInput = {
  templateId: string
  locationId: string
  equipmentId?: string
  assignedToUserId?: string
  name?: string
  frequency: InspectionFrequency
  intervalDays?: number
  startDate: string
  leadTimeDays?: number
  graceDays?: number
}

export type UpdateInspectionScheduleInput = Partial<{
  templateId: string
  locationId: string
  equipmentId: string | null
  assignedToUserId: string | null
  name: string
  frequency: InspectionFrequency
  intervalDays: number | null
  startDate: string
  leadTimeDays: number
  graceDays: number
  isActive: boolean
}>

export async function getInspectionSchedules(): Promise<InspectionSchedule[]> {
  return request<InspectionSchedule[]>('/inspection/schedules')
}

export async function createInspectionSchedule(
  input: CreateInspectionScheduleInput,
): Promise<InspectionSchedule> {
  return request<InspectionSchedule>('/inspection/schedules', { method: 'POST', body: input })
}

export async function updateInspectionSchedule(
  id: string,
  input: UpdateInspectionScheduleInput,
): Promise<InspectionSchedule> {
  return request<InspectionSchedule>('/inspection/schedules/' + id, { method: 'PATCH', body: input })
}

export async function deleteInspectionSchedule(id: string): Promise<{ id: string; deleted: boolean }> {
  return request<{ id: string; deleted: boolean }>('/inspection/schedules/' + id, { method: 'DELETE' })
}

export async function runInspectionScheduleNow(id: string): Promise<InspectionRun> {
  return request<InspectionRun>('/inspection/schedules/' + id + '/run-now', { method: 'POST' })
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

// --- Engineering Agent (owner-only) ---------------------------------------

export type AgentTaskStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'FAILED'

export type AgentTask = {
  id: string
  companyId: string
  title: string
  prompt: string
  status: AgentTaskStatus
  result?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null
}

export async function listAgentTasks(): Promise<AgentTask[]> {
  return request<AgentTask[]>('/agent-tasks')
}

export async function getAgentTask(id: string): Promise<AgentTask> {
  return request<AgentTask>('/agent-tasks/' + id)
}

export async function createAgentTask(input: { title: string; prompt: string }): Promise<AgentTask> {
  return request<AgentTask>('/agent-tasks', { method: 'POST', body: input })
}

export async function updateAgentTaskStatus(id: string, status: AgentTaskStatus): Promise<AgentTask> {
  return request<AgentTask>('/agent-tasks/' + id + '/status', { method: 'PATCH', body: { status } })
}

export async function updateAgentTaskResult(id: string, result: string): Promise<AgentTask> {
  return request<AgentTask>('/agent-tasks/' + id + '/result', { method: 'PATCH', body: { result } })
}

// --- Workforce shifts and ticket work logs -------------------------------

export type WorkShiftStatus = 'OPEN' | 'CLOSED' | 'AUTO_CLOSED'
export type WorkLogStatus = 'RUNNING' | 'STOPPED' | 'AUTO_STOPPED'

export type WorkLogItem = {
  id: string
  companyId: string
  userId: string
  shiftId: string
  ticketId: string
  status: WorkLogStatus
  startedAt: string
  endedAt?: string | null
  durationMinutes?: number | null
  ticket: {
    id: string
    ticketNumber: number
    companyId: string
    problemText: string
    status: TicketStatus
    location?: { id: string; name: string } | null
    problemCategory?: { id: string; name: string } | null
  }
}

export type WorkShiftItem = {
  id: string
  companyId: string
  userId: string
  status: WorkShiftStatus
  openedAt: string
  closedAt?: string | null
  closeReason?: string | null
  user: { id: string; firstName?: string | null; lastName?: string | null; email: string; role: Role }
  workLogs: WorkLogItem[]
}

export type WorkforceMyState = {
  company: { id: string; name: string; timezone?: string | null; shiftAutoCloseTime: string }
  shift: WorkShiftItem | null
  runningWorkLog: WorkLogItem | null
  recentShifts: WorkShiftItem[]
  serverNow: string
}

export type WorkforceReport = {
  company: { id: string; name: string; timezone?: string | null; shiftAutoCloseTime: string }
  period: { from: string; to: string }
  summary: { shifts: number; employees: number; shiftMinutes: number; workMinutes: number }
  employees: Array<{
    user: WorkShiftItem['user']
    shifts: number
    shiftMinutes: number
    workMinutes: number
    tickets: number
  }>
  shifts: WorkShiftItem[]
  serverNow: string
}

export async function workforceMyState(): Promise<WorkforceMyState> {
  return request<WorkforceMyState>('/workforce/me')
}

export async function openWorkShift(): Promise<WorkforceMyState> {
  return request<WorkforceMyState>('/workforce/shifts/open', { method: 'POST' })
}

export async function closeWorkShift(comment?: string): Promise<WorkforceMyState> {
  return request<WorkforceMyState>('/workforce/shifts/close', { method: 'POST', body: { comment } })
}

export async function startTicketWorkLog(ticketId: string, scope?: string | TicketScopeParams): Promise<WorkforceMyState> {
  return request<WorkforceMyState>(`/workforce/work-logs/tickets/${ticketId}/start${buildTicketScopeSuffix(scope)}`, { method: 'POST' })
}

export async function stopTicketWorkLog(ticketId: string): Promise<WorkforceMyState> {
  return request<WorkforceMyState>(`/workforce/work-logs/tickets/${ticketId}/stop`, { method: 'POST' })
}

export async function workforceReport(params: { from?: string; to?: string; userId?: string; companyId?: string } = {}): Promise<WorkforceReport> {
  const search = new URLSearchParams()
  if (params.from) search.set('from', params.from)
  if (params.to) search.set('to', params.to)
  if (params.userId) search.set('userId', params.userId)
  if (params.companyId) search.set('companyId', params.companyId)
  const suffix = search.toString()
  return request<WorkforceReport>(`/workforce/shifts${suffix ? `?${suffix}` : ''}`)
}

export async function updateWorkforceSettings(shiftAutoCloseTime: string) {
  return request<{ id: string; name: string; timezone?: string | null; shiftAutoCloseTime: string }>('/workforce/settings', {
    method: 'PATCH',
    body: { shiftAutoCloseTime },
  })
}
