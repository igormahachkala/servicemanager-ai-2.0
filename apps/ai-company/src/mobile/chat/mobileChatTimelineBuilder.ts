/**
 * Builds mobile MAX chat timeline from chat messages + real localStorage events (111C).
 */

import { loadApprovalStore, getActionsForApproval } from '../../domain/approval/approvalStorage'
import { loadCursorHandoffFromChatProposals } from '../../domain/cursorHandoffFromChat/cursorHandoffFromChatStorage'
import { mobileMaxChatId } from '../../domain/cursorHandoffFromChat/cursorHandoffFromChatFlow'
import { loadEmployeeDailyJournalEntries } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import { loadEmployeeWorkItems } from '../../domain/employeeWorkQueue/employeeWorkQueueStorage'
import { listDelegationPlans } from '../../domain/delegationPlan'
import { getEmployeeWorkItemById } from '../../domain/employeeWorkQueue/employeeWorkQueueStorage'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { loadMaxWorkerLoopRecords } from '../../domain/maxWorkerLoop/maxWorkerLoopStorage'
import { loadRuntimeRuns } from '../../domain/runtime/runtimeOrchestrator'
import type { MobileEmployeeChatMessage } from './mobileEmployeeChat'
import type {
  MobileChatTimelineEntry,
  MobileChatTimelineEventKind,
  MobileChatTimelineFilterId,
  MobileChatTimelineLabels,
  MobileChatTimelineTone,
} from './mobileChatTimelineTypes'

function pushEntry(
  bucket: MobileChatTimelineEntry[],
  seen: Set<string>,
  entry: MobileChatTimelineEntry,
): void {
  if (seen.has(entry.id)) return
  seen.add(entry.id)
  bucket.push(entry)
}

function messageFilters(message: MobileEmployeeChatMessage): MobileChatTimelineFilterId[] {
  const filters: MobileChatTimelineFilterId[] = ['all']

  if (message.role === 'owner') {
    filters.push('messages')
    return filters
  }

  if (message.role === 'system') {
    filters.push('system')
    if (message.workItemId) filters.push('work')
    return filters
  }

  switch (message.kind) {
    case 'cursor_handoff':
      filters.push('messages', 'cursor')
      break
    case 'report_link':
      filters.push('messages', 'reports')
      break
    case 'system_status':
      filters.push('system')
      break
    case 'delegation_proposal':
    case 'delegation_event':
      filters.push('messages', 'work')
      break
    default:
      filters.push('messages')
      break
  }

  return filters
}

function chatEntry(message: MobileEmployeeChatMessage): MobileChatTimelineEntry {
  return {
    id: `chat:${message.id}`,
    role: message.role,
    createdAt: message.createdAt,
    source: 'chat',
    filters: messageFilters(message),
    eventKind: null,
    content: message.content,
    eventTitle: null,
    tone: message.error ? 'error' : 'default',
    message,
    workItemId: message.workItemId ?? null,
    reportId: message.reportId ?? null,
    runtimeRunId: message.runtimeRunId ?? null,
    workerLoopId: message.workerLoopId ?? null,
    cursorHandoffId: message.cursorHandoffId ?? null,
    approvalId: null,
    delegationPlanId: null,
  }
}

function eventFilters(kind: MobileChatTimelineEventKind): MobileChatTimelineFilterId[] {
  const filters: MobileChatTimelineFilterId[] = ['all', 'system']
  if (
    kind === 'task_created' ||
    kind === 'task_started' ||
    kind === 'runtime_started' ||
    kind === 'runtime_completed' ||
    kind === 'runtime_failed' ||
    kind === 'delegation_executed' ||
    kind === 'task_assigned'
  ) {
    filters.push('work')
  }
  if (kind === 'report_ready') filters.push('reports')
  if (
    kind === 'cursor_handoff_created' ||
    kind === 'cursor_handoff_sent' ||
    kind === 'cursor_result_received'
  ) {
    filters.push('cursor')
  }
  return filters
}

