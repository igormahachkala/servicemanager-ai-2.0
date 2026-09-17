import type { TicketGetOne } from './api'

export const TICKET_AVAILABLE_ACTION_KEYS = [
  'canClaim',
  'canAssignSelf',
  'canRequestAssignment',
  'canStart',
  'canComplete',
  'canAccept',
  'canReject',
  'canClose',
] as const

export type TicketAvailableActionKey = (typeof TICKET_AVAILABLE_ACTION_KEYS)[number]

export type TicketAvailableActionDescriptor = {
  key: TicketAvailableActionKey
  label: string
  enabled: boolean
  hint?: string
  danger?: boolean
}

const ACTION_LABELS: Record<TicketAvailableActionKey, string> = {
  canClaim: 'Взять заявку',
  canAssignSelf: 'Назначить на себя',
  canRequestAssignment: 'Запросить назначение',
  canStart: 'Начать работу',
  canComplete: 'Отправить на приёмку',
  canAccept: 'Принять работу',
  canReject: 'Не принять работу',
  canClose: 'Отменить',
}

const DANGER_ACTIONS = new Set<TicketAvailableActionKey>(['canReject', 'canClose'])

function cleanHint(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function buildTicketAvailableActionDescriptors(
  ticket: Pick<TicketGetOne, 'meta'> | null | undefined,
  options: { includeDisabledWithHints?: boolean } = {},
): TicketAvailableActionDescriptor[] {
  const includeDisabledWithHints = options.includeDisabledWithHints !== false
  const availableActions = ticket?.meta?.availableActions
  const hints = ticket?.meta?.availableActionHints
  if (!availableActions) return []

  return TICKET_AVAILABLE_ACTION_KEYS.flatMap((key) => {
    const enabled = availableActions[key] === true
    const hint = cleanHint(hints?.[key])
    if (!enabled && (!includeDisabledWithHints || !hint)) return []

    return [{
      key,
      label: ACTION_LABELS[key],
      enabled,
      ...(hint ? { hint } : {}),
      ...(DANGER_ACTIONS.has(key) ? { danger: true } : {}),
    }]
  })
}
