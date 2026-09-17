import type { TicketGetOne } from '../lib/api'
import type { BoardNavigationContext, BoardSourcePath } from '../lib/boardNavigationContext'
import {
  buildTicketAvailableActionDescriptors,
  type TicketAvailableActionDescriptor,
  type TicketAvailableActionKey,
} from '../lib/ticketAvailableActions'
import { buildTicketBackLabel } from '../lib/ticketBackContext'
import type { MobileHomeBoardFilterTab } from './mobileHomeBoardFilters'
import type { MobileTicketListOrigin, MobileTicketNavState } from './mobileTicketDisplay'

const MOBILE_SOURCE_PATHS: Record<MobileTicketListOrigin, BoardSourcePath> = {
  home: '/m',
  my: '/m/my',
  chat: '/m/chats',
  notifications: '/m/notifications',
}

const MOBILE_TAB_SCOPE_LABELS: Record<MobileHomeBoardFilterTab, string> = {
  all: 'Заявки',
  mine: 'Мои заявки',
  new: 'Новые',
  in_work: 'В работе',
  overdue: 'Просроченные',
  done: 'Завершённые',
}

const MOBILE_ORIGIN_SCOPE_LABELS: Partial<Record<MobileTicketListOrigin, string>> = {
  my: 'Мои заявки',
  chat: 'Чат',
  notifications: 'Уведомления',
}

const MOBILE_CHIP_SCOPE_LABELS: Record<string, string> = {
  overdue: 'Просроченные',
  urgent: 'Срочные',
  unassigned: 'Без исполнителя',
  today: 'Сегодня',
}

const MOBILE_ACTION_ICONS: Record<TicketAvailableActionKey, string> = {
  canClaim: 'user-check',
  canAssignSelf: 'user-check',
  canRequestAssignment: 'user-plus',
  canStart: 'bolt',
  canComplete: 'clipboard-check',
  canAccept: 'check',
  canReject: 'arrow-back-up',
  canClose: 'x',
}

export type MobileTicketOperationalAction = TicketAvailableActionDescriptor & {
  icon: string
  offline: 'queue-start' | 'online-only'
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function mobileTicketOriginFromSourcePath(sourcePath?: BoardSourcePath | null): MobileTicketListOrigin {
  if (sourcePath === '/m/my') return 'my'
  if (sourcePath === '/m/chats') return 'chat'
  if (sourcePath === '/m/notifications') return 'notifications'
  return 'home'
}

export function buildMobileTicketBackContext(
  navState: MobileTicketNavState | null | undefined,
  ticket?: Pick<TicketGetOne, 'location' | 'equipment' | 'pointName'> | null,
): BoardNavigationContext {
  const origin = navState?.mobileListOrigin || 'home'
  const tab = navState?.homeBoardTab
  const chips = navState?.homeBoardChips || []
  const overdue = tab === 'overdue' || chips.includes('overdue')
  const locationId = overdue ? clean(ticket?.location?.id) : ''
  const chipScopeLabel = chips.map((chip) => MOBILE_CHIP_SCOPE_LABELS[chip]).find(Boolean)
  const tabScopeLabel = tab && tab !== 'all' ? MOBILE_TAB_SCOPE_LABELS[tab] : ''

  return {
    sourcePath: MOBILE_SOURCE_PATHS[origin],
    tab,
    chips,
    search: clean(navState?.homeBoardSearch),
    scopeLabel:
      MOBILE_ORIGIN_SCOPE_LABELS[origin] ||
      tabScopeLabel ||
      chipScopeLabel ||
      'Заявки',
    selectedLocationId: locationId || undefined,
  }
}

export function buildMobileTicketBackLabel(
  context: BoardNavigationContext | null | undefined,
  ticket?: Pick<TicketGetOne, 'location' | 'equipment' | 'pointName'> | null,
): string {
  return buildTicketBackLabel({ context, sourcePath: context?.sourcePath, ticket })
}

export function buildMobileTicketOperationalActions(
  ticket: Pick<TicketGetOne, 'meta'> | null | undefined,
): MobileTicketOperationalAction[] {
  return buildTicketAvailableActionDescriptors(ticket).map((descriptor) => ({
    ...descriptor,
    icon: MOBILE_ACTION_ICONS[descriptor.key],
    offline: descriptor.key === 'canStart' ? 'queue-start' : 'online-only',
  }))
}

export function canQueueMobileTicketOperationalAction(key: TicketAvailableActionKey): boolean {
  return key === 'canStart'
}