function eventTone(kind: MobileChatTimelineEventKind): MobileChatTimelineTone {
  switch (kind) {
    case 'runtime_completed':
    case 'report_ready':
      return 'success'
    case 'runtime_failed':
      return 'error'
    case 'owner_approval':
      return 'warning'
    case 'delegation_proposed':
      return 'info'
    case 'delegation_approved':
      return 'success'
    case 'delegation_executed':
    case 'task_assigned':
      return 'success'
    case 'delegation_rejected':
      return 'error'
    case 'runtime_started':
    case 'task_started':
      return 'info'
    default:
      return 'default'
  }
}

function derivedEvent(input: {
  id: string
  kind: MobileChatTimelineEventKind
  createdAt: string
  content: string
  labels: MobileChatTimelineLabels
  workItemId?: string | null
  reportId?: string | null
  runtimeRunId?: string | null
  workerLoopId?: string | null
  cursorHandoffId?: string | null
  approvalId?: string | null
  delegationPlanId?: string | null
  tone?: MobileChatTimelineTone
}): MobileChatTimelineEntry {
  return {
    id: input.id,
    role: 'system',
    createdAt: input.createdAt,
    source: 'event',
    filters: eventFilters(input.kind),
    eventKind: input.kind,
    content: input.content,
    eventTitle: input.labels.events[input.kind],
    tone: input.tone ?? eventTone(input.kind),
    message: null,
    workItemId: input.workItemId ?? null,
    reportId: input.reportId ?? null,
    runtimeRunId: input.runtimeRunId ?? null,
    workerLoopId: input.workerLoopId ?? null,
    cursorHandoffId: input.cursorHandoffId ?? null,
    approvalId: input.approvalId ?? null,
    delegationPlanId: input.delegationPlanId ?? null,
  }
}

