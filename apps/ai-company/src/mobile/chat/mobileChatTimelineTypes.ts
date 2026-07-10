/**
 * Mobile MAX Chat Timeline V2 — unified feed types (AI-COMPANY-111C).
 */

import type { MobileEmployeeChatMessage, MobileEmployeeChatRole } from './mobileEmployeeChat'

export const MOBILE_CHAT_TIMELINE_FILTERS = [
  'all',
  'messages',
  'work',
  'reports',
  'cursor',
  'system',
] as const

export type MobileChatTimelineFilterId = (typeof MOBILE_CHAT_TIMELINE_FILTERS)[number]

export const MOBILE_CHAT_TIMELINE_EVENT_KINDS = [
  'task_created',
  'task_started',
  'runtime_started',
  'runtime_completed',
  'runtime_failed',
  'report_ready',
  'cursor_handoff_created',
  'cursor_handoff_sent',
  'cursor_result_received',
  'owner_approval',
  'delegation_proposed',
  'delegation_approved',
  'delegation_rejected',
  'delegation_executed',
  'tool_requested',
  'tool_approved',
  'tool_rejected',
  'tool_queued',
  'tool_started',
  'tool_result_received',
  'tool_accepted',
  'tool_rework_requested',
  'builder_review_started',
  'builder_accepted_tool_result',
  'builder_requested_tool_rework',
  'result_sent_to_max',
  'task_assigned',
] as const

export type MobileChatTimelineEventKind = (typeof MOBILE_CHAT_TIMELINE_EVENT_KINDS)[number]

export type MobileChatTimelineTone = 'default' | 'success' | 'warning' | 'error' | 'info'

export type MobileChatTimelineEntry = {
  id: string
  role: MobileEmployeeChatRole
  createdAt: string
  source: 'chat' | 'event'
  filters: MobileChatTimelineFilterId[]
  eventKind: MobileChatTimelineEventKind | null
  content: string
  eventTitle: string | null
  tone: MobileChatTimelineTone
  message: MobileEmployeeChatMessage | null
  workItemId: string | null
  reportId: string | null
  runtimeRunId: string | null
  workerLoopId: string | null
  cursorHandoffId: string | null
  approvalId: string | null
  delegationPlanId: string | null
}

export type MobileChatTimelineEventCopy = Record<MobileChatTimelineEventKind, string>

export type MobileChatTimelineLabels = {
  events: MobileChatTimelineEventCopy
  taskCreatedBody: string
  taskStartedBody: string
  runtimeStartedBody: string
  runtimeCompletedBody: string
  runtimeFailedBody: string
  reportReadyBody: string
  cursorHandoffCreatedBody: string
  cursorHandoffSentBody: string
  cursorResultReceivedBody: string
  ownerApprovalApprovedBody: string
  ownerApprovalRejectedBody: string
  ownerApprovalPendingBody: string
  delegationProposedBody: string
  delegationApprovedBody: string
  delegationRejectedBody: string
  delegationExecutedBody: string
  toolRequestedBody: string
  toolApprovedBody: string
  toolRejectedBody: string
  toolQueuedBody: string
  toolStartedBody: string
  toolResultReceivedBody: string
  toolAcceptedBody: string
  toolReworkRequestedBody: string
  builderReviewStartedBody: string
  builderAcceptedToolResultBody: string
  builderRequestedToolReworkBody: string
  resultSentToMaxBody: string
  taskAssignedBody: string
}

export function matchesMobileChatTimelineFilter(
  entry: MobileChatTimelineEntry,
  filter: MobileChatTimelineFilterId,
): boolean {
  if (filter === 'all') return true
  return entry.filters.includes(filter)
}

export function filterMobileChatTimelineEntries(
  entries: MobileChatTimelineEntry[],
  filter: MobileChatTimelineFilterId,
): MobileChatTimelineEntry[] {
  if (filter === 'all') return entries
  return entries.filter((entry) => matchesMobileChatTimelineFilter(entry, filter))
}
