/**
 * Mobile employee chat — types (110A + 112E delegation).
 */

import type { WorkPriority } from '../../domain/employeeWorkQueue'
import { type WorkItemStructuredPayload } from '../../domain/employeeWorkQueue/workItemStructuredPayload'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'

export const MOBILE_EMPLOYEE_CHAT_VERSION = 'v1' as const
export const MOBILE_EMPLOYEE_CHAT_STORAGE_KEY = 'ai-company-mobile-employee-chat'
export const MOBILE_EMPLOYEE_CHAT_SYNC_EVENT = 'ai-company-mobile-employee-chat-sync'

export const MOBILE_EMPLOYEE_CHAT_MESSAGE_KINDS = [
  'question',
  'task_request',
  'clarification',
  'task_proposal',
  'delegation_proposal',
  'delegation_event',
  'delegation_review',
  'cursor_handoff',
  'report_link',
  'system_status',
] as const

export type MobileEmployeeChatMessageKind = (typeof MOBILE_EMPLOYEE_CHAT_MESSAGE_KINDS)[number]

export const MOBILE_EMPLOYEE_CHAT_ROLES = ['owner', 'max', 'system'] as const

export type MobileEmployeeChatRole = (typeof MOBILE_EMPLOYEE_CHAT_ROLES)[number]

export const MOBILE_EMPLOYEE_CHAT_DELEGATION_STATUSES = [
  'pending',
  'awaiting_execution',
  'delegated',
  'cancelled',
  'keep_max',
] as const

export type MobileEmployeeChatDelegationStatus =
  (typeof MOBILE_EMPLOYEE_CHAT_DELEGATION_STATUSES)[number]

export type MobileEmployeeChatDelegationAlternative = {
  employeeId: string
  displayName: string
  title: string
  whyNotChosen: string | null
}

export type MobileEmployeeChatTaskProposal = {
  title: string
  taskText: string
  priority?: WorkPriority
  expectedResult?: string | null
  structuredPayload?: WorkItemStructuredPayload | null
  sourceMessageId: string | null
}

export type MobileEmployeeChatDelegationProposal = {
  delegationPlanId: string
  recommendedEmployeeId: string
  selectedEmployeeId: string
  recommendedDisplayName: string
  recommendedTitle: string
  reason: string
  confidence: number
  expectedResult: string
  afterConfirmSummary: string
  alternatives: MobileEmployeeChatDelegationAlternative[]
  taskProposal: MobileEmployeeChatTaskProposal
  status: MobileEmployeeChatDelegationStatus
  sourceMessageId: string | null
}

export type MobileEmployeeChatDelegationReviewStatus =
  | 'awaiting_review'
  | 'accepted'
  | 'rework_requested'
  | 'failed'

export type MobileEmployeeChatDelegationReviewSnapshot = {
  reviewId: string
  status: MobileEmployeeChatDelegationReviewStatus
  builderEmployeeId: string
  builderDisplayName: string
  taskTitle: string
  reportId: string
  workItemId: string
  delegationPlanId: string
  reworkNotes?: string | null
}

export type MobileEmployeeChatMessage = {
  id: string
  role: MobileEmployeeChatRole
  kind: MobileEmployeeChatMessageKind
  content: string
  createdAt: string
  taskProposal?: MobileEmployeeChatTaskProposal | null
  delegationProposal?: MobileEmployeeChatDelegationProposal | null
  delegationReview?: MobileEmployeeChatDelegationReviewSnapshot | null
  reportId?: string | null
  runtimeRunId?: string | null
  workerLoopId?: string | null
  workItemId?: string | null
  cursorHandoffId?: string | null
  pending?: boolean
  error?: boolean
}

export type MobileEmployeeChatSession = {
  version: typeof MOBILE_EMPLOYEE_CHAT_VERSION
  employeeId: string
  messages: MobileEmployeeChatMessage[]
  updatedAt: string
}

export type MobileEmployeeChatStore = {
  version: typeof MOBILE_EMPLOYEE_CHAT_VERSION
  sessions: Record<string, MobileEmployeeChatSession>
}

export const MOBILE_MAX_CHAT_EMPLOYEE_ID = MAX_WORKER_EMPLOYEE_ID

