// ─── API → прототип: изолированные мапперы ─────────────────────────────────────
// Источник правды — реальные ответы API. Где поля для экрана нет в ответе —
// помечено `// TODO: нет в API`, значения НЕ выдумываются.
//
// API группирует доску по СТАТУСУ (columns[].cards[]), а прототип object-centric
// (Главная группирует по объектам). Поэтому boardToObjects перегруппирует карточки
// по location в список объектов и считает counts по статусам.

import type { BoardResponse, TicketCard, TicketGetOne, TicketStatus, Equipment, TimelineEvent, AnalyticsContextResponse, AnalyticsOverviewResponse, AnalyticsLocationStat } from './client'

// ─── Целевые модели прототипа (точно как в src/app/App.tsx) ─────────────────────
export interface Ticket {
  id: string
  number: number
  status: TicketStatus
  category: string
  problem: string
  requester: string
  phone: string
  location: string
  address: string
  priority: 'NORMAL' | 'URGENT'
  urgencyReason?: string
  assignee: string | null
  sla: string
  created: string
  overdue?: boolean
  waitingHours?: number
  objectId: string
}

export interface ServiceObject {
  id: string
  name: string
  address: string
  icon: string
  favorite: boolean
  mine: boolean
  counts: { newCount: number; assigned: number; inWork: number; awaiting: number; overdue: number }
  lastActivity: string
  techniciansOnline: number
  tickets: Ticket[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fullName(p?: { firstName?: string | null; lastName?: string | null; email?: string } | null): string | null {
  if (!p) return null
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim()
  return name || p.email || null
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}, ${hh}:${mi}`
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isDetail(t: TicketCard | TicketGetOne): t is TicketGetOne {
  return typeof (t as TicketGetOne).problemText === 'string'
}

// ─── Заявка: API → прототип ─────────────────────────────────────────────────
// Принимает и карточку доски (TicketCard), и детальную заявку (TicketGetOne).
export function apiTicketToTicket(t: TicketCard | TicketGetOne): Ticket {
  const detail = isDetail(t)

  const number = detail
    ? (t.ticketNumber ?? 0)
    : ((t as TicketCard).ticketNumber ?? 0) // TODO: ticketNumber на board может отсутствовать → 0

  const problem = detail
    ? (t.problemText || t.title || '—')
    : ((t as TicketCard).description || (t as TicketCard).title || '—')

  const category = detail
    ? (t.problemCategory?.name ?? '—')
    : ((t as TicketCard).category?.name ?? '—')

  const requester = (detail ? t.requesterName : (t as TicketCard).requesterName) ?? '' // на board бывает null

  // phone есть ТОЛЬКО в детальной заявке (GET /tickets/:id), на board его нет
  const phone = detail ? (t.requesterPhone ?? '') : '' // TODO: нет в API на board (только в /tickets/:id)

  const loc = t.location
  const location = (t.pointName || loc?.name || '—') as string
  const address = (loc?.address || loc?.city || '') as string

  const priority: 'NORMAL' | 'URGENT' =
    (t as any).priority === 'URGENT' || (t as any).priority === 'NORMAL'
      ? (t as any).priority
      : (t.urgency === 'URGENT' ? 'URGENT' : 'NORMAL')

  const assignee = fullName(t.assignedTechnician)

  const overdue = detail ? Boolean(t.slaBreachedAt) : Boolean((t as TicketCard).slaBreached)

  return {
    id: t.id,
    number,
    status: t.status,
    category,
    problem,
    requester,
    phone,
    location,
    address,
    priority,
    urgencyReason: undefined, // TODO: нет в API (на доске и в карточке причины срочности нет)
    assignee,
    sla: fmtTime(t.slaDueAt),
    created: fmtDateTime(t.createdAt),
    overdue,
    waitingHours: undefined, // TODO: нет в API (нет поля «часов ожидания приёмки»)
    objectId: loc?.id ?? 'unknown',
  }
}

// ─── Доска (по статусам) → объекты (по location) ──────────────────────────────
export function boardToObjects(
  resp: BoardResponse,
  opts: { currentUserId?: string } = {},
): ServiceObject[] {
  const cards: TicketCard[] = (resp?.columns ?? []).flatMap((c) => c.cards ?? [])

  const groups = new Map<string, { loc: TicketCard['location']; pointName?: string | null; cards: TicketCard[] }>()
  for (const card of cards) {
    const key = card.location?.id || card.pointName || 'unknown'
    let g = groups.get(key)
    if (!g) {
      g = { loc: card.location, pointName: card.pointName, cards: [] }
      groups.set(key, g)
    }
    g.cards.push(card)
  }

  const objects: ServiceObject[] = []
  for (const [key, g] of groups) {
    const counts = { newCount: 0, assigned: 0, inWork: 0, awaiting: 0, overdue: 0 }
    let latest = 0
    let mine = false
    for (const c of g.cards) {
      const st: TicketStatus = c.status
      if (st === 'NEW') counts.newCount++
      else if (st === 'ASSIGNED') counts.assigned++
      else if (st === 'IN_PROGRESS') counts.inWork++
      else if (st === 'AWAITING_ACCEPTANCE') counts.awaiting++
      if (c.slaBreached) counts.overdue++
      const ts = new Date(c.createdAt).getTime()
      if (!isNaN(ts) && ts > latest) latest = ts
      if (opts.currentUserId && c.assignedTechnicianId === opts.currentUserId) mine = true
    }

    objects.push({
      id: key,
      name: g.loc?.name || g.pointName || 'Без объекта',
      address: g.loc?.address || g.loc?.city || '',
      icon: '🏢', // TODO: нет в API (иконки объекта нет; используем дефолт)
      favorite: false, // TODO: нет в API (избранное — клиентское понятие, в ответе нет)
      mine, // вычислено по assignedTechnicianId == currentUserId (если передан)
      counts,
      lastActivity: latest ? fmtTime(new Date(latest).toISOString()) : '—', // приближение по createdAt; TODO: точного lastActivity в API нет
      techniciansOnline: 0, // TODO: нет в API
      tickets: g.cards.map(apiTicketToTicket),
    })
  }

  // Объекты «мои» — выше, затем по числу активных заявок
  objects.sort((a, b) => Number(b.mine) - Number(a.mine) || (b.tickets.length - a.tickets.length))
  return objects
}

// ─── Оборудование: API → display ────────────────────────────────────────────────
// Маппит ТОЛЬКО реальные поля (serial/model/manufacturer/qrCode — в API НЕТ).
export interface DisplayEquipment {
  id: string
  name: string
  type: string          // UPPERCASE как с бэка
  typeLabel: string     // title-case для показа
  status: string        // ACTIVE | MAINTENANCE | BROKEN
  statusLabel: string
  statusBadge: string   // tailwind-классы бейджа
  statusAccent: string  // tailwind-класс левого акцент-бара
  locationId: string
  companyId: string
  createdAt: string
  updatedAt: string
  location: Equipment['location']
}

export function equipmentStatusLabel(s: string): string {
  return ({ ACTIVE: 'Активно', MAINTENANCE: 'Обслуживание', BROKEN: 'Неисправно' } as Record<string, string>)[s] || s
}
export function equipmentStatusBadge(s: string): string {
  return ({ ACTIVE: 'bg-emerald-100 text-emerald-700', MAINTENANCE: 'bg-amber-100 text-amber-700', BROKEN: 'bg-red-100 text-red-700' } as Record<string, string>)[s] || 'bg-slate-100 text-slate-500'
}
export function equipmentStatusAccent(s: string): string {
  return ({ ACTIVE: 'border-l-emerald-500', MAINTENANCE: 'border-l-amber-500', BROKEN: 'border-l-red-500' } as Record<string, string>)[s] || 'border-l-slate-300'
}
/** type как-есть читабелен (UPPERCASE по-русски); приводим к title-case первого слова. */
export function equipmentTypeLabel(type: string): string {
  if (!type) return type
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

export function equipmentFromApi(e: Equipment): DisplayEquipment {
  return {
    id: e.id,
    name: e.name,
    type: e.type,
    typeLabel: equipmentTypeLabel(e.type),
    status: e.status,
    statusLabel: equipmentStatusLabel(e.status),
    statusBadge: equipmentStatusBadge(e.status),
    statusAccent: equipmentStatusAccent(e.status),
    locationId: e.locationId,
    companyId: e.companyId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    location: e.location,
    // TODO: serial, model, manufacturer, qrCode, description — нет в API
  }
}

// ─── Чаты: timeline-событие → display ────────────────────────────────────────────
// Имена полей payload сверены со стейджем (smoke): COMMENT_ADDED→payload.comment,
// STATUS_CHANGED→payload.fromStatus/toStatus, TICKET_CREATED→payload.{title,…}.
export type ChatItem =
  | { type: 'comment'; text: string; author: string | null; authorId: string | null; at: string }
  | { type: 'status'; from: string | null; to: string | null; at: string }
  | { type: 'created'; at: string }
  | { type: 'event'; title: string; at: string }

export function timelineEventFromApi(e: TimelineEvent): ChatItem {
  const at = e.at
  switch (e.timelineEvent) {
    case 'COMMENT_ADDED':
      return { type: 'comment', text: String(e.payload?.comment ?? ''), author: e.actor?.email ?? null, authorId: e.actor?.id ?? null, at }
    case 'STATUS_CHANGED':
      return { type: 'status', from: e.payload?.fromStatus ?? null, to: e.payload?.toStatus ?? null, at }
    case 'TICKET_CREATED':
      return { type: 'created', at }
    default:
      return { type: 'event', title: e.title || e.timelineEvent, at }
  }
}

// Статус заявки → label/badge (для карточек «чатов»)
export function ticketStatusLabel(s: string): string {
  return ({ NEW: 'Новая', ASSIGNED: 'Назначена', IN_PROGRESS: 'В работе', AWAITING_ACCEPTANCE: 'На приёмке', DONE: 'Завершена', CANCELED: 'Отменена' } as Record<string, string>)[s] || s
}
export function ticketStatusBadge(s: string): string {
  return ({ NEW: 'bg-orange-100 text-orange-700', ASSIGNED: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-violet-100 text-violet-700', AWAITING_ACCEPTANCE: 'bg-amber-100 text-amber-700', DONE: 'bg-emerald-100 text-emerald-700', CANCELED: 'bg-slate-100 text-slate-400' } as Record<string, string>)[s] || 'bg-slate-100 text-slate-500'
}

// ─── Аналитика: API → display ────────────────────────────────────────────────────
// Цвета статусов (по ТЗ): NEW синий, IN_PROGRESS жёлтый, AWAITING_ACCEPTANCE фиолетовый, DONE зелёный.
export const ANALYTICS_STATUS: Array<{ key: keyof Pick<AnalyticsLocationStat, 'NEW' | 'IN_PROGRESS' | 'AWAITING_ACCEPTANCE' | 'DONE'>; label: string; bar: string; dot: string; text: string }> = [
  { key: 'NEW', label: 'Новые', bar: 'bg-blue-500', dot: 'bg-blue-500', text: 'text-blue-600' },
  { key: 'IN_PROGRESS', label: 'В работе', bar: 'bg-amber-400', dot: 'bg-amber-400', text: 'text-amber-600' },
  { key: 'AWAITING_ACCEPTANCE', label: 'Приёмка', bar: 'bg-violet-500', dot: 'bg-violet-500', text: 'text-violet-600' },
  { key: 'DONE', label: 'Завершено', bar: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600' },
]

/** Минуты → читаемая длительность. */
export function fmtDurationMinutes(min?: number | null): string {
  if (min == null || isNaN(min)) return '—'
  if (min < 1) return '<1 мин'
  if (min < 60) return `${Math.round(min)} мин`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

export type DisplayLocationStat = AnalyticsLocationStat & {
  segments: Array<{ key: string; label: string; count: number; bar: string; pct: number }>
}
export function analyticsContextFromApi(resp: AnalyticsContextResponse): { locations: DisplayLocationStat[]; totalTickets: number } {
  const locations = (resp?.byLocation ?? []).map((l) => {
    const denom = l.total || 1
    const segments = ANALYTICS_STATUS.map((s) => ({ key: s.key, label: s.label, count: l[s.key] ?? 0, bar: s.bar, pct: ((l[s.key] ?? 0) / denom) * 100 }))
    return { ...l, segments }
  })
  return { locations, totalTickets: resp?.meta?.totalTickets ?? locations.reduce((s, l) => s + (l.total || 0), 0) }
}

export type DisplayOverview = {
  openTotal: number
  unassigned: number
  slaOkPercent: number
  slaBreachedPercent: number
  slaEvaluated: number
  assignLabel: string
  resolveLabel: string
  workload: Array<{ id: string; name: string; assigned: number; inProgress: number; active: number }>
}
export function analyticsOverviewFromApi(resp: AnalyticsOverviewResponse): DisplayOverview {
  return {
    openTotal: resp?.summary?.backlogOpenTotal ?? 0,
    unassigned: resp?.summary?.unassignedOpenTickets ?? 0,
    slaOkPercent: resp?.sla?.okPercent ?? 0,
    slaBreachedPercent: resp?.sla?.breachedPercent ?? 0,
    slaEvaluated: resp?.sla?.evaluatedCount ?? 0,
    assignLabel: fmtDurationMinutes(resp?.timing?.meanTimeToAssignMinutes),
    resolveLabel: fmtDurationMinutes(resp?.timing?.meanTimeToResolveMinutes),
    // technicianEmail на стейдже = UUID (бэкенд-квирк); показываем короткий id
    workload: (resp?.workloadByTechnician ?? []).map((w) => ({ id: w.technicianId, name: (w.technicianEmail || w.technicianId || '').split('@')[0].slice(0, 8), assigned: w.assignedCount, inProgress: w.inProgressCount, active: w.activeCount })),
  }
}
