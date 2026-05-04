import type { TicketCard } from '../lib/api'
import {
  dedupeBoardCards,
  filterTicketsForMobileHomeTab,
  type MobileHomeBoardChipId,
  type MobileHomeBoardFilterTab,
  MOBILE_HOME_BOARD_CHIP_IDS,
} from './mobileHomeBoardFilters'

const LS_KEY = 'sma.mobileHome.boardUi.v1'

const MOBILE_HOME_TABS: MobileHomeBoardFilterTab[] = ['all', 'new', 'mine', 'in_work']

export function readPersistedMobileHomeBoardUi(): { tab: MobileHomeBoardFilterTab; chips: MobileHomeBoardChipId[] } {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { tab: 'all', chips: [] }
    const o = JSON.parse(raw) as { tab?: string; chips?: unknown }
    const tab = MOBILE_HOME_TABS.includes(o.tab as MobileHomeBoardFilterTab) ? (o.tab as MobileHomeBoardFilterTab) : 'all'
    const chipsRaw = Array.isArray(o.chips) ? o.chips : []
    const chips = chipsRaw.filter((c): c is MobileHomeBoardChipId =>
      MOBILE_HOME_BOARD_CHIP_IDS.includes(c as MobileHomeBoardChipId),
    )
    return { tab, chips }
  } catch {
    return { tab: 'all', chips: [] }
  }
}

export function writePersistedMobileHomeBoardUi(tab: MobileHomeBoardFilterTab, chips: Iterable<MobileHomeBoardChipId>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ tab, chips: [...new Set(chips)] }))
  } catch {
    /* ignore quota / private mode */
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function ticketHaystack(t: TicketCard): string {
  const parts: string[] = []
  if (t.ticketNumber != null && Number.isFinite(Number(t.ticketNumber))) parts.push(String(t.ticketNumber), `#${t.ticketNumber}`)
  const req = (t.requesterName || '').trim()
  if (req) parts.push(req)
  const pt = (t.pointName || '').trim()
  if (pt) parts.push(pt)
  const loc = t.location
  if (loc) {
    parts.push(loc.name, loc.address || '', loc.city || '', loc.platformCode || '', loc.externalCode || '')
  }
  parts.push(t.category?.name || '', t.title || '')
  const desc = (t.description || '').trim()
  if (desc) parts.push(desc)
  return norm(parts.filter(Boolean).join('\n'))
}

export function ticketMatchesMobileHomeSearch(ticket: TicketCard, queryRaw: string): boolean {
  const q = norm(queryRaw)
  if (!q) return true
  return ticketHaystack(ticket).includes(q)
}

function isUrgentTicket(t: TicketCard): boolean {
  return (t.priority ?? 'NORMAL') === 'URGENT' || t.urgency === 'URGENT'
}

function isOverdueTicket(t: TicketCard, nowMs: number): boolean {
  if (t.slaBreached) return true
  if (!t.slaDueAt) return false
  const due = new Date(t.slaDueAt).getTime()
  return !Number.isNaN(due) && nowMs >= due
}

function isNearDeadlineTicket(t: TicketCard, nowMs: number, atRiskThresholdMs: number): boolean {
  if (t.status === 'DONE' || t.status === 'CANCELED') return false
  if (!t.slaDueAt || t.slaBreached) return false
  const due = new Date(t.slaDueAt).getTime()
  if (Number.isNaN(due) || nowMs >= due) return false
  return nowMs > due - atRiskThresholdMs
}

function isTodayTicket(t: TicketCard, nowMs: number): boolean {
  const d = new Date(t.createdAt)
  if (Number.isNaN(d.getTime())) return false
  const a = new Date(nowMs)
  return (
    d.getFullYear() === a.getFullYear() && d.getMonth() === a.getMonth() && d.getDate() === a.getDate()
  )
}

function ticketMatchesChip(
  ticket: TicketCard,
  chip: MobileHomeBoardChipId,
  meId: string | undefined,
  nowMs: number,
): boolean {
  switch (chip) {
    case 'urgent':
      return isUrgentTicket(ticket)
    case 'overdue':
      return isOverdueTicket(ticket, nowMs)
    case 'unassigned':
      return ticket.status === 'NEW' && !ticket.assignedTechnician
    case 'mine':
      return !!meId && (ticket.assignedTechnician?.id || '').trim() === meId.trim()
    case 'today':
      return isTodayTicket(ticket, nowMs)
    default:
      return true
  }
}

export function filterTicketsByChips(
  tickets: TicketCard[],
  chips: ReadonlySet<MobileHomeBoardChipId>,
  meId: string | undefined,
  nowMs: number,
): TicketCard[] {
  if (!chips.size) return tickets
  return tickets.filter((t) => {
    for (const c of chips) {
      if (!ticketMatchesChip(t, c, meId, nowMs)) return false
    }
    return true
  })
}

export function sortTicketsForMobileHome(
  tickets: TicketCard[],
  nowMs: number,
  atRiskThresholdMinutes: number,
): TicketCard[] {
  const atRiskMs = Math.max(1, atRiskThresholdMinutes) * 60_000
  const score = (t: TicketCard): [number, number, number, number] => {
    const urgent = isUrgentTicket(t) ? 0 : 1
    const deadlinePressure =
      isOverdueTicket(t, nowMs) || isNearDeadlineTicket(t, nowMs, atRiskMs) ? 0 : 1
    const newUn = t.status === 'NEW' && !t.assignedTechnician ? 0 : 1
    const created = new Date(t.createdAt).getTime()
    const createdKey = Number.isNaN(created) ? 0 : -created
    return [urgent, deadlinePressure, newUn, createdKey]
  }
  const cmp = (a: TicketCard, b: TicketCard) => {
    const sa = score(a)
    const sb = score(b)
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return sa[i] - sb[i]
    }
    return 0
  }
  return [...tickets].sort(cmp)
}

export function buildMobileHomeVisibleTickets(params: {
  cards: TicketCard[]
  tab: MobileHomeBoardFilterTab
  meId: string | undefined
  chips: ReadonlySet<MobileHomeBoardChipId>
  searchQuery: string
  atRiskThresholdMinutes: number
  nowMs?: number
}): TicketCard[] {
  const nowMs = params.nowMs ?? Date.now()
  const tabbed = filterTicketsForMobileHomeTab(params.cards, params.tab, params.meId)
  const deduped = dedupeBoardCards(tabbed)
  const chipped = filterTicketsByChips(deduped, params.chips, params.meId, nowMs)
  const searched = chipped.filter((t) => ticketMatchesMobileHomeSearch(t, params.searchQuery))
  return sortTicketsForMobileHome(searched, nowMs, params.atRiskThresholdMinutes)
}

export function formatActiveMobileHomeFiltersSummary(params: {
  searchQuery: string
  chips: ReadonlySet<MobileHomeBoardChipId>
  chipLabels: Record<MobileHomeBoardChipId, string>
}): string {
  const bits: string[] = []
  const q = params.searchQuery.trim()
  if (q) bits.push(`поиск «${q.length > 40 ? `${q.slice(0, 40)}…` : q}»`)
  for (const c of params.chips) {
    bits.push(params.chipLabels[c] || c)
  }
  return bits.length ? bits.join(' · ') : ''
}
