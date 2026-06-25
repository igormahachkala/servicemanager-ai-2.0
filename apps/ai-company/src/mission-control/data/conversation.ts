import { agents } from './mock'
import { loadCustomEmployees } from './customEmployees'

export const OWNER_ID = 'owner'

export type ConversationMessageAuthorType = 'owner' | 'employee' | 'system'

export type ConversationMessageAuthor = {
  type: ConversationMessageAuthorType
  id: string
  displayName: string
}

export type ConversationMessageType = 'message' | 'note' | 'system' | 'summary'

export type ConversationMessageStatus = 'sent' | 'pending' | 'failed' | 'draft'

export type ConversationMessage = {
  id: string
  author: ConversationMessageAuthor
  content: string
  createdAt: string
  type: ConversationMessageType
  status: ConversationMessageStatus
}

export type Conversation = {
  id: string
  employeeId: string
  createdAt: string
  updatedAt: string
  messages: ConversationMessage[]
}

export type EmployeeRef = {
  id: string
  codename: string
  name: string
  role: string
  source: 'builtin' | 'custom'
}

const STORAGE_KEY = 'ai-company-conversations'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAuthor(value: unknown): ConversationMessageAuthor | null {
  if (!isRecord(value)) return null
  if (
    (value.type !== 'owner' && value.type !== 'employee' && value.type !== 'system') ||
    typeof value.id !== 'string' ||
    typeof value.displayName !== 'string'
  ) {
    return null
  }
  return { type: value.type, id: value.id, displayName: value.displayName }
}

function parseMessage(value: unknown): ConversationMessage | null {
  if (!isRecord(value)) return null
  const author = parseAuthor(value.author)
  const type =
    value.type === 'message' ||
    value.type === 'note' ||
    value.type === 'system' ||
    value.type === 'summary'
      ? value.type
      : 'message'
  const status =
    value.status === 'sent' ||
    value.status === 'pending' ||
    value.status === 'failed' ||
    value.status === 'draft'
      ? value.status
      : 'sent'

  if (
    !author ||
    typeof value.id !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    author,
    content: value.content,
    createdAt: value.createdAt,
    type,
    status,
  }
}

function parseConversation(value: unknown): Conversation | null {
  if (!isRecord(value)) return null
  const messages = Array.isArray(value.messages)
    ? value.messages.map(parseMessage).filter((item): item is ConversationMessage => item !== null)
    : []

  if (
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    employeeId: value.employeeId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    messages,
  }
}

export function resolveEmployee(employeeId: string): EmployeeRef | null {
  const agent = agents.find((item) => item.id === employeeId)
  if (agent) {
    return {
      id: agent.id,
      codename: agent.codename,
      name: agent.codename,
      role: agent.role,
      source: 'builtin',
    }
  }

  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  if (custom) {
    return {
      id: custom.id,
      codename: custom.codename,
      name: custom.name,
      role: custom.role,
      source: 'custom',
    }
  }

  return null
}

export function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseConversation).filter((item): item is Conversation => item !== null)
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  } catch {
    /* noop */
  }
}

function createMessage(
  author: ConversationMessageAuthor,
  content: string,
  type: ConversationMessageType = 'message',
  status: ConversationMessageStatus = 'sent',
): ConversationMessage {
  return {
    id: `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author,
    content,
    createdAt: new Date().toISOString(),
    type,
    status,
  }
}

export function getConversationByEmployeeId(employeeId: string): Conversation | null {
  return loadConversations().find((item) => item.employeeId === employeeId) ?? null
}

export function getOrCreateConversation(
  employeeId: string,
  labels: { systemWelcome: (name: string) => string },
): Conversation | null {
  const employee = resolveEmployee(employeeId)
  if (!employee) return null

  const existing = getConversationByEmployeeId(employeeId)
  if (existing) return existing

  const now = new Date().toISOString()
  const conversation: Conversation = {
    id: `conversation-${employeeId}-${Date.now()}`,
    employeeId,
    createdAt: now,
    updatedAt: now,
    messages: [
      createMessage(
        { type: 'system', id: 'system', displayName: 'System' },
        labels.systemWelcome(employee.name || employee.codename),
        'system',
      ),
    ],
  }

  saveConversations([...loadConversations(), conversation])
  return conversation
}

function updateConversationAt(index: number, conversation: Conversation): Conversation {
  const all = loadConversations()
  const next = [...all]
  next[index] = conversation
  saveConversations(next)
  return conversation
}

export function appendOwnerMessage(
  employeeId: string,
  content: string,
  ownerName: string,
): Conversation | null {
  const conversations = loadConversations()
  const index = conversations.findIndex((item) => item.employeeId === employeeId)
  if (index === -1) return null

  const conversation = conversations[index]
  const message = createMessage(
    { type: 'owner', id: OWNER_ID, displayName: ownerName },
    content.trim(),
    'message',
  )

  return updateConversationAt(index, {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: message.createdAt,
  })
}

export function appendEmployeeMessage(
  employeeId: string,
  employee: EmployeeRef,
  content: string,
): Conversation | null {
  const conversations = loadConversations()
  const index = conversations.findIndex((item) => item.employeeId === employeeId)
  if (index === -1) return null

  const conversation = conversations[index]
  const message = createMessage(
    { type: 'employee', id: employee.id, displayName: employee.codename },
    content,
    'message',
  )

  return updateConversationAt(index, {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: message.createdAt,
  })
}

export function buildMockReply(codename: string, templates: string[]): string {
  const index = codename.length % templates.length
  return templates[index]?.replace('{name}', codename) ?? templates[0]?.replace('{name}', codename) ?? ''
}
