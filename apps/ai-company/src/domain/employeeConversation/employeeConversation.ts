/**
 * Employee Conversation V1 — доменный слой общения цифровых сотрудников (AI-COMPANY-101F).
 *
 * Не Owner chat (mission-control/conversation.ts).
 * Не Telegram / MAX Messenger — только internal domain + localStorage V1.
 */

export const EMPLOYEE_CONVERSATION_VERSION = 'v1' as const

export type EmployeeConversationVersion = typeof EMPLOYEE_CONVERSATION_VERSION

export const EMPLOYEE_CONVERSATION_KINDS = [
  'direct',
  'consultation',
  'handoff_thread',
] as const

export type EmployeeConversationKind = (typeof EMPLOYEE_CONVERSATION_KINDS)[number]

export const EMPLOYEE_CONVERSATION_STATUSES = [
  'open',
  'awaiting_reply',
  'resolved',
  'archived',
] as const

export type EmployeeConversationStatus = (typeof EMPLOYEE_CONVERSATION_STATUSES)[number]

export const EMPLOYEE_CONVERSATION_PARTICIPANT_ROLES = [
  'initiator',
  'responder',
  'observer',
] as const

export type EmployeeConversationParticipantRole =
  (typeof EMPLOYEE_CONVERSATION_PARTICIPANT_ROLES)[number]

/** Участник диалога — только digital employee (Owner — отдельный aggregate). */
export type EmployeeConversationParticipant = {
  employeeId: string
  role: EmployeeConversationParticipantRole
  displayName: string | null
  joinedAt: string
  leftAt: string | null
}

/** Scope и downstream-связи: откуда вопрос и куда пойдёт ответ. */
export type EmployeeConversationContext = {
  companyId: string
  workspaceId: string | null
  projectId: string | null
  /** Задача, из которой инициирован consult */
  originTaskId: string | null
  /** Задача, которая потребляет ответ (MAX Worker Loop / delivery task) */
  consumerTaskId: string | null
  runtimeRunId: string | null
  workerLoopId: string | null
  subject: string | null
  tags: string[]
}

export const EMPLOYEE_CONVERSATION_ATTACHMENT_KINDS = [
  'report',
  'run',
  'task',
  'handoff',
  'knowledge',
  'memory',
  'file',
  'document',
] as const

export type EmployeeConversationAttachmentKind =
  (typeof EMPLOYEE_CONVERSATION_ATTACHMENT_KINDS)[number]

/** Ссылка на артефакт — без inline blob. */
export type EmployeeConversationAttachmentRef = {
  id: string
  kind: EmployeeConversationAttachmentKind
  refId: string
  label: string
  path: string | null
  addedByEmployeeId: string
  addedAt: string
}

export const EMPLOYEE_CONVERSATION_MESSAGE_KINDS = [
  'question',
  'answer',
  'clarification',
  'decision_note',
  'system',
] as const

export type EmployeeConversationMessageKind =
  (typeof EMPLOYEE_CONVERSATION_MESSAGE_KINDS)[number]

export type EmployeeConversationMessage = {
  id: string
  conversationId: string
  authorEmployeeId: string
  kind: EmployeeConversationMessageKind
  body: string
  attachmentRefs: EmployeeConversationAttachmentRef[]
  inReplyToMessageId: string | null
  createdAt: string
  /** true когда downstream task/run зафиксировал использование текста */
  consumedAt: string | null
  consumedByTaskId: string | null
  metadata: Record<string, string | null>
}

export const EMPLOYEE_CONVERSATION_DECISION_STATUSES = [
  'proposed',
  'accepted',
  'rejected',
  'superseded',
] as const

export type EmployeeConversationDecisionStatus =
  (typeof EMPLOYEE_CONVERSATION_DECISION_STATUSES)[number]

/** Явное решение, извлечённое из переписки и применённое в работе. */
export type EmployeeConversationDecision = {
  id: string
  conversationId: string
  messageId: string
  proposedByEmployeeId: string
  summary: string
  rationale: string | null
  status: EmployeeConversationDecisionStatus
  acknowledgerEmployeeIds: string[]
  consumerTaskId: string | null
  consumerRunId: string | null
  createdAt: string
  resolvedAt: string | null
}

export type EmployeeConversation = {
  id: string
  version: EmployeeConversationVersion
  kind: EmployeeConversationKind
  status: EmployeeConversationStatus
  title: string
  participants: EmployeeConversationParticipant[]
  context: EmployeeConversationContext
  messages: EmployeeConversationMessage[]
  decisions: EmployeeConversationDecision[]
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export type CreateEmployeeConversationInput = {
  kind: EmployeeConversationKind
  title: string
  participants: Array<{
    employeeId: string
    role: EmployeeConversationParticipantRole
    displayName?: string | null
  }>
  context: Partial<EmployeeConversationContext> & Pick<EmployeeConversationContext, 'companyId'>
}

export type AppendEmployeeConversationMessageInput = {
  authorEmployeeId: string
  kind: EmployeeConversationMessageKind
  body: string
  inReplyToMessageId?: string | null
  attachmentRefs?: EmployeeConversationAttachmentRef[]
  metadata?: Record<string, string | null>
}

export type RecordEmployeeConversationDecisionInput = {
  messageId: string
  proposedByEmployeeId: string
  summary: string
  rationale?: string | null
  status?: EmployeeConversationDecisionStatus
  acknowledgerEmployeeIds?: string[]
  consumerTaskId?: string | null
  consumerRunId?: string | null
}

export type ConsumeEmployeeConversationMessageInput = {
  messageId: string
  consumerTaskId: string
  consumerRunId?: string | null
}

export type EmployeeConversationFilter = {
  companyId?: string
  employeeId?: string
  projectId?: string | null
  status?: EmployeeConversationStatus | 'all'
  kind?: EmployeeConversationKind | 'all'
}

export function createEmployeeConversationId(): string {
  return `emp-conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmployeeConversationMessageId(): string {
  return `emp-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmployeeConversationDecisionId(): string {
  return `emp-dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmployeeConversationAttachmentRefId(): string {
  return `emp-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function findParticipant(
  conversation: EmployeeConversation,
  employeeId: string,
): EmployeeConversationParticipant | null {
  return conversation.participants.find((item) => item.employeeId === employeeId) ?? null
}

export function findMessageById(
  conversation: EmployeeConversation,
  messageId: string,
): EmployeeConversationMessage | null {
  return conversation.messages.find((item) => item.id === messageId) ?? null
}

export function listParticipantEmployeeIds(conversation: EmployeeConversation): string[] {
  return conversation.participants.map((item) => item.employeeId)
}
