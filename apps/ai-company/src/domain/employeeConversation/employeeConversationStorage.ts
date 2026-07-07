import {
  type AppendEmployeeConversationMessageInput,
  type ConsumeEmployeeConversationMessageInput,
  type CreateEmployeeConversationInput,
  type EmployeeConversation,
  type EmployeeConversationAttachmentRef,
  type EmployeeConversationContext,
  type EmployeeConversationDecision,
  type EmployeeConversationFilter,
  type EmployeeConversationMessage,
  type EmployeeConversationParticipant,
  type RecordEmployeeConversationDecisionInput,
  EMPLOYEE_CONVERSATION_ATTACHMENT_KINDS,
  EMPLOYEE_CONVERSATION_DECISION_STATUSES,
  EMPLOYEE_CONVERSATION_KINDS,
  EMPLOYEE_CONVERSATION_MESSAGE_KINDS,
  EMPLOYEE_CONVERSATION_PARTICIPANT_ROLES,
  EMPLOYEE_CONVERSATION_STATUSES,
  EMPLOYEE_CONVERSATION_VERSION,
  createEmployeeConversationAttachmentRefId,
  createEmployeeConversationDecisionId,
  createEmployeeConversationId,
  createEmployeeConversationMessageId,
  findMessageById,
  findParticipant,
} from './employeeConversation'

const STORAGE_KEY = 'ai-company-employee-conversations'

/** V1: browser localStorage. V2: EmployeeConversationStoragePort → server API. */

