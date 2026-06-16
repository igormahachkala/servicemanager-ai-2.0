import type { TimelineItem } from './api'

export type ChatMessage = {
  id: string
  at: string
  text: string
  authorId: string | null
  authorEmail: string | null
  isOwn: boolean
  kind: 'comment' | 'system'
}

export type TicketChatContext = {
  categoryName?: string | null
  locationName?: string | null
  description?: string | null
}

const STATUS_RU: Record<string, string> = {
  NEW: 'Новая',
  ASSIGNED: 'Назначена',
  IN_PROGRESS: 'В работе',
  AWAITING_ACCEPTANCE: 'Ожидает приёмки',
  DONE: 'Завершена',
  CANCELED: 'Отменена',
}

function statusRu(s: string): string {
  return STATUS_RU[s] ?? s
}

function getTimelineEvent(item: TimelineItem): string {
  return ((item.timelineEvent || item.type || item.domainType) ?? '').toUpperCase()
}

function isAcceptanceComment(item: TimelineItem): boolean {
  if (getTimelineEvent(item) !== 'COMMENT_ADDED') return false
  return (item.payload?.source || '').toString().toLowerCase() === 'acceptance'
}

function getSystemText(item: TimelineItem, context?: TicketChatContext): string | null {
  const ev = getTimelineEvent(item)

  // Acceptance lifecycle — override backend titles with unified Russian labels
  if (ev === 'TICKET_READY_FOR_ACCEPTANCE') return 'Работа отправлена на приёмку'
  if (ev === 'TICKET_ACCEPTED') return 'Работа принята клиентом'
  if (ev === 'TICKET_REJECTED') {
    const comment = String(item.payload?.comment ?? '').trim()
    return comment ? `Работа не принята: ${comment}` : 'Работа не принята'
  }

  // Ticket created
  if (ev === 'TICKET_CREATED') {
    const createdDescription = String(
      context?.description ?? item.payload?.description ?? item.payload?.problemText ?? '',
    ).trim()
    const category = String(context?.categoryName ?? item.payload?.categoryName ?? '').trim()
    const location = String(context?.locationName ?? item.payload?.locationName ?? '').trim()
    const lines = ['Создана заявка']
    if (category) lines.push(`Категория: ${category}`)
    if (location) lines.push(`Объект: ${location}`)
    if (createdDescription) lines.push(`Описание: ${createdDescription}`)
    return lines.join('\n')
  }

  // Status changes — skip transitions covered by acceptance events
  if (ev === 'STATUS_CHANGED') {
    const toStatus = (item.payload?.toStatus as string | undefined | null) ?? ''
    const fromStatus = (item.payload?.fromStatus as string | undefined | null) ?? ''
    if (!fromStatus || !toStatus) return null
    if (toStatus === 'AWAITING_ACCEPTANCE' || fromStatus === 'AWAITING_ACCEPTANCE') return null
    return `${statusRu(fromStatus)} → ${statusRu(toStatus)}`
  }

  // Assignment / claim
  if (ev === 'TICKET_ASSIGNED' || ev === 'TICKET_CLAIMED') return 'Назначен исполнитель'

  // Photo uploaded
  if (ev === 'TICKET_ATTACHMENT_UPLOADED') return 'Добавлено фото'

  return null
}

export function toChatMessages(items: TimelineItem[], meUserId: string, context?: TicketChatContext): ChatMessage[] {
  const seenStatusKeys = new Set<string>()

  return items.reduce<ChatMessage[]>((acc, item, idx) => {
    // Rejection comment is shown inline in the TICKET_REJECTED system event — skip separate message
    if (isAcceptanceComment(item)) return acc

    const systemText = getSystemText(item, context)
    if (systemText !== null) {
      // Deduplicate STATUS_CHANGED pairs (history row + domain event share the same transition)
      if (getTimelineEvent(item) === 'STATUS_CHANGED') {
        const from = (item.payload?.fromStatus as string | undefined | null) ?? ''
        const to = (item.payload?.toStatus as string | undefined | null) ?? ''
        const key = `${item.at.slice(0, 19)}|${from}|${to}`
        if (seenStatusKeys.has(key)) return acc
        seenStatusKeys.add(key)
      }

      acc.push({
        id: `${item.at}-${idx}-system`,
        at: item.at,
        text: systemText,
        authorId: null,
        authorEmail: null,
        isOwn: false,
        kind: 'system',
      })
      return acc
    }

    if (item.type === 'ticket.comment_added' || item.timelineEvent === 'COMMENT_ADDED') {
      const text: string = item.payload?.comment ?? item.payload?.text ?? item.title ?? ''
      const authorId = item.actor?.id ?? null
      acc.push({
        id: `${item.at}-${idx}`,
        at: item.at,
        text,
        authorId,
        authorEmail: item.actor?.email ?? null,
        isOwn: !!meUserId && authorId === meUserId,
        kind: 'comment',
      })
    }

    return acc
  }, [])
}
