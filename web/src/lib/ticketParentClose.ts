import { ApiRequestError, type TicketStatus } from './api'

export const PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS = 'PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS'

export const PARENT_CLOSE_DIALOG_TEXT =
  'Заявка содержит не решенные подзадачи, пожалуйста, укажите их статус чтобы продолжить'

export type UnresolvedDescendant = {
  id: string
  ticketNumber: number | null
  problemText: string | null
  status: TicketStatus
  categoryName: string | null
}

export type ChildCloseResolution = 'FIELD_COMPLETE' | 'CANCELED'

export type ChildCloseDraftItem = {
  ticketId: string
  resolution: ChildCloseResolution
}

/** Строка черновика. Живёт только в памяти диалога. */
export type ChildCloseRowDraft = {
  ticketId: string
  resolution: ChildCloseResolution | null
  fieldCompleteRejected: boolean
}

export type ParentCloseRefuse = {
  code: string | null
  unresolved: UnresolvedDescendant[]
}

export type TicketWithDescendantsForClose = {
  unresolvedDescendants?: unknown
  children?: Array<{
    id: string
    ticketNumber?: number | null
    problemText?: string | null
    status: string
    categoryName?: string | null
    problemCategory?: { name?: string | null } | null
  }> | null
}

const CLOSED_CHILD_STATUSES = new Set<string>(['DONE', 'CANCELED'])

const TICKET_STATUSES = new Set<TicketStatus>([
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'AWAITING_ACCEPTANCE',
  'FIELD_COMPLETE',
  'DONE',
  'CANCELED',
])

const STATUS_RU: Record<TicketStatus, string> = {
  NEW: 'Новая',
  ASSIGNED: 'Назначена',
  IN_PROGRESS: 'В работе',
  AWAITING_ACCEPTANCE: 'Ожидает приёмки',
  FIELD_COMPLETE: 'Выполнено',
  DONE: 'Завершена',
  CANCELED: 'Отменена',
}

function asTicketStatus(value: unknown): TicketStatus | null {
  if (typeof value !== 'string') return null
  return TICKET_STATUSES.has(value as TicketStatus) ? (value as TicketStatus) : null
}

function asTicketNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value
}

function categoryNameFromRaw(raw: Record<string, unknown>): string | null {
  if (typeof raw.categoryName === 'string') return raw.categoryName
  const category = raw.problemCategory
  if (category && typeof category === 'object' && !Array.isArray(category)) {
    const name = (category as { name?: unknown }).name
    if (typeof name === 'string') return name
  }
  return null
}

export function asUnresolvedDescendant(raw: unknown): UnresolvedDescendant | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.trim() === '') return null
  const status = asTicketStatus(record.status)
  if (!status) return null
  return {
    id: record.id,
    ticketNumber: asTicketNumber(record.ticketNumber),
    problemText: asNullableText(record.problemText),
    status,
    categoryName: categoryNameFromRaw(record),
  }
}

export function unresolvedDescendantsForClose(ticket: TicketWithDescendantsForClose): UnresolvedDescendant[] {
  if (Array.isArray(ticket.unresolvedDescendants)) {
    const fromApi: UnresolvedDescendant[] = []
    for (const raw of ticket.unresolvedDescendants) {
      const item = asUnresolvedDescendant(raw)
      if (item) fromApi.push(item)
    }
    return fromApi
  }

  const children = Array.isArray(ticket.children) ? ticket.children : []
  const unresolved: UnresolvedDescendant[] = []
  for (const child of children) {
    if (CLOSED_CHILD_STATUSES.has(child.status)) continue
    const item = asUnresolvedDescendant(child)
    if (item) unresolved.push(item)
  }
  return unresolved
}

export function parentCloseNeedsDialog(items: UnresolvedDescendant[]): boolean {
  return items.length > 0
}

export function emptyChildCloseDraft(items: UnresolvedDescendant[] = []): ChildCloseRowDraft[] {
  return items.map((item) => ({
    ticketId: item.id,
    resolution: null,
    fieldCompleteRejected: false,
  }))
}

