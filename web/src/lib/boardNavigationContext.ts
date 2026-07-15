import type { TicketStatus } from './api'

const BOARD_SCROLL_PREFIX = 'sma:board-scroll:'
const BOARD_QUERY_KEYS = {
  locationId: 'boardLocationId',
  equipmentId: 'boardEquipmentId',
  status: 'boardStatus',
  archived: 'boardArchived',
  take: 'boardTake',
  tab: 'boardTab',
  chip: 'boardChip',
  search: 'boardSearch',
  scopeLabel: 'boardScopeLabel',
} as const

export type BoardNavigationContext = {
  selectedLocationId?: string
  selectedEquipmentId?: string
  selectedStatus?: TicketStatus | ''
  includeArchived?: boolean
  take?: number
  tab?: string
  chips?: string[]
  search?: string
  scopeLabel?: string
}

export type BoardTicketNavState = {
  boardContext?: BoardNavigationContext
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function sanitizeBoardNavigationContext(
  ctx: BoardNavigationContext | null | undefined,
): BoardNavigationContext | undefined {
  if (!ctx) return undefined
  const next: BoardNavigationContext = {}
  const locationId = normalizeText(ctx.selectedLocationId)
  const equipmentId = normalizeText(ctx.selectedEquipmentId)
  const status = normalizeText(ctx.selectedStatus) as TicketStatus | ''
  const take = Number(ctx.take)
  const tab = normalizeText(ctx.tab)
  const chips = Array.isArray(ctx.chips)
    ? ctx.chips.map((chip) => normalizeText(chip)).filter(Boolean)
    : []
  const search = normalizeText(ctx.search).slice(0, 240)
  const scopeLabel = normalizeText(ctx.scopeLabel).slice(0, 120)

  if (locationId) next.selectedLocationId = locationId
  if (equipmentId) next.selectedEquipmentId = equipmentId
  if (status === 'NEW' || status === 'ASSIGNED' || status === 'IN_PROGRESS' || status === 'DONE' || status === 'CANCELED') {
    next.selectedStatus = status
  }
  if (ctx.includeArchived) next.includeArchived = true
  if (Number.isFinite(take) && take > 0) next.take = Math.max(1, Math.min(500, Math.trunc(take)))
  if (tab) next.tab = tab
  if (chips.length > 0) next.chips = Array.from(new Set(chips))
  if (search) next.search = search
  if (scopeLabel) next.scopeLabel = scopeLabel

  if (
    !next.selectedLocationId &&
    !next.selectedEquipmentId &&
    !next.selectedStatus &&
    !next.includeArchived &&
    !next.take &&
    !next.tab &&
    !next.chips?.length &&
    !next.search &&
    !next.scopeLabel
  ) {
    return undefined
  }
  return next
}

export function readBoardNavigationContextFromSearch(searchParams: URLSearchParams): BoardNavigationContext | undefined {
  const ctx: BoardNavigationContext = {
    selectedLocationId: searchParams.get(BOARD_QUERY_KEYS.locationId) || undefined,
    selectedEquipmentId: searchParams.get(BOARD_QUERY_KEYS.equipmentId) || undefined,
    selectedStatus: (searchParams.get(BOARD_QUERY_KEYS.status) || '') as TicketStatus | '',
    includeArchived: ['1', 'true', 'yes'].includes((searchParams.get(BOARD_QUERY_KEYS.archived) || '').trim().toLowerCase()),
    take: searchParams.get(BOARD_QUERY_KEYS.take) ? Number(searchParams.get(BOARD_QUERY_KEYS.take)) : undefined,
    tab: searchParams.get(BOARD_QUERY_KEYS.tab) || undefined,
    chips: searchParams.getAll(BOARD_QUERY_KEYS.chip),
    search: searchParams.get(BOARD_QUERY_KEYS.search) || undefined,
    scopeLabel: searchParams.get(BOARD_QUERY_KEYS.scopeLabel) || undefined,
  }
  return sanitizeBoardNavigationContext(ctx)
}

export function applyBoardNavigationContextToSearchParams(
  searchParams: URLSearchParams,
  ctx: BoardNavigationContext | null | undefined,
): URLSearchParams {
  searchParams.delete(BOARD_QUERY_KEYS.locationId)
  searchParams.delete(BOARD_QUERY_KEYS.equipmentId)
  searchParams.delete(BOARD_QUERY_KEYS.status)
  searchParams.delete(BOARD_QUERY_KEYS.archived)
  searchParams.delete(BOARD_QUERY_KEYS.take)
  searchParams.delete(BOARD_QUERY_KEYS.tab)
  searchParams.delete(BOARD_QUERY_KEYS.chip)
  searchParams.delete(BOARD_QUERY_KEYS.search)
  searchParams.delete(BOARD_QUERY_KEYS.scopeLabel)

  const safe = sanitizeBoardNavigationContext(ctx)
  if (!safe) return searchParams

  if (safe.selectedLocationId) searchParams.set(BOARD_QUERY_KEYS.locationId, safe.selectedLocationId)
  if (safe.selectedEquipmentId) searchParams.set(BOARD_QUERY_KEYS.equipmentId, safe.selectedEquipmentId)
  if (safe.selectedStatus) searchParams.set(BOARD_QUERY_KEYS.status, safe.selectedStatus)
  if (safe.includeArchived) searchParams.set(BOARD_QUERY_KEYS.archived, '1')
  if (safe.take) searchParams.set(BOARD_QUERY_KEYS.take, String(safe.take))
  if (safe.tab) searchParams.set(BOARD_QUERY_KEYS.tab, safe.tab)
  for (const chip of safe.chips || []) {
    searchParams.append(BOARD_QUERY_KEYS.chip, chip)
  }
  if (safe.search) searchParams.set(BOARD_QUERY_KEYS.search, safe.search)
  if (safe.scopeLabel) searchParams.set(BOARD_QUERY_KEYS.scopeLabel, safe.scopeLabel)
  return searchParams
}

export function appendBoardNavigationContextToPath(
  path: string,
  ctx: BoardNavigationContext | null | undefined,
): string {
  const [pathname, queryString = ''] = path.split('?', 2)
  const searchParams = new URLSearchParams(queryString)
  applyBoardNavigationContextToSearchParams(searchParams, ctx)
  const nextQuery = searchParams.toString()
  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

export function saveBoardScrollPosition(pathWithSearch: string, scrollY: number) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(`${BOARD_SCROLL_PREFIX}${pathWithSearch}`, String(Math.max(0, Math.trunc(scrollY))))
  } catch {
    // ignore storage issues
  }
}

export function consumeBoardScrollPosition(pathWithSearch: string): number | null {
  if (typeof window === 'undefined') return null
  try {
    const key = `${BOARD_SCROLL_PREFIX}${pathWithSearch}`
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    window.sessionStorage.removeItem(key)
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}
