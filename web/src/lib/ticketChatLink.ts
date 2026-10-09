export type ChatTicketLink = {
  ticketId: string
  href: string
}

export type TicketChatParent = {
  id: string
  ticketNumber?: number | null
}

type ChildCreatedPayload = {
  childTicketId?: unknown
  childTicketNumber?: unknown
}

type ParentOriginPayload = {
  parentId?: unknown
  parentTicketNumber?: unknown
}

function nonEmptyText(value: unknown): string {
  if (value == null) return ''
  const text = String(value).trim()
  return text
}

function ticketNumberLabel(value: unknown): string {
  if (value == null || value === '') return ''
  return String(value)
}

export function resolveTicketChatHref(
  ticketId: string,
  ticketHref?: (ticketId: string) => string,
): string {
  return ticketHref ? ticketHref(ticketId) : `/tickets/${ticketId}`
}

export function isChildTicketCreatedEvent(ev: string): boolean {
  return ev === 'CHILD_TICKET_CREATED' || ev === 'TICKET.CHILD_CREATED'
}

export function childCreatedSystemText(payload?: ChildCreatedPayload | null): string | null {
  const n = ticketNumberLabel(payload?.childTicketNumber)
  if (!n) return null
  return `Создана подзадача #${n}`
}

export function childCreatedLink(
  payload?: ChildCreatedPayload | null,
  ticketHref?: (ticketId: string) => string,
): ChatTicketLink | null {
  const ticketId = nonEmptyText(payload?.childTicketId)
  if (!ticketId) return null
  return { ticketId, href: resolveTicketChatHref(ticketId, ticketHref) }
}

export function hasParentOrigin(
  payload?: ParentOriginPayload | null,
  liveParent?: TicketChatParent | null,
): boolean {
  if (liveParent?.id) return true
  if (nonEmptyText(payload?.parentId)) return true
  return ticketNumberLabel(payload?.parentTicketNumber) !== ''
}

export function createdFromParentSystemText(
  payload?: ParentOriginPayload | null,
  liveParent?: TicketChatParent | null,
): string | null {
  const n = ticketNumberLabel(liveParent?.ticketNumber ?? payload?.parentTicketNumber)
  if (!n) return null
  return `Создана из заявки #${n}`
}

export function createdFromParentLink(
  liveParent?: TicketChatParent | null,
  ticketHref?: (ticketId: string) => string,
): ChatTicketLink | null {
  const ticketId = nonEmptyText(liveParent?.id)
  if (!ticketId) return null
  return { ticketId, href: resolveTicketChatHref(ticketId, ticketHref) }
}

export function isCreatedFromParentText(text: string): boolean {
  return text.startsWith('Создана из заявки #')
}

export function ticketChatParentFromGet(
  parent?: { id: string; ticketNumber?: number | null } | null,
): TicketChatParent | null {
  if (!parent?.id) return null
  return { id: parent.id, ticketNumber: parent.ticketNumber ?? null }
}