export function createMobileEmployeeChatMessageId(): string {
  return `mec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

function parseTaskProposal(value: unknown): MobileEmployeeChatTaskProposal | null {
  if (!isRecord(value)) return null
  if (typeof value.title !== 'string' || typeof value.taskText !== 'string') return null
  const priority =
    value.priority === 'low' ||
    value.priority === 'medium' ||
    value.priority === 'high' ||
    value.priority === 'critical'
      ? value.priority
      : 'medium'
  return {
    title: value.title,
    taskText: value.taskText,
    priority,
    expectedResult: typeof value.expectedResult === 'string' ? value.expectedResult : '',
    structuredPayload:
      value.structuredPayload && typeof value.structuredPayload === 'object'
        ? (value.structuredPayload as WorkItemStructuredPayload)
        : null,
    sourceMessageId: typeof value.sourceMessageId === 'string' ? value.sourceMessageId : null,
  }
}

function parseDelegationAlternative(value: unknown): MobileEmployeeChatDelegationAlternative | null {
  if (!isRecord(value)) return null
  if (typeof value.employeeId !== 'string' || typeof value.displayName !== 'string') return null
  if (typeof value.title !== 'string') return null
  return {
    employeeId: value.employeeId,
    displayName: value.displayName,
    title: value.title,
    whyNotChosen: typeof value.whyNotChosen === 'string' ? value.whyNotChosen : null,
  }
}

function parseDelegationProposal(value: unknown): MobileEmployeeChatDelegationProposal | null {
  if (!isRecord(value)) return null
  const taskProposal = parseTaskProposal(value.taskProposal)
  const status = parseEnum(value.status, MOBILE_EMPLOYEE_CHAT_DELEGATION_STATUSES)
  if (
    !taskProposal ||
    !status ||
    typeof value.delegationPlanId !== 'string' ||
    typeof value.recommendedEmployeeId !== 'string' ||
    typeof value.selectedEmployeeId !== 'string' ||
    typeof value.recommendedDisplayName !== 'string' ||
    typeof value.recommendedTitle !== 'string' ||
    typeof value.reason !== 'string' ||
    typeof value.expectedResult !== 'string' ||
    typeof value.afterConfirmSummary !== 'string' ||
    typeof value.confidence !== 'number'
  ) {
    return null
  }

  const alternatives = Array.isArray(value.alternatives)
    ? value.alternatives
        .map(parseDelegationAlternative)
        .filter((item): item is MobileEmployeeChatDelegationAlternative => item !== null)
    : []

  return {
    delegationPlanId: value.delegationPlanId,
    recommendedEmployeeId: value.recommendedEmployeeId,
    selectedEmployeeId: value.selectedEmployeeId,
    recommendedDisplayName: value.recommendedDisplayName,
    recommendedTitle: value.recommendedTitle,
    reason: value.reason,
    confidence: value.confidence,
    expectedResult: value.expectedResult,
    afterConfirmSummary: value.afterConfirmSummary,
    alternatives,
    taskProposal,
    status,
    sourceMessageId: typeof value.sourceMessageId === 'string' ? value.sourceMessageId : null,
  }
}

function parseDelegationReview(value: unknown): MobileEmployeeChatDelegationReviewSnapshot | null {
  if (!isRecord(value)) return null
  const status =
    value.status === 'awaiting_review' ||
    value.status === 'accepted' ||
    value.status === 'rework_requested' ||
    value.status === 'failed'
      ? value.status
      : null
  if (
    !status ||
    typeof value.reviewId !== 'string' ||
    typeof value.builderEmployeeId !== 'string' ||
    typeof value.builderDisplayName !== 'string' ||
    typeof value.taskTitle !== 'string' ||
    typeof value.reportId !== 'string' ||
    typeof value.workItemId !== 'string' ||
    typeof value.delegationPlanId !== 'string'
  ) {
    return null
  }
  return {
    reviewId: value.reviewId,
    status,
    builderEmployeeId: value.builderEmployeeId,
    builderDisplayName: value.builderDisplayName,
    taskTitle: value.taskTitle,
    reportId: value.reportId,
    workItemId: value.workItemId,
    delegationPlanId: value.delegationPlanId,
    reworkNotes: typeof value.reworkNotes === 'string' ? value.reworkNotes : null,
  }
}

export function parseMobileEmployeeChatMessage(value: unknown): MobileEmployeeChatMessage | null {
  if (!isRecord(value)) return null
  const role = parseEnum(value.role, MOBILE_EMPLOYEE_CHAT_ROLES)
  const kind = parseEnum(value.kind, MOBILE_EMPLOYEE_CHAT_MESSAGE_KINDS)
  if (!role || !kind || typeof value.id !== 'string' || typeof value.content !== 'string') {
    return null
  }
  if (typeof value.createdAt !== 'string') return null

  return {
    id: value.id,
    role,
    kind,
    content: value.content,
    createdAt: value.createdAt,
    taskProposal: value.taskProposal ? parseTaskProposal(value.taskProposal) : null,
    delegationProposal: value.delegationProposal
      ? parseDelegationProposal(value.delegationProposal)
      : null,
    delegationReview: value.delegationReview ? parseDelegationReview(value.delegationReview) : null,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    workerLoopId: typeof value.workerLoopId === 'string' ? value.workerLoopId : null,
    workItemId: typeof value.workItemId === 'string' ? value.workItemId : null,
    cursorHandoffId: typeof value.cursorHandoffId === 'string' ? value.cursorHandoffId : null,
    pending: value.pending === true,
    error: value.error === true,
  }
}

export function parseMobileEmployeeChatSession(value: unknown): MobileEmployeeChatSession | null {
  if (!isRecord(value)) return null
  if (value.version !== MOBILE_EMPLOYEE_CHAT_VERSION || typeof value.employeeId !== 'string') {
    return null
  }
  if (!Array.isArray(value.messages) || typeof value.updatedAt !== 'string') return null

  const messages = value.messages
    .map(parseMobileEmployeeChatMessage)
    .filter((item): item is MobileEmployeeChatMessage => item !== null)

  return {
    version: MOBILE_EMPLOYEE_CHAT_VERSION,
    employeeId: value.employeeId,
    messages,
    updatedAt: value.updatedAt,
  }
}

export function parseMobileEmployeeChatStore(value: unknown): MobileEmployeeChatStore | null {
  if (!isRecord(value)) return null
  if (value.version !== MOBILE_EMPLOYEE_CHAT_VERSION || !isRecord(value.sessions)) return null

  const sessions: Record<string, MobileEmployeeChatSession> = {}
  for (const [key, sessionValue] of Object.entries(value.sessions)) {
    const session = parseMobileEmployeeChatSession(sessionValue)
    if (session) sessions[key] = session
  }

  return {
    version: MOBILE_EMPLOYEE_CHAT_VERSION,
    sessions,
  }
}

export function buildWelcomeChatMessage(copy: {
  welcome: string
}): MobileEmployeeChatMessage {
  return {
    id: createMobileEmployeeChatMessageId(),
    role: 'system',
    kind: 'system_status',
    content: copy.welcome,
    createdAt: new Date().toISOString(),
  }
}
