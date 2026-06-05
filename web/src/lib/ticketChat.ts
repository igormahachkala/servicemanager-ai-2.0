import type { TimelineItem } from './api'

export type ChatMessage = {
  id: string
  at: string
  text: string
  authorId: string | null
  authorEmail: string | null
  isOwn: boolean
}

export function toChatMessages(items: TimelineItem[], meUserId: string): ChatMessage[] {
  return items
    .filter((item) => item.type === 'ticket.comment_added' || item.timelineEvent === 'COMMENT_ADDED')
    .map((item, idx) => {
      const text: string = item.payload?.comment ?? item.payload?.text ?? item.title ?? ''
      const authorId = item.actor?.id ?? null
      return {
        id: `${item.at}-${idx}`,
        at: item.at,
        text,
        authorId,
        authorEmail: item.actor?.email ?? null,
        isOwn: !!meUserId && authorId === meUserId,
      }
    })
}
