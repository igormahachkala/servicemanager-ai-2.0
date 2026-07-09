import type { ParticipantType } from './chatParticipant'

export type ChatMessageType =
  | 'message'
  | 'note'
  | 'system'
  | 'summary'
  | 'decision'
  | 'cursor_handoff'

export type ChatMessageStatus = 'sent' | 'pending' | 'failed' | 'draft'

export type ChatMessage = {
  id: string
  chatId: string
  authorId: string
  authorType: ParticipantType
  content: string
  type: ChatMessageType
  status: ChatMessageStatus
  createdAt: string
  cursorHandoffId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseChatMessage(value: unknown, chatId?: string): ChatMessage | null {
  if (!isRecord(value)) return null

  const authorType =
    value.authorType === 'owner' || value.authorType === 'employee' || value.authorType === 'system'
      ? value.authorType
      : null

  const type =
    value.type === 'message' ||
    value.type === 'note' ||
    value.type === 'system' ||
    value.type === 'summary' ||
    value.type === 'decision' ||
    value.type === 'cursor_handoff'
      ? value.type
      : 'message'

  const status =
    value.status === 'sent' ||
    value.status === 'pending' ||
    value.status === 'failed' ||
    value.status === 'draft'
      ? value.status
      : 'sent'

  const resolvedChatId =
    typeof value.chatId === 'string' ? value.chatId : chatId ?? ''

  if (
    !authorType ||
    typeof value.id !== 'string' ||
    typeof value.authorId !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !resolvedChatId
  ) {
    return null
  }

  return {
    id: value.id,
    chatId: resolvedChatId,
    authorId: value.authorId,
    authorType,
    content: value.content,
    type,
    status,
    createdAt: value.createdAt,
    cursorHandoffId: typeof value.cursorHandoffId === 'string' ? value.cursorHandoffId : undefined,
  }
}

export function createChatMessage(input: {
  chatId: string
  authorId: string
  authorType: ParticipantType
  content: string
  type?: ChatMessageType
  status?: ChatMessageStatus
  cursorHandoffId?: string
}): ChatMessage {
  return {
    id: `chatmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    chatId: input.chatId,
    authorId: input.authorId,
    authorType: input.authorType,
    content: input.content,
    type: input.type ?? 'message',
    status: input.status ?? 'sent',
    createdAt: new Date().toISOString(),
    cursorHandoffId: input.cursorHandoffId,
  }
}