function nowIso(): string {
  return new Date().toISOString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

function parseAttachmentRef(value: unknown): EmployeeConversationAttachmentRef | null {
  if (!isRecord(value)) return null
  const kind = parseEnum(value.kind, EMPLOYEE_CONVERSATION_ATTACHMENT_KINDS)
  if (
    !kind ||
    typeof value.id !== 'string' ||
    typeof value.refId !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.addedByEmployeeId !== 'string' ||
    typeof value.addedAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    kind,
    refId: value.refId,
    label: value.label,
    path: typeof value.path === 'string' ? value.path : null,
    addedByEmployeeId: value.addedByEmployeeId,
    addedAt: value.addedAt,
  }
}

function parseParticipant(value: unknown): EmployeeConversationParticipant | null {
  if (!isRecord(value)) return null
  const role = parseEnum(value.role, EMPLOYEE_CONVERSATION_PARTICIPANT_ROLES)
  if (!role || typeof value.employeeId !== 'string' || typeof value.joinedAt !== 'string') {
    return null
  }
  return {
    employeeId: value.employeeId,
    role,
    displayName: typeof value.displayName === 'string' ? value.displayName : null,
    joinedAt: value.joinedAt,
    leftAt: typeof value.leftAt === 'string' ? value.leftAt : null,
  }
}

function parseContext(value: unknown): EmployeeConversationContext | null {
  if (!isRecord(value) || typeof value.companyId !== 'string') return null
  return {
    companyId: value.companyId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    originTaskId: typeof value.originTaskId === 'string' ? value.originTaskId : null,
    consumerTaskId: typeof value.consumerTaskId === 'string' ? value.consumerTaskId : null,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    workerLoopId: typeof value.workerLoopId === 'string' ? value.workerLoopId : null,
    subject: typeof value.subject === 'string' ? value.subject : null,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

function parseMetadata(value: unknown): Record<string, string | null> {
  if (!isRecord(value)) return {}
  const out: Record<string, string | null> = {}
  for (const [key, entry] of Object.entries(value)) {
    out[key] = typeof entry === 'string' ? entry : entry === null ? null : String(entry)
  }
  return out
}

function parseMessage(value: unknown): EmployeeConversationMessage | null {
  if (!isRecord(value)) return null
  const kind = parseEnum(value.kind, EMPLOYEE_CONVERSATION_MESSAGE_KINDS)
  if (
    !kind ||
    typeof value.id !== 'string' ||
    typeof value.conversationId !== 'string' ||
    typeof value.authorEmployeeId !== 'string' ||
    typeof value.body !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }
  const attachmentRefs = Array.isArray(value.attachmentRefs)
    ? value.attachmentRefs.map(parseAttachmentRef).filter((item): item is EmployeeConversationAttachmentRef => item !== null)
    : []

  return {
    id: value.id,
    conversationId: value.conversationId,
    authorEmployeeId: value.authorEmployeeId,
    kind,
    body: value.body,
    attachmentRefs,
    inReplyToMessageId:
      typeof value.inReplyToMessageId === 'string' ? value.inReplyToMessageId : null,
    createdAt: value.createdAt,
    consumedAt: typeof value.consumedAt === 'string' ? value.consumedAt : null,
    consumedByTaskId:
      typeof value.consumedByTaskId === 'string' ? value.consumedByTaskId : null,
    metadata: parseMetadata(value.metadata),
  }
}

function parseDecision(value: unknown): EmployeeConversationDecision | null {
  if (!isRecord(value)) return null
  const status = parseEnum(value.status, EMPLOYEE_CONVERSATION_DECISION_STATUSES)
  if (
    !status ||
    typeof value.id !== 'string' ||
    typeof value.conversationId !== 'string' ||
    typeof value.messageId !== 'string' ||
    typeof value.proposedByEmployeeId !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    conversationId: value.conversationId,
    messageId: value.messageId,
    proposedByEmployeeId: value.proposedByEmployeeId,
    summary: value.summary,
    rationale: typeof value.rationale === 'string' ? value.rationale : null,
    status,
    acknowledgerEmployeeIds: Array.isArray(value.acknowledgerEmployeeIds)
      ? value.acknowledgerEmployeeIds.filter((item): item is string => typeof item === 'string')
      : [],
    consumerTaskId: typeof value.consumerTaskId === 'string' ? value.consumerTaskId : null,
    consumerRunId: typeof value.consumerRunId === 'string' ? value.consumerRunId : null,
    createdAt: value.createdAt,
    resolvedAt: typeof value.resolvedAt === 'string' ? value.resolvedAt : null,
  }
}

function parseConversation(value: unknown): EmployeeConversation | null {
  if (!isRecord(value)) return null
  const kind = parseEnum(value.kind, EMPLOYEE_CONVERSATION_KINDS)
  const status = parseEnum(value.status, EMPLOYEE_CONVERSATION_STATUSES)
  const context = parseContext(value.context)
  if (
    !kind ||
    !status ||
    !context ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const participants = Array.isArray(value.participants)
    ? value.participants.map(parseParticipant).filter((item): item is EmployeeConversationParticipant => item !== null)
    : []
  const messages = Array.isArray(value.messages)
    ? value.messages.map(parseMessage).filter((item): item is EmployeeConversationMessage => item !== null)
    : []
  const decisions = Array.isArray(value.decisions)
    ? value.decisions.map(parseDecision).filter((item): item is EmployeeConversationDecision => item !== null)
    : []

  return {
    id: value.id,
    version: EMPLOYEE_CONVERSATION_VERSION,
    kind,
    status,
    title: value.title,
    participants,
    context,
    messages,
    decisions,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    resolvedAt: typeof value.resolvedAt === 'string' ? value.resolvedAt : null,
  }
}

export function loadEmployeeConversations(): EmployeeConversation[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseConversation).filter((item): item is EmployeeConversation => item !== null)
  } catch {
    return []
  }
}

export function saveEmployeeConversations(conversations: EmployeeConversation[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
}

export function getEmployeeConversationById(id: string): EmployeeConversation | null {
  return loadEmployeeConversations().find((item) => item.id === id) ?? null
}

export function upsertEmployeeConversation(conversation: EmployeeConversation): EmployeeConversation {
  const items = loadEmployeeConversations()
  const index = items.findIndex((item) => item.id === conversation.id)
  if (index >= 0) {
    items[index] = conversation
  } else {
    items.unshift(conversation)
  }
  saveEmployeeConversations(items)
  return conversation
}

function defaultContext(
  partial: Partial<EmployeeConversationContext> & Pick<EmployeeConversationContext, 'companyId'>,
): EmployeeConversationContext {
  return {
    companyId: partial.companyId,
    workspaceId: partial.workspaceId ?? null,
    projectId: partial.projectId ?? null,
    originTaskId: partial.originTaskId ?? null,
    consumerTaskId: partial.consumerTaskId ?? null,
    runtimeRunId: partial.runtimeRunId ?? null,
    workerLoopId: partial.workerLoopId ?? null,
    subject: partial.subject ?? null,
    tags: partial.tags ?? [],
  }
}

export function createEmployeeConversation(
  input: CreateEmployeeConversationInput,
): EmployeeConversation {
  const now = nowIso()
  const id = createEmployeeConversationId()
  const conversation: EmployeeConversation = {
    id,
    version: EMPLOYEE_CONVERSATION_VERSION,
    kind: input.kind,
    status: 'open',
    title: input.title.trim(),
    participants: input.participants.map((item) => ({
      employeeId: item.employeeId,
      role: item.role,
      displayName: item.displayName ?? null,
      joinedAt: now,
      leftAt: null,
    })),
    context: defaultContext(input.context),
    messages: [],
    decisions: [],
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  }
  return upsertEmployeeConversation(conversation)
}

export function listEmployeeConversations(
  filter: EmployeeConversationFilter = {},
): EmployeeConversation[] {
  return loadEmployeeConversations().filter((conversation) => {
    if (filter.companyId && conversation.context.companyId !== filter.companyId) return false
    if (filter.projectId && conversation.context.projectId !== filter.projectId) return false
    if (filter.status && filter.status !== 'all' && conversation.status !== filter.status) {
      return false
    }
    if (filter.kind && filter.kind !== 'all' && conversation.kind !== filter.kind) return false
    if (filter.employeeId) {
      const participant = findParticipant(conversation, filter.employeeId)
      if (!participant) return false
    }
    return true
  })
}

export function appendEmployeeConversationMessage(
  conversationId: string,
  input: AppendEmployeeConversationMessageInput,
): EmployeeConversation {
  const conversation = getEmployeeConversationById(conversationId)
  if (!conversation) {
    throw new Error(`Employee conversation not found: ${conversationId}`)
  }
  if (!findParticipant(conversation, input.authorEmployeeId)) {
    throw new Error(`Author is not a participant: ${input.authorEmployeeId}`)
  }
  if (input.inReplyToMessageId) {
    const parent = findMessageById(conversation, input.inReplyToMessageId)
    if (!parent) {
      throw new Error(`Reply target message not found: ${input.inReplyToMessageId}`)
    }
  }

  const now = nowIso()
  const message: EmployeeConversationMessage = {
    id: createEmployeeConversationMessageId(),
    conversationId,
    authorEmployeeId: input.authorEmployeeId,
    kind: input.kind,
    body: input.body.trim(),
    attachmentRefs: input.attachmentRefs ?? [],
    inReplyToMessageId: input.inReplyToMessageId ?? null,
    createdAt: now,
    consumedAt: null,
    consumedByTaskId: null,
    metadata: input.metadata ?? {},
  }

  const nextStatus: EmployeeConversation['status'] =
    input.kind === 'question' ? 'awaiting_reply' : conversation.status === 'open' ? 'open' : conversation.status

  const updated: EmployeeConversation = {
    ...conversation,
    messages: [...conversation.messages, message],
    status: input.kind === 'answer' ? 'resolved' : nextStatus,
    updatedAt: now,
    resolvedAt: input.kind === 'answer' ? now : conversation.resolvedAt,
  }

  return upsertEmployeeConversation(updated)
}

export function recordEmployeeConversationDecision(
  conversationId: string,
  input: RecordEmployeeConversationDecisionInput,
): EmployeeConversation {
  const conversation = getEmployeeConversationById(conversationId)
  if (!conversation) {
    throw new Error(`Employee conversation not found: ${conversationId}`)
  }
  const message = findMessageById(conversation, input.messageId)
  if (!message) {
    throw new Error(`Decision source message not found: ${input.messageId}`)
  }

  const now = nowIso()
  const status = input.status ?? 'accepted'
  const decision: EmployeeConversationDecision = {
    id: createEmployeeConversationDecisionId(),
    conversationId,
    messageId: input.messageId,
    proposedByEmployeeId: input.proposedByEmployeeId,
    summary: input.summary.trim(),
    rationale: input.rationale?.trim() ?? null,
    status,
    acknowledgerEmployeeIds: input.acknowledgerEmployeeIds ?? [],
    consumerTaskId: input.consumerTaskId ?? null,
    consumerRunId: input.consumerRunId ?? null,
    createdAt: now,
    resolvedAt: status === 'proposed' ? null : now,
  }

  return upsertEmployeeConversation({
    ...conversation,
    decisions: [...conversation.decisions, decision],
    updatedAt: now,
  })
}

export function consumeEmployeeConversationMessage(
  conversationId: string,
  input: ConsumeEmployeeConversationMessageInput,
): EmployeeConversation {
  const conversation = getEmployeeConversationById(conversationId)
  if (!conversation) {
    throw new Error(`Employee conversation not found: ${conversationId}`)
  }
  const messageIndex = conversation.messages.findIndex((item) => item.id === input.messageId)
  if (messageIndex < 0) {
    throw new Error(`Message not found: ${input.messageId}`)
  }

  const now = nowIso()
  const messages = [...conversation.messages]
  messages[messageIndex] = {
    ...messages[messageIndex],
    consumedAt: now,
    consumedByTaskId: input.consumerTaskId,
    metadata: {
      ...messages[messageIndex].metadata,
      consumerRunId: input.consumerRunId ?? null,
    },
  }

  return upsertEmployeeConversation({
    ...conversation,
    messages,
    context: {
      ...conversation.context,
      consumerTaskId: input.consumerTaskId,
      runtimeRunId: input.consumerRunId ?? conversation.context.runtimeRunId,
    },
    updatedAt: now,
  })
}

export function buildEmployeeConversationAttachmentRef(input: {
  kind: EmployeeConversationAttachmentRef['kind']
  refId: string
  label: string
  addedByEmployeeId: string
  path?: string | null
}): EmployeeConversationAttachmentRef {
  return {
    id: createEmployeeConversationAttachmentRefId(),
    kind: input.kind,
    refId: input.refId,
    label: input.label,
    path: input.path ?? null,
    addedByEmployeeId: input.addedByEmployeeId,
    addedAt: nowIso(),
  }
}

/** Сброс store — только для dev/tests. */
export function clearEmployeeConversations(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export const EMPLOYEE_CONVERSATION_STORAGE_KEY = STORAGE_KEY
