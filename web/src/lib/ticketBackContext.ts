import type { TicketGetOne, TicketStatus } from './api'
import type { BoardNavigationContext, BoardSourcePath } from './boardNavigationContext'

type TicketBackLabelTicket = Pick<TicketGetOne, 'location' | 'equipment' | 'pointName'>

type BuildTicketBackLabelInput = {
  context?: BoardNavigationContext | null
  sourcePath?: BoardSourcePath | null
  ticket?: TicketBackLabelTicket | null
}

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i

const STATUS_TARGETS: Record<TicketStatus, string> = {
  NEW: 'новым',
  ASSIGNED: 'назначенным',
  IN_PROGRESS: 'заявкам в работе',
  AWAITING_ACCEPTANCE: 'ожидающим приёмки',
  DONE: 'завершённым',
  CANCELED: 'отменённым',
}

const CHIP_TARGETS: Record<string, string> = {
  overdue: 'просроченным',
  breached: 'просроченным',
  urgent: 'срочным',
  today: 'сегодняшним',
  mine: 'моим заявкам',
}

const LABEL_TARGETS: Record<string, string> = {
  заявки: 'заявкам',
  'мои заявки': 'моим заявкам',
  просроченные: 'просроченным',
  срочные: 'срочным',
  новые: 'новым',
  назначенные: 'назначенным',
  завершённые: 'завершённым',
  завершенные: 'завершённым',
  отменённые: 'отменённым',
  отмененные: 'отменённым',
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function safeHumanLabel(value: unknown): string {
  const text = clean(value)
  if (!text || UUID_RE.test(text)) return ''
  return text
}

function lowerFirst(value: string): string {
  return value ? `${value[0].toLocaleLowerCase('ru-RU')}${value.slice(1)}` : ''
}

function normalizeTargetLabel(value: string): string {
  const text = safeHumanLabel(value)
  if (!text) return ''
  const mapped = LABEL_TARGETS[text.toLocaleLowerCase('ru-RU')]
  return mapped || lowerFirst(text)
}

function splitScopeLabel(scopeLabel?: string): { primary: string; detail: string } {
  const safe = safeHumanLabel(scopeLabel)
  if (!safe) return { primary: '', detail: '' }

  const arrowParts = safe
    .split(/(?:->|→)/)
    .map((part) => safeHumanLabel(part))
    .filter(Boolean)

  if (arrowParts.length >= 2) {
    return {
      detail: arrowParts[0],
      primary: normalizeTargetLabel(arrowParts[arrowParts.length - 1]),
    }
  }

  return { primary: normalizeTargetLabel(safe), detail: '' }
}

function contextTarget(ctx?: BoardNavigationContext | null): string {
  const fromScope = splitScopeLabel(ctx?.scopeLabel).primary
  if (fromScope) return fromScope

  for (const chip of ctx?.chips || []) {
    const mapped = CHIP_TARGETS[clean(chip).toLocaleLowerCase('ru-RU')]
    if (mapped) return mapped
  }

  if (ctx?.selectedStatus) return STATUS_TARGETS[ctx.selectedStatus] || 'заявкам'
  return 'заявкам'
}

function contextDetails(ctx: BoardNavigationContext | null | undefined, ticket?: TicketBackLabelTicket | null): string[] {
  const details: string[] = []
  const scopeDetail = splitScopeLabel(ctx?.scopeLabel).detail
  if (scopeDetail) details.push(scopeDetail)

  const selectedLocationId = clean(ctx?.selectedLocationId)
  const ticketLocationId = clean(ticket?.location?.id)
  const locationName = safeHumanLabel(ticket?.location?.name || ticket?.pointName)
  if (selectedLocationId && ticketLocationId && selectedLocationId === ticketLocationId && locationName) {
    details.push(locationName)
  }

  const selectedEquipmentId = clean(ctx?.selectedEquipmentId)
  const ticketEquipmentId = clean(ticket?.equipment?.id)
  const equipmentName = safeHumanLabel(ticket?.equipment?.name)
  if (selectedEquipmentId && ticketEquipmentId && selectedEquipmentId === ticketEquipmentId && equipmentName) {
    details.push(equipmentName)
  }

  return Array.from(new Set(details))
}

export function buildTicketBackLabel(input: BuildTicketBackLabelInput = {}): string {
  const ctx = input.context || null
  const target = contextTarget(ctx)
  const details = contextDetails(ctx, input.ticket)
  const base = `← Назад к ${target || 'заявкам'}`
  return details.length ? `${base} · ${details.join(' · ')}` : base
}
