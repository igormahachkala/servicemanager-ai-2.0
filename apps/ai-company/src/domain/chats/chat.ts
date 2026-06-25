import type { ChatMessage } from './chatMessage'
import { parseChatMessage } from './chatMessage'
import type { ChatParticipant } from './chatParticipant'
import { parseChatParticipant } from './chatParticipant'
import type { ChatStatus, ChatType } from './chatTypes'

export type Chat = {
  id: string
  title: string
  type: ChatType
  workspaceId?: string
  participants: ChatParticipant[]
  messages: ChatMessage[]
  status: ChatStatus
  createdAt: string
  updatedAt: string
}

export type CreateDirectChatInput = {
  employeeId: string
  employeeDisplayName: string
  employeeRole: string
  ownerName: string
  systemWelcome: string
}

export type CreateGroupChatInput = {
  title: string
  employeeIds: Array<{ id: string; displayName: string; role: string }>
  ownerName: string
  systemStarted: string
}

export type CreateWorkspaceChatInput = {
  workspaceId: string
  workspaceTitle: string
  ownerName: string
  systemStarted: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseChatType(value: unknown): ChatType {
  if (
    value === 'direct' ||
    value === 'group' ||
    value === 'workspace' ||
    value === 'system'
  ) {
    return value
  }
  return 'group'
}

function parseChatStatus(value: unknown): ChatStatus {
  if (value === 'active' || value === 'archived' || value === 'closed') {
    return value
  }
  return 'active'
}

export function parseChat(value: unknown): Chat | null {
  if (!isRecord(value)) return null

  const participants = Array.isArray(value.participants)
    ? value.participants
        .map(parseChatParticipant)
        .filter((item): item is ChatParticipant => item !== null)
    : []

  const id = typeof value.id === 'string' ? value.id : ''
  const messages = Array.isArray(value.messages)
    ? value.messages
        .map((item) => parseChatMessage(item, id))
        .filter((item): item is ChatMessage => item !== null)
    : []

  if (
    !id ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id,
    title: value.title,
    type: parseChatType(value.type),
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : undefined,
    participants,
    messages,
    status: parseChatStatus(value.status),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function getLastMessagePreview(chat: Chat): string {
  const last = chat.messages[chat.messages.length - 1]
  if (!last) return ''
  const prefix =
    last.type === 'system'
      ? ''
      : last.authorType === 'owner'
        ? ''
        : `${last.authorType === 'employee' ? '' : ''}`
  return prefix + last.content
}

export function sortChatsByUpdated(chats: Chat[]): Chat[] {
  return [...chats].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )
}