function collectWorkEvents(
  employeeId: string,
  labels: MobileChatTimelineLabels,
  skipTaskCreatedIds: Set<string>,
  bucket: MobileChatTimelineEntry[],
  seen: Set<string>,
): void {
  for (const item of loadEmployeeWorkItems().filter((row) => row.employeeId === employeeId)) {
    if (item.source === 'delegation' && item.delegationPlanId) {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:task_assigned:${item.id}`,
          kind: 'task_assigned',
          createdAt: item.createdAt,
          content: labels.taskAssignedBody
            .replace('{title}', item.title)
            .replace('{id}', item.id)
            .replace('{employee}', employeeId),
          labels,
          workItemId: item.id,
          delegationPlanId: item.delegationPlanId,
          tone: 'success',
        }),
      )
    } else if (!skipTaskCreatedIds.has(item.id)) {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:task_created:${item.id}`,
          kind: 'task_created',
          createdAt: item.createdAt,
          content: labels.taskCreatedBody
            .replace('{title}', item.title)
            .replace('{id}', item.id),
          labels,
          workItemId: item.id,
        }),
      )
    }

    if (item.startedAt) {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:task_started:${item.id}`,
          kind: 'task_started',
          createdAt: item.startedAt,
          content: labels.taskStartedBody
            .replace('{title}', item.title)
            .replace('{id}', item.id),
          labels,
          workItemId: item.id,
          workerLoopId: item.workerLoopId,
        }),
      )
    }
  }
}

function collectWorkerLoopEvents(
  labels: MobileChatTimelineLabels,
  bucket: MobileChatTimelineEntry[],
  seen: Set<string>,
  runtimeRunIdsFromLoops: Set<string>,
): void {
  for (const loop of loadMaxWorkerLoopRecords()) {
    const title = loop.input.title ?? loop.input.taskText.slice(0, 80)

    if (loop.status !== 'draft' && loop.status !== 'cancelled') {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:runtime_started:loop:${loop.id}`,
          kind: 'runtime_started',
          createdAt: loop.createdAt,
          content: labels.runtimeStartedBody.replace('{title}', title).replace('{id}', loop.id),
          labels,
          workerLoopId: loop.id,
          runtimeRunId: loop.runtimeRunId,
        }),
      )
    }

    if (loop.runtimeRunId) {
      runtimeRunIdsFromLoops.add(loop.runtimeRunId)
    }

    if (loop.status === 'waiting_approval') {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:owner_approval:loop:${loop.id}`,
          kind: 'owner_approval',
          createdAt: loop.updatedAt,
          content: labels.ownerApprovalPendingBody.replace('{title}', title),
          labels,
          workerLoopId: loop.id,
        }),
      )
    }

    if (loop.status === 'completed' && loop.finishedAt) {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:runtime_completed:loop:${loop.id}`,
          kind: 'runtime_completed',
          createdAt: loop.finishedAt,
          content: labels.runtimeCompletedBody.replace('{title}', title).replace('{id}', loop.id),
          labels,
          workerLoopId: loop.id,
          runtimeRunId: loop.runtimeRunId,
          reportId: loop.reportId,
        }),
      )
    }

    if (loop.status === 'failed' && loop.finishedAt) {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:runtime_failed:loop:${loop.id}`,
          kind: 'runtime_failed',
          createdAt: loop.finishedAt,
          content: labels.runtimeFailedBody
            .replace('{title}', title)
            .replace('{id}', loop.id)
            .replace('{error}', loop.errorMessage ?? '—'),
          labels,
          workerLoopId: loop.id,
          runtimeRunId: loop.runtimeRunId,
          tone: 'error',
        }),
      )
    }
  }
}

function collectRuntimeRunEvents(
  employeeId: string,
  labels: MobileChatTimelineLabels,
  bucket: MobileChatTimelineEntry[],
  seen: Set<string>,
  runtimeRunIdsFromLoops: Set<string>,
): void {
  for (const run of loadRuntimeRuns().filter((row) => row.employeeId === employeeId)) {
    if (runtimeRunIdsFromLoops.has(run.id)) continue

    pushEntry(
      bucket,
      seen,
      derivedEvent({
        id: `evt:runtime_started:run:${run.id}`,
        kind: 'runtime_started',
        createdAt: run.startedAt,
        content: labels.runtimeStartedBody.replace('{title}', run.id).replace('{id}', run.id),
        labels,
        runtimeRunId: run.id,
        reportId: run.reportId,
      }),
    )

    if (run.status === 'completed' && run.finishedAt) {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:runtime_completed:run:${run.id}`,
          kind: 'runtime_completed',
          createdAt: run.finishedAt,
          content: labels.runtimeCompletedBody.replace('{title}', run.id).replace('{id}', run.id),
          labels,
          runtimeRunId: run.id,
          reportId: run.reportId,
        }),
      )
    }

    if (run.status === 'failed' && run.finishedAt) {
      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:runtime_failed:run:${run.id}`,
          kind: 'runtime_failed',
          createdAt: run.finishedAt,
          content: labels.runtimeFailedBody
            .replace('{title}', run.id)
            .replace('{id}', run.id)
            .replace('{error}', run.failureDiagnostics?.errorMessage ?? run.result?.warnings?.[0]?.message ?? '—'),
          labels,
          runtimeRunId: run.id,
          tone: 'error',
        }),
      )
    }
  }
}

function collectReportEvents(
  employeeId: string,
  labels: MobileChatTimelineLabels,
  bucket: MobileChatTimelineEntry[],
  seen: Set<string>,
): void {
  for (const entry of loadEmployeeDailyJournalEntries().filter((row) => row.employeeId === employeeId)) {
    const reportLink = entry.reportLinks[0]
    const reportId = reportLink?.reportId ?? null
    const title = reportLink?.title ?? entry.taskTitle ?? entry.taskText.slice(0, 80)

    pushEntry(
      bucket,
      seen,
      derivedEvent({
        id: `evt:report_ready:journal:${entry.id}`,
        kind: 'report_ready',
        createdAt: entry.finishedAt,
        content: labels.reportReadyBody.replace('{title}', title),
        labels,
        reportId,
        runtimeRunId: entry.runtimeRunId,
        workerLoopId: entry.maxWorkerLoopId,
      }),
    )
  }
}

function collectCursorHandoffEvents(
  employeeId: string,
  labels: MobileChatTimelineLabels,
  skipHandoffIds: Set<string>,
  bucket: MobileChatTimelineEntry[],
  seen: Set<string>,
): void {
  const chatId = mobileMaxChatId(employeeId)

  for (const handoff of loadCursorHandoffFromChatProposals().filter(
    (row) => row.employeeId === employeeId && row.chatId === chatId,
  )) {
    for (const history of handoff.history) {
      if (history.kind === 'created' && !skipHandoffIds.has(handoff.id)) {
        pushEntry(
          bucket,
          seen,
          derivedEvent({
            id: `evt:cursor_created:${handoff.id}`,
            kind: 'cursor_handoff_created',
            createdAt: history.at,
            content: labels.cursorHandoffCreatedBody.replace('{title}', handoff.title),
            labels,
            cursorHandoffId: handoff.id,
          }),
        )
      }

      if (history.kind === 'marked_sent') {
        pushEntry(
          bucket,
          seen,
          derivedEvent({
            id: `evt:cursor_sent:${handoff.id}:${history.id}`,
            kind: 'cursor_handoff_sent',
            createdAt: history.at,
            content: labels.cursorHandoffSentBody.replace('{title}', handoff.title),
            labels,
            cursorHandoffId: handoff.id,
          }),
        )
      }

      if (history.kind === 'result_pending') {
        pushEntry(
          bucket,
          seen,
          derivedEvent({
            id: `evt:cursor_result:${handoff.id}:${history.id}`,
            kind: 'cursor_result_received',
            createdAt: history.at,
            content: labels.cursorResultReceivedBody.replace('{title}', handoff.title),
            labels,
            cursorHandoffId: handoff.id,
          }),
        )
      }
    }
  }
}

function collectDelegationPlanEvents(
  employeeId: string,
  labels: MobileChatTimelineLabels,
  bucket: MobileChatTimelineEntry[],
  seen: Set<string>,
): void {
  for (const plan of listDelegationPlans()) {
    if (plan.originEmployeeId !== employeeId) continue
    for (const entry of plan.history) {
      if (entry.kind === 'proposed' || entry.kind === 'awaiting_owner') {
        pushEntry(
          bucket,
          seen,
          derivedEvent({
            id: `evt:delegation_proposed:${plan.id}:${entry.id}`,
            kind: 'delegation_proposed',
            createdAt: entry.at,
            content: labels.delegationProposedBody
              .replace('{title}', plan.taskTitle)
              .replace('{employee}', plan.recommendedEmployeeCodename),
            labels,
            delegationPlanId: plan.id,
          }),
        )
        break
      }
    }

    for (const entry of plan.history) {
      if (entry.kind === 'approved') {
        pushEntry(
          bucket,
          seen,
          derivedEvent({
            id: `evt:delegation_approved:${plan.id}:${entry.id}`,
            kind: 'delegation_approved',
            createdAt: entry.at,
            content: labels.delegationApprovedBody
              .replace('{title}', plan.taskTitle)
              .replace('{employee}', plan.recommendedEmployeeCodename),
            labels,
            delegationPlanId: plan.id,
            tone: 'success',
          }),
        )
      }

      if (entry.kind === 'rejected') {
        pushEntry(
          bucket,
          seen,
          derivedEvent({
            id: `evt:delegation_rejected:${plan.id}:${entry.id}`,
            kind: 'delegation_rejected',
            createdAt: entry.at,
            content: labels.delegationRejectedBody
              .replace('{title}', plan.taskTitle)
              .replace('{employee}', plan.recommendedEmployeeCodename),
            labels,
            delegationPlanId: plan.id,
            tone: 'error',
          }),
        )
      }

      if (entry.kind === 'delegated') {
        pushEntry(
          bucket,
          seen,
          derivedEvent({
            id: `evt:delegation_executed:${plan.id}:${entry.id}`,
            kind: 'delegation_executed',
            createdAt: entry.at,
            content: labels.delegationExecutedBody
              .replace('{title}', plan.taskTitle)
              .replace('{employee}', plan.recommendedEmployeeCodename),
            labels,
            delegationPlanId: plan.id,
            workItemId: plan.targetWorkItemId,
            tone: 'success',
          }),
        )
      }
    }

    if (plan.targetWorkItemId) {
      const workItem = getEmployeeWorkItemById(plan.targetWorkItemId)
      if (workItem) {
        pushEntry(
          bucket,
          seen,
          derivedEvent({
            id: `evt:task_assigned:${plan.id}:${workItem.id}`,
            kind: 'task_assigned',
            createdAt: workItem.createdAt,
            content: labels.taskAssignedBody
              .replace('{title}', workItem.title)
              .replace('{id}', workItem.id)
              .replace('{employee}', plan.recommendedEmployeeCodename),
            labels,
            workItemId: workItem.id,
            delegationPlanId: plan.id,
            tone: 'success',
          }),
        )
      }
    }
  }
}

function collectApprovalEvents(
  employeeId: string,
  labels: MobileChatTimelineLabels,
  bucket: MobileChatTimelineEntry[],
  seen: Set<string>,
): void {
  const store = loadApprovalStore()

  for (const approval of store.approvals.filter((row) => row.employeeId === employeeId)) {
    const actions = getActionsForApproval(approval.id, store).filter(
      (action) => action.kind === 'approve' || action.kind === 'reject',
    )

    for (const action of actions) {
      const body =
        action.kind === 'approve'
          ? labels.ownerApprovalApprovedBody
          : labels.ownerApprovalRejectedBody

      pushEntry(
        bucket,
        seen,
        derivedEvent({
          id: `evt:owner_approval:${approval.id}:${action.id}`,
          kind: 'owner_approval',
          createdAt: action.createdAt,
          content: body.replace('{title}', approval.title),
          labels,
          approvalId: approval.id,
          tone: action.kind === 'approve' ? 'success' : 'error',
        }),
      )
    }
  }
}

export function buildMobileChatTimeline(input: {
  employeeId: string
  messages: MobileEmployeeChatMessage[]
  labels: MobileChatTimelineLabels
}): MobileChatTimelineEntry[] {
  const bucket: MobileChatTimelineEntry[] = []
  const seen = new Set<string>()

  const skipTaskCreatedIds = new Set(
    input.messages.flatMap((message) => (message.workItemId ? [message.workItemId] : [])),
  )
  const skipHandoffIds = new Set(
    input.messages.flatMap((message) => (message.cursorHandoffId ? [message.cursorHandoffId] : [])),
  )

  for (const message of input.messages) {
    pushEntry(bucket, seen, chatEntry(message))
  }

  if (input.employeeId === MAX_WORKER_EMPLOYEE_ID) {
    const runtimeRunIdsFromLoops = new Set<string>()

    collectWorkEvents(input.employeeId, input.labels, skipTaskCreatedIds, bucket, seen)
    collectWorkerLoopEvents(input.labels, bucket, seen, runtimeRunIdsFromLoops)
    collectRuntimeRunEvents(input.employeeId, input.labels, bucket, seen, runtimeRunIdsFromLoops)
    collectReportEvents(input.employeeId, input.labels, bucket, seen)
    collectCursorHandoffEvents(input.employeeId, input.labels, skipHandoffIds, bucket, seen)
    collectApprovalEvents(input.employeeId, input.labels, bucket, seen)
    collectDelegationPlanEvents(input.employeeId, input.labels, bucket, seen)
  }

  return bucket.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}
