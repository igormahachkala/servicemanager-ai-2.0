import {
  appendEmployeeMessage,
  appendOwnerMessage as appendConversationOwnerMessage,
  getOrCreateConversation,
  loadConversations,
  resolveEmployee,
  type Conversation,
  type ConversationMessage,
} from '../../mission-control/data/conversation'
import {
  appendEmployeeMessages,
  appendOwnerMessage as appendDiscussionOwnerMessage,
  createDiscussion,
  getDiscussionById,
  loadDiscussions,
  pickMockResponders,
  resolveRosterEntry,
  type CreateDiscussionInput,
  type Discussion,
  type DiscussionMessage,
} from '../../mission-control/data/discussion'
import { getWorkspaceById } from '../workspaces/workspace'
import type { Chat, CreateDirectChatInput, CreateGroupChatInput, CreateWorkspaceChatInput } from './chat'
import { parseChat, sortChatsByUpdated } from './chat'
import type { ChatMessageType } from './chatMessage'
import { createChatMessage } from './chatMessage'
import {
  createEmployeeParticipant,
  createOwnerParticipant,
  createSystemParticipant,
} from './chatParticipant'
import { chatIdFromRef, parseChatRef } from './chatTypes'

export { getDiscussionRoster, resolveRosterEntry } from '../../mission-control/data/discussion'

const STORAGE_KEY = 'ai-company-chats'
const OWNER_ID = 'owner'

export function loadNativeChats(): Chat[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseChat).filter((item): item is Chat => item !== null)
  } catch {
    return []
  }
}

export function saveNativeChats(chats: Chat[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  } catch {
    /* noop */
  }
}

function adaptConversationMessage(message: ConversationMessage, chatId: string) {
  return {
    id: message.id,
    chatId,
    authorId: message.author.id,
    authorType: message.author.type,
    content: message.content,
    type: message.type,
    status: message.status,
    createdAt: message.createdAt,
  }
}

function adaptDiscussionMessage(message: DiscussionMessage, chatId: string) {
  const type: ChatMessageType =
    message.type === 'decision' ? 'decision' : message.type === 'system' ? 'system' : 'message'

  return {
    id: message.id,
    chatId,
    authorId: message.author.employeeId,
    authorType: message.author.type,
    content: message.content,
    type,
    status: 'sent' as const,
    createdAt: message.createdAt,
  }
}

export function adaptConversationToChat(conversation: Conversation): Chat | null {
  const employee = resolveEmployee(conversation.employeeId)
  if (!employee) return null

  const chatId = chatIdFromRef({ source: 'conversation', employeeId: conversation.employeeId })

  return {
    id: chatId,
    title: employee.codename,
    type: 'direct',
    participants: [
      createOwnerParticipant(conversation.createdAt, 'Owner'),
      createEmployeeParticipant(
        employee.id,
        employee.codename,
        employee.role,
        conversation.createdAt,
      ),
    ],
    messages: conversation.messages.map((message) =>
      adaptConversationMessage(message, chatId),
    ),
    status: 'active',
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  }
}

export function adaptDiscussionToChat(discussion: Discussion): Chat {
  const chatId = chatIdFromRef({ source: 'discussion', discussionId: discussion.id })

  const participants = discussion.participants.map((participant) => {
    const entry = resolveRosterEntry(participant.employeeId)
    const displayName = entry?.codename ?? participant.employeeId
    if (participant.employeeId === OWNER_ID) {
      return createOwnerParticipant(discussion.createdAt, displayName)
    }
    return createEmployeeParticipant(
      participant.employeeId,
      displayName,
      participant.role,
      discussion.createdAt,
    )
  })

  return {
    id: chatId,
    title: discussion.title,
    type: 'group',
    participants,
    messages: discussion.messages.map((message) => adaptDiscussionMessage(message, chatId)),
    status: discussion.status === 'closed' ? 'closed' : 'active',
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
  }
}