function upsertRow(
  draft: ChildCloseRowDraft[],
  ticketId: string,
  patch: Partial<Pick<ChildCloseRowDraft, 'resolution' | 'fieldCompleteRejected'>>,
): ChildCloseRowDraft[] {
  let found = false
  const next = draft.map((row) => {
    if (row.ticketId !== ticketId) return row
    found = true
    return { ...row, ...patch }
  })
  if (found) return next
  return [
    ...next,
    {
      ticketId,
      resolution: patch.resolution ?? null,
      fieldCompleteRejected: patch.fieldCompleteRejected ?? false,
    },
  ]
}

export function applyRowChoice(
  draft: ChildCloseRowDraft[],
  ticketId: string,
  resolution: ChildCloseResolution,
): ChildCloseRowDraft[] {
  return upsertRow(draft, ticketId, { resolution })
}

export function applyConfirm(draft: ChildCloseRowDraft[], ticketId: string): ChildCloseRowDraft[] {
  return upsertRow(draft, ticketId, { resolution: 'FIELD_COMPLETE', fieldCompleteRejected: false })
}

export function applyRejectFieldComplete(draft: ChildCloseRowDraft[], ticketId: string): ChildCloseRowDraft[] {
  return upsertRow(draft, ticketId, { resolution: null, fieldCompleteRejected: true })
}

export function isDraftComplete(items: UnresolvedDescendant[], draft: ChildCloseRowDraft[]): boolean {
  if (items.length === 0) return false
  return items.every((item) => {
    const row = draft.find((entry) => entry.ticketId === item.id)
    return row?.resolution === 'FIELD_COMPLETE' || row?.resolution === 'CANCELED'
  })
}

export function toChildResolutionsPayload(
  items: UnresolvedDescendant[],
  draft: ChildCloseRowDraft[],
): ChildCloseDraftItem[] {
  const payload: ChildCloseDraftItem[] = []
  for (const item of items) {
    const row = draft.find((entry) => entry.ticketId === item.id)
    if (row?.resolution === 'FIELD_COMPLETE' || row?.resolution === 'CANCELED') {
      payload.push({ ticketId: item.id, resolution: row.resolution })
    }
  }
  return payload
}

export function rowNeedsFieldCompleteConfirm(
  item: UnresolvedDescendant,
  row: ChildCloseRowDraft | undefined,
): boolean {
  return item.status === 'FIELD_COMPLETE' && !row?.fieldCompleteRejected
}

export function descendantCloseStatusLabel(status: TicketStatus | string): string {
  if (status === 'FIELD_COMPLETE') return 'Выполнено'
  if (status === 'DONE') return 'Завершена'
  if (status === 'CANCELED') return 'Отменена'
  if (status in STATUS_RU) return STATUS_RU[status as TicketStatus]
  return status
}

export function descendantCloseLinkLabel(item: UnresolvedDescendant): string {
  if (item.ticketNumber != null) return `Подзадача #${item.ticketNumber}`
  return 'Подзадача'
}

export function descendantCloseRowHint(item: UnresolvedDescendant): string {
  const number = item.ticketNumber != null ? `#${item.ticketNumber}` : ''
  const text = (item.problemText || '').trim() || (item.categoryName || '').trim()
  const status = descendantCloseStatusLabel(item.status)
  return [number, text, status].filter(Boolean).join(' · ')
}

function readCode(record: Record<string, unknown>): string | null {
  if (typeof record.code === 'string' && record.code) return record.code
  return null
}

function readUnresolved(record: Record<string, unknown>): UnresolvedDescendant[] {
  if (!Array.isArray(record.unresolved)) return []
  const items: UnresolvedDescendant[] = []
  for (const raw of record.unresolved) {
    const item = asUnresolvedDescendant(raw)
    if (item) items.push(item)
  }
  return items
}

export function readParentCloseRefuse(err: unknown): ParentCloseRefuse | null {
  if (!(err instanceof ApiRequestError)) return null
  const payload = err.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { code: null, unresolved: [] }
  }

  const root = payload as Record<string, unknown>
  const nested =
    root.message && typeof root.message === 'object' && !Array.isArray(root.message)
      ? (root.message as Record<string, unknown>)
      : null

  const code = readCode(root) ?? (nested ? readCode(nested) : null)
  const unresolved = readUnresolved(root)
  const nestedUnresolved = nested ? readUnresolved(nested) : []

  return {
    code,
    unresolved: unresolved.length > 0 ? unresolved : nestedUnresolved,
  }
}
