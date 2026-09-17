import type { AddTicketCommentOptions, TimelineReplyPreview } from './api'
import type { ChatMessage } from './ticketChat'
import { presentActorIdentity } from './ticketActorIdentity'

export const UNAVAILABLE_REPLY_PREVIEW_TEXT = 'Исходное сообщение недоступно'

const REPLY_CONTEXT_PREVIEW_LIMIT = 160

function clean(value?: string | null): string {
  return (value || '').trim()
}

function clipPreview(text: string): string {
  const value = clean(text)
  if (value.length <= REPLY_CONTEXT_PREVIEW_LIMIT) return value
  return `${value.slice(0, REPLY_CONTEXT_PREVIEW_LIMIT)}…`
}

function quoted(text: string): string {
  const value = clean(text)
  return value ? `«${value}»` : UNAVAILABLE_REPLY_PREVIEW_TEXT
}

export function canReplyToChatMessage(message: ChatMessage, canSend: boolean): boolean {
  return canSend && message.kind === 'comment' && !!message.commentId
}

export function selectReplyTarget(message: ChatMessage, canSend: boolean): ChatMessage | null {
  return canReplyToChatMessage(message, canSend) ? message : null
}

export function actorReplyLabel(actor: ChatMessage['actor'] | TimelineReplyPreview['author']): string {
  if (!actor) return 'Автор не указан'
  const identity = presentActorIdentity(actor, {
    nameFallback: 'Автор не указан',
    roleFallback: 'Роль не указана',
    organizationFallback: 'Организация не указана',
  })
  return [identity.name, identity.role, identity.organization].map(clean).filter(Boolean).join(' · ')
}

export function messageReplyContext(message: ChatMessage): { author: string; preview: string } {
  return {
    author: actorReplyLabel(message.actor),
    preview: quoted(clipPreview(message.text)),
  }
}

export function replyPreviewPresentation(replyTo: TimelineReplyPreview): { unavailable: boolean; author: string | null; preview: string } {
  if (replyTo.unavailable) {
    return {
      unavailable: true,
      author: null,
      preview: UNAVAILABLE_REPLY_PREVIEW_TEXT,
    }
  }

  return {
    unavailable: false,
    author: actorReplyLabel(replyTo.author),
    preview: quoted(clipPreview(replyTo.bodyPreview)),
  }
}

export function buildAddTicketCommentOptions(replyTarget: ChatMessage | null): AddTicketCommentOptions | undefined {
  return replyTarget?.commentId ? { replyToId: replyTarget.commentId } : undefined
}