export function getVirtualSystemChat(): Chat {
  const now = new Date().toISOString()
  const chatId = 'sys:platform'

  return {
    id: chatId,
    title: 'Platform',
    type: 'system',
    participants: [createSystemParticipant(now), createOwnerParticipant(now, 'Owner')],
    messages: [
      createChatMessage({
        chatId,
        authorId: 'system',
        authorType: 'system',
        content: 'System channel — platform announcements and runtime status will appear here.',
        type: 'system',
      }),
    ],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

function loadLegacyChats(): Chat[] {
  const nativeEmployeeIds = new Set(
    loadNativeChats()
      .filter((chat) => chat.type === 'direct')
      .flatMap((chat) =>
        chat.participants
          .filter((participant) => participant.type === 'employee' && participant.employeeId)
          .map((participant) => participant.employeeId as string),
      ),
  )

  const fromConversations = loadConversations()
    .filter((conversation) => !nativeEmployeeIds.has(conversation.employeeId))
    .map(adaptConversationToChat)
    .filter((chat): chat is Chat => chat !== null)

  const nativeDiscussionTitles = new Set(
    loadNativeChats()
      .filter((chat) => chat.type === 'group')
      .map((chat) => chat.title.toLowerCase()),
  )

  const fromDiscussions = loadDiscussions()
    .filter((discussion) => !nativeDiscussionTitles.has(discussion.title.toLowerCase()))
    .map(adaptDiscussionToChat)

  return [...fromConversations, ...fromDiscussions]
}

export function loadAllChats(): Chat[] {
  const native = loadNativeChats()
  const legacy = loadLegacyChats()
  const system = getVirtualSystemChat()
  return sortChatsByUpdated([system, ...native, ...legacy])
}

export function getChatById(chatId: string): Chat | null {
  if (chatId === 'sys:platform') return getVirtualSystemChat()

  const ref = parseChatRef(chatId)
  if (!ref) return null

  if (ref.source === 'native') {
    return loadNativeChats().find((chat) => chat.id === ref.id) ?? null
  }

  if (ref.source === 'conversation') {
    const conversation =
      loadConversations().find((item) => item.employeeId === ref.employeeId) ??
      getOrCreateConversation(ref.employeeId, {
        systemWelcome: () => 'Personal conversation started.',
      })
    return conversation ? adaptConversationToChat(conversation) : null
  }

  if (ref.source === 'discussion') {
    const discussion = getDiscussionById(ref.discussionId)
    return discussion ? adaptDiscussionToChat(discussion) : null
  }

  return null
}

function updateNativeChatAt(index: number, chat: Chat): Chat {
  const all = loadNativeChats()
  const next = [...all]
  next[index] = chat
  saveNativeChats(next)
  return chat
}

export function createDirectChat(input: CreateDirectChatInput): Chat {
  const now = new Date().toISOString()
  const chatId = `chat-${Date.now()}`

  const chat: Chat = {
    id: chatId,
    title: input.employeeDisplayName,
    type: 'direct',
    participants: [
      createOwnerParticipant(now, input.ownerName),
      createEmployeeParticipant(
        input.employeeId,
        input.employeeDisplayName,
        input.employeeRole,
        now,
      ),
    ],
    messages: [
      createChatMessage({
        chatId,
        authorId: 'system',
        authorType: 'system',
        content: input.systemWelcome,
        type: 'system',
      }),
    ],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  saveNativeChats([...loadNativeChats(), chat])
  return chat
}

export function createGroupChat(input: CreateGroupChatInput): Chat {
  const now = new Date().toISOString()
  const chatId = `chat-${Date.now()}`

  const chat: Chat = {
    id: chatId,
    title: input.title.trim(),
    type: 'group',
    participants: [
      createOwnerParticipant(now, input.ownerName),
      ...input.employeeIds.map((employee) =>
        createEmployeeParticipant(employee.id, employee.displayName, employee.role, now),
      ),
    ],
    messages: [
      createChatMessage({
        chatId,
        authorId: 'system',
        authorType: 'system',
        content: input.systemStarted,
        type: 'system',
      }),
    ],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  saveNativeChats([...loadNativeChats(), chat])
  return chat
}

export function createWorkspaceChat(input: CreateWorkspaceChatInput): Chat {
  const now = new Date().toISOString()
  const chatId = `chat-${Date.now()}`

  const chat: Chat = {
    id: chatId,
    title: input.workspaceTitle,
    type: 'workspace',
    workspaceId: input.workspaceId,
    participants: [createOwnerParticipant(now, input.ownerName)],
    messages: [
      createChatMessage({
        chatId,
        authorId: 'system',
        authorType: 'system',
        content: input.systemStarted,
        type: 'system',
      }),
    ],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  saveNativeChats([...loadNativeChats(), chat])
  return chat
}

export function createLegacyGroupDiscussion(
  input: CreateDiscussionInput,
  labels: {
    ownerName: string
    systemStarted: (names: string) => string
  },
): Chat {
  const uniqueEmployeeIds = [...new Set(input.employeeIds.filter((id) => id !== OWNER_ID))]
  const names = uniqueEmployeeIds
    .map((id) => resolveRosterEntry(id)?.codename)
    .filter((name): name is string => Boolean(name))

  const discussion = createDiscussion(input, {
    ownerName: labels.ownerName,
    systemStarted: (value) => labels.systemStarted(value || names.join(', ') || labels.ownerName),
  })

  return adaptDiscussionToChat(discussion)
}

export function appendOwnerMessageToChat(
  chatId: string,
  content: string,
  ownerName: string,
): Chat | null {
  const ref = parseChatRef(chatId)
  if (!ref) return null

  if (ref.source === 'virtual') return null

  if (ref.source === 'conversation') {
    const updated = appendConversationOwnerMessage(ref.employeeId, content, ownerName)
    return updated ? adaptConversationToChat(updated) : null
  }

  if (ref.source === 'discussion') {
    const updated = appendDiscussionOwnerMessage(ref.discussionId, content, ownerName)
    return updated ? adaptDiscussionToChat(updated) : null
  }

  const chats = loadNativeChats()
  const index = chats.findIndex((item) => item.id === ref.id)
  if (index === -1) return null

  const chat = chats[index]
  const message = createChatMessage({
    chatId: chat.id,
    authorId: OWNER_ID,
    authorType: 'owner',
    content: content.trim(),
    type: 'message',
  })

  return updateNativeChatAt(index, {
    ...chat,
    messages: [...chat.messages, message],
    updatedAt: message.createdAt,
  })
}

export function appendMockEmployeeReplies(
  chatId: string,
  replies: Array<{ employeeId: string; displayName: string; content: string }>,
): Chat | null {
  if (replies.length === 0) return getChatById(chatId)

  const ref = parseChatRef(chatId)
  if (!ref || ref.source === 'virtual') return getChatById(chatId)

  if (ref.source === 'conversation') {
    const employee = resolveEmployee(ref.employeeId)
    if (!employee || replies.length === 0) return getChatById(chatId)
    const reply = replies[0]
    const updated = appendEmployeeMessage(ref.employeeId, employee, reply.content)
    return updated ? adaptConversationToChat(updated) : null
  }

  if (ref.source === 'discussion') {
    const updated = appendEmployeeMessages(ref.discussionId, replies)
    return updated ? adaptDiscussionToChat(updated) : null
  }

  const chats = loadNativeChats()
  const index = chats.findIndex((item) => item.id === ref.id)
  if (index === -1) return null

  const chat = chats[index]
  const newMessages = replies.map((reply) =>
    createChatMessage({
      chatId: chat.id,
      authorId: reply.employeeId,
      authorType: 'employee',
      content: reply.content,
      type: 'message',
    }),
  )

  const lastCreatedAt = newMessages[newMessages.length - 1]?.createdAt ?? chat.updatedAt

  return updateNativeChatAt(index, {
    ...chat,
    messages: [...chat.messages, ...newMessages],
    updatedAt: lastCreatedAt,
  })
}

export function pickChatMockResponders(chat: Chat, max = 2): Chat['participants'] {
  if (chat.type === 'direct') {
    const employee = chat.participants.find(
      (participant) => participant.type === 'employee' && participant.employeeId,
    )
    return employee ? [employee] : []
  }

  if (chat.id.startsWith('disc:')) {
    const discussion = getDiscussionById(chat.id.slice(5))
    if (!discussion) return []
    return pickMockResponders(discussion, max).map((participant) => {
      const entry = resolveRosterEntry(participant.employeeId)
      return createEmployeeParticipant(
        participant.employeeId,
        entry?.codename ?? participant.employeeId,
        participant.role,
        chat.createdAt,
      )
    })
  }

  const members = chat.participants.filter(
    (participant) => participant.type === 'employee' && participant.employeeId,
  )
  if (members.length === 0) return []
  const shuffled = [...members].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(max, shuffled.length))
}

export function buildMockReply(codename: string, templates: string[]): string {
  const index = codename.length % templates.length
  return templates[index]?.replace('{name}', codename) ?? templates[0]?.replace('{name}', codename) ?? ''
}

export function resolveWorkspaceTitle(workspaceId: string): string {
  return getWorkspaceById(workspaceId)?.name ?? workspaceId
}

export function isChatWritable(chat: Chat): boolean {
  if (chat.type === 'system') return false
  if (chat.status === 'closed' || chat.status === 'archived') return false
  return true
}

export function readStorageKeys(): string[] {
  return [STORAGE_KEY, 'ai-company-conversations', 'ai-company-discussions']
}
