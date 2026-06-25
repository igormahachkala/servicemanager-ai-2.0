import { agents } from './mock'
import { loadCustomEmployees } from './customEmployees'

export type DiscussionStatus = 'open' | 'closed'

export type ParticipantRole = 'owner' | 'member' | 'observer'

export type MessageAuthorType = 'owner' | 'employee' | 'system'

export type MessageType = 'text' | 'system' | 'decision'

export type DiscussionParticipant = {
  employeeId: string
  role: ParticipantRole
}

export type DiscussionMessageAuthor = {
  type: MessageAuthorType
  employeeId: string
  displayName: string
}

export type DiscussionMessage = {
  id: string
  author: DiscussionMessageAuthor
  content: string
  createdAt: string
  type: MessageType
}

export type Discussion = {
  id: string
  title: string
  participants: DiscussionParticipant[]
  messages: DiscussionMessage[]
  status: DiscussionStatus
  createdAt: string
  updatedAt: string
}

export type DiscussionRosterEntry = {
  id: string
  codename: string
  role: string
  source: 'builtin' | 'custom'
}

export type CreateDiscussionInput = {
  title: string
  employeeIds: string[]
}

export const OWNER_ID = 'owner'

const STORAGE_KEY = 'ai-company-discussions'

export function getDiscussionRoster(): DiscussionRosterEntry[] {
  const builtin = agents.map((agent) => ({
    id: agent.id,
    codename: agent.codename,
    role: agent.role,
    source: 'builtin' as const,
  }))

  const custom = loadCustomEmployees().map((employee) => ({
    id: employee.id,
    codename: employee.codename,
    role: employee.role,
    source: 'custom' as const,
  }))

  return [...builtin, ...custom]
}

export function resolveRosterEntry(id: string): DiscussionRosterEntry | null {
  if (id === OWNER_ID) {
    return { id: OWNER_ID, codename: 'Owner', role: 'Owner', source: 'builtin' }
  }
  return getDiscussionRoster().find((entry) => entry.id === id) ?? null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseMessage(value: unknown): DiscussionMessage | null {
  if (!isRecord(value)) return null
  const authorRaw = isRecord(value.author) ? value.author : null
  if (
    !authorRaw ||
    typeof value.id !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string' ||
    (value.type !== 'text' && value.type !== 'system' && value.type !== 'decision') ||
    (authorRaw.type !== 'owner' && authorRaw.type !== 'employee' && authorRaw.type !== 'system') ||
    typeof authorRaw.employeeId !== 'string' ||
    typeof authorRaw.displayName !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    author: {
      type: authorRaw.type,
      employeeId: authorRaw.employeeId,
      displayName: authorRaw.displayName,
    },
    content: value.content,
    createdAt: value.createdAt,
    type: value.type,
  }
}

function parseDiscussion(value: unknown): Discussion | null {
  if (!isRecord(value)) return null

  const status = value.status === 'open' || value.status === 'closed' ? value.status : 'open'
  const participants = Array.isArray(value.participants)
    ? value.participants
        .map((item): DiscussionParticipant | null => {
          if (!isRecord(item) || typeof item.employeeId !== 'string') return null
          const role =
            item.role === 'owner' || item.role === 'member' || item.role === 'observer'
              ? item.role
              : 'member'
          return { employeeId: item.employeeId, role }
        })
        .filter((item): item is DiscussionParticipant => item !== null)
    : []

  const messages = Array.isArray(value.messages)
    ? value.messages.map(parseMessage).filter((item): item is DiscussionMessage => item !== null)
    : []

  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    title: value.title,
    participants,
    messages,
    status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadDiscussions(): Discussion[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseDiscussion).filter((item): item is Discussion => item !== null)
  } catch {
    return []
  }
}

export function saveDiscussions(discussions: Discussion[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(discussions))
  } catch {
    /* noop */
  }
}

function createMessage(
  author: DiscussionMessageAuthor,
  content: string,
  type: MessageType = 'text',
): DiscussionMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author,
    content,
    createdAt: new Date().toISOString(),
    type,
  }
}

export function getDiscussionById(id: string): Discussion | null {
  return loadDiscussions().find((discussion) => discussion.id === id) ?? null
}

export function createDiscussion(
  input: CreateDiscussionInput,
  labels: { ownerName: string; systemStarted: (names: string) => string },
): Discussion {
  const now = new Date().toISOString()
  const uniqueEmployeeIds = [...new Set(input.employeeIds.filter((id) => id !== OWNER_ID))]

  const participants: DiscussionParticipant[] = [
    { employeeId: OWNER_ID, role: 'owner' },
    ...uniqueEmployeeIds.map((employeeId) => ({ employeeId, role: 'member' as const })),
  ]

  const names = uniqueEmployeeIds
    .map((id) => resolveRosterEntry(id)?.codename)
    .filter((name): name is string => Boolean(name))

  const discussion: Discussion = {
    id: `discussion-${Date.now()}`,
    title: input.title.trim(),
    participants,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    messages: [
      createMessage(
        { type: 'system', employeeId: 'system', displayName: 'System' },
        labels.systemStarted(names.join(', ') || labels.ownerName),
        'system',
      ),
    ],
  }

  saveDiscussions([...loadDiscussions(), discussion])
  return discussion
}

export function appendOwnerMessage(discussionId: string, content: string, ownerName: string): Discussion | null {
  const discussions = loadDiscussions()
  const index = discussions.findIndex((item) => item.id === discussionId)
  if (index === -1) return null

  const discussion = discussions[index]
  const message = createMessage(
    { type: 'owner', employeeId: OWNER_ID, displayName: ownerName },
    content.trim(),
    'text',
  )

  const updated: Discussion = {
    ...discussion,
    messages: [...discussion.messages, message],
    updatedAt: message.createdAt,
  }

  const next = [...discussions]
  next[index] = updated
  saveDiscussions(next)
  return updated
}

export function appendEmployeeMessages(
  discussionId: string,
  replies: Array<{ employeeId: string; displayName: string; content: string }>,
): Discussion | null {
  if (replies.length === 0) return getDiscussionById(discussionId)

  const discussions = loadDiscussions()
  const index = discussions.findIndex((item) => item.id === discussionId)
  if (index === -1) return null

  const discussion = discussions[index]
  const newMessages = replies.map((reply) =>
    createMessage(
      { type: 'employee', employeeId: reply.employeeId, displayName: reply.displayName },
      reply.content,
      'text',
    ),
  )

  const lastCreatedAt = newMessages[newMessages.length - 1]?.createdAt ?? discussion.updatedAt
  const updated: Discussion = {
    ...discussion,
    messages: [...discussion.messages, ...newMessages],
    updatedAt: lastCreatedAt,
  }

  const next = [...discussions]
  next[index] = updated
  saveDiscussions(next)
  return updated
}

export function pickMockResponders(discussion: Discussion, max = 2): DiscussionParticipant[] {
  const members = discussion.participants.filter(
    (participant) => participant.role === 'member' && participant.employeeId !== OWNER_ID,
  )
  if (members.length === 0) return []

  const shuffled = [...members].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(max, shuffled.length))
}

export function buildMockReplyContent(codename: string, templates: string[]): string {
  const index = codename.length % templates.length
  return templates[index]?.replace('{name}', codename) ?? templates[0]?.replace('{name}', codename) ?? ''
}
