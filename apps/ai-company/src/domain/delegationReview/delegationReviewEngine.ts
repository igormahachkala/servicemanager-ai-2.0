/**
 * Delegation Review — engine (AI-COMPANY-112H).
 * Builder completion → Report → MAX review card. No Runtime / Tool Dispatcher.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import { DELEGATION_DECIDER_EMPLOYEE_ID } from '../delegationEngine'
import {
  completeEmployeeWorkItem,
  createEmployeeWorkItem,
  getEmployeeWorkItemById,
  startEmployeeWorkItem,
  type WorkItem,
} from '../employeeWorkQueue'
import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee'
import { loadReports, saveReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  appendMobileEmployeeChatMessage,
  getMobileEmployeeChatSession,
  updateMobileEmployeeChatMessage,
} from '../../mobile/chat/mobileEmployeeChatStorage'
import type { MobileEmployeeChatDelegationReviewSnapshot } from '../../mobile/chat/mobileEmployeeChat'
import { recordConversationExchange } from '../conversationMemory'
import {
  acceptDelegationReviewRecord,
  createDelegationReview,
  getDelegationReviewById,
  listDelegationReviews,
  reopenDelegationReviewForReworkCompletion,
  requestDelegationReviewReworkRecord,
} from './delegationReviewStorage'
import type { DelegationReviewRecord } from './delegationReviewTypes'

export type DelegationReviewFailure = {
  ok: false
  code:
    | 'work_item_not_found'
    | 'not_builder_task'
    | 'not_delegated'
    | 'invalid_status'
    | 'review_not_found'
    | 'review_not_actionable'
    | 'complete_failed'
  message: string
}

export type DelegationReviewSuccess<T> = {
  ok: true
  review: DelegationReviewRecord
  data: T
}

export type DelegationReviewResult<T> = DelegationReviewSuccess<T> | DelegationReviewFailure

function fail<T>(
  code: DelegationReviewFailure['code'],
  message: string,
): DelegationReviewResult<T> {
  return { ok: false, code, message }
}

function success<T>(review: DelegationReviewRecord, data: T): DelegationReviewResult<T> {
  return { ok: true, review, data }
}

function builderDisplayName(employeeId: string): string {
  return resolveEmployee(employeeId)?.codename ?? employeeId
}

function createBuilderCompletionReport(workItem: WorkItem): Report {
  const now = new Date().toISOString()
  const summary =
    workItem.summary?.trim() ||
    `Builder completed delegated task «${workItem.title}». Result ready for MAX review.`

  const report: Report = {
    id: `rpt-builder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    companyId: workItem.companyId,
    title: `Builder: ${workItem.title}`,
    type: 'task',
    employeeId: workItem.employeeId,
    workspaceId: workItem.workspaceId,
    summary,
    findings: [
      workItem.taskText?.trim() || 'Task completed by Builder (manual V1 submission).',
      'Delegated work item marked completed without Runtime or Worker Loop.',
    ],
    risks: [],
    recommendations: ['MAX should review the result and accept or request rework.'],
    evidence: [
      {
        id: `ev-ewq-${workItem.id}`,
        label: 'Work Item',
        kind: 'artifact',
        value: workItem.id,
      },
    ],
    status: 'published',
    createdAt: now,
    updatedAt: now,
    runtimeBody: {
      briefSummary: summary,
      checked: ['Delegation task scope', 'Builder queue item'],
      found: [summary],
      risks: [],
      recommendations: ['MAX review required before Owner closure.'],
      nextStep: 'Await MAX review — Accept or Rework.',
      ownerDecisionRequired: null,
      formattedMarkdown: [
        `# Builder completion report`,
        '',
        `**Task:** ${workItem.title}`,
        '',
        workItem.taskText?.trim() || '_No task text._',
        '',
        `_Submitted at ${now}_`,
      ].join('\n'),
    },
  }

  saveReports([report, ...loadReports()])
  return report
}

function buildReviewSnapshot(review: DelegationReviewRecord): MobileEmployeeChatDelegationReviewSnapshot {
  const status: MobileEmployeeChatDelegationReviewSnapshot['status'] =
    review.status === 'accepted' ||
    review.status === 'rework_requested' ||
    review.status === 'failed'
      ? review.status
      : 'awaiting_review'

  return {
    reviewId: review.id,
    status,
    builderEmployeeId: review.builderEmployeeId,
    builderDisplayName: builderDisplayName(review.builderEmployeeId),
    taskTitle: review.taskTitle,
    reportId: review.reportId ?? '',
    workItemId: review.builderWorkItemId,
    delegationPlanId: review.delegationPlanId,
    reworkNotes: review.reworkNotes,
  }
}

function syncReviewChatMemory(employeeId: string): void {
  const session = getMobileEmployeeChatSession(employeeId)
  recordConversationExchange({ employeeId, messages: session.messages })
}

export function postMaxReviewCardFromToolReview(review: DelegationReviewRecord): void {
  postMaxReviewCard(review)
}

function postMaxReviewCard(review: DelegationReviewRecord): void {
  const maxId = resolveCanonicalEmployeeId(DELEGATION_DECIDER_EMPLOYEE_ID)
  appendMobileEmployeeChatMessage(maxId, {
    role: 'system',
    kind: 'delegation_review',
    content: 'DELEGATION_REVIEW_CARD',
    reportId: review.reportId,
    workItemId: review.builderWorkItemId,
    delegationReview: buildReviewSnapshot(review),
  })
  syncReviewChatMemory(maxId)
}

function postOwnerAcceptedNotice(review: DelegationReviewRecord): void {
  const maxId = resolveCanonicalEmployeeId(DELEGATION_DECIDER_EMPLOYEE_ID)
  appendMobileEmployeeChatMessage(maxId, {
    role: 'system',
    kind: 'system_status',
    content: 'MAX_REVIEW_ACCEPTED_OWNER_NOTICE',
    delegationReview: {
      ...buildReviewSnapshot(review),
      status: 'accepted',
    },
  })
  syncReviewChatMemory(maxId)
}

function assertBuilderDelegatedWorkItem(workItemId: string): DelegationReviewResult<WorkItem> {
  const workItem = getEmployeeWorkItemById(workItemId)
  if (!workItem) {
    return fail('work_item_not_found', `Work item ${workItemId} was not found.`)
  }

  const canonicalBuilder = resolveCanonicalEmployeeId(BUILDER_EMPLOYEE_ID)
  if (workItem.employeeId !== canonicalBuilder) {
    return fail('not_builder_task', 'Only Builder queue items can enter the review pipeline.')
  }

  if (!workItem.delegationPlanId || workItem.source !== 'delegation') {
    return fail('not_delegated', 'Review pipeline requires a delegated Builder task.')
  }

  if (workItem.status === 'completed') {
    return fail('invalid_status', 'Work item is already completed.')
  }

  return { ok: true, review: {} as DelegationReviewRecord, data: workItem }
}

export function completeBuilderDelegatedWorkItem(workItemId: string): DelegationReviewResult<{
  workItem: WorkItem
  report: Report
}> {
  const check = assertBuilderDelegatedWorkItem(workItemId)
  if (!check.ok) return check

  const workItem = check.data
  let active = workItem
  if (active.status !== 'in_progress') {
    const started = startEmployeeWorkItem(workItemId)
    if (!started) {
      return fail('invalid_status', 'Could not start Builder work item before completion.')
    }
    active = started
  }

  const completed = completeEmployeeWorkItem({ workItemId: active.id })
  if (!completed) {
    return fail('complete_failed', 'Could not mark Builder work item as completed.')
  }

  const report = createBuilderCompletionReport(completed)

  const parentReview = listDelegationReviews({
    status: 'rework_requested',
    builderEmployeeId: completed.employeeId,
    delegationPlanId: completed.delegationPlanId ?? undefined,
  }).find((item) => item.reworkWorkItemId === completed.id)

  let review: DelegationReviewRecord | null
  if (parentReview) {
    review = reopenDelegationReviewForReworkCompletion(parentReview.id, completed.id, report.id)
  } else {
    review = createDelegationReview({
      companyId: completed.companyId,
      delegationPlanId: completed.delegationPlanId!,
      builderEmployeeId: completed.employeeId,
      reviewerEmployeeId: resolveCanonicalEmployeeId(DELEGATION_DECIDER_EMPLOYEE_ID),
      builderWorkItemId: completed.id,
      taskTitle: completed.title,
      taskText: completed.taskText ?? '',
      reportId: report.id,
      initialStatus: 'awaiting_review',
    })
  }

  if (!review) {
    return fail('review_not_found', 'Could not create or reopen delegation review.')
  }

  postMaxReviewCard(review)
  syncReviewChatMemory(completed.employeeId)

  return success(review, { workItem: completed, report })
}

export function acceptDelegationReview(reviewId: string): DelegationReviewResult<{ review: DelegationReviewRecord }> {
  const existing = getDelegationReviewById(reviewId)
  if (!existing) {
    return fail('review_not_found', `Review ${reviewId} was not found.`)
  }
  if (existing.status !== 'awaiting_review') {
    return fail('review_not_actionable', `Review is not awaiting review (status: ${existing.status}).`)
  }

  const accepted = acceptDelegationReviewRecord(reviewId)
  if (!accepted) {
    return fail('review_not_actionable', 'Could not accept review.')
  }

  const maxId = resolveCanonicalEmployeeId(DELEGATION_DECIDER_EMPLOYEE_ID)
  const session = getMobileEmployeeChatSession(maxId)
  for (const message of session.messages) {
    if (
      message.kind === 'delegation_review' &&
      message.delegationReview?.reviewId === reviewId &&
      message.delegationReview.status === 'awaiting_review'
    ) {
      updateMobileEmployeeChatMessage(maxId, message.id, {
        delegationReview: {
          ...message.delegationReview,
          status: 'accepted',
        },
      })
    }
  }

  postOwnerAcceptedNotice(accepted)
  syncReviewChatMemory(accepted.builderEmployeeId)

  return success(accepted, { review: accepted })
}

export function requestDelegationReviewRework(
  reviewId: string,
  notes?: string | null,
): DelegationReviewResult<{ reworkWorkItem: WorkItem }> {
  const existing = getDelegationReviewById(reviewId)
  if (!existing) {
    return fail('review_not_found', `Review ${reviewId} was not found.`)
  }
  if (existing.status !== 'awaiting_review') {
    return fail('review_not_actionable', `Review is not awaiting review (status: ${existing.status}).`)
  }

  const original = getEmployeeWorkItemById(existing.builderWorkItemId)
  const reworkTitle = `${existing.taskTitle} (rework)`
  const reworkText = [
    notes?.trim() || 'MAX requested rework.',
    '',
    'Original task:',
    existing.taskText,
  ].join('\n')

  const reworkWorkItem = createEmployeeWorkItem({
    companyId: existing.companyId ?? DEFAULT_COMPANY_ID,
    employeeId: existing.builderEmployeeId,
    title: reworkTitle,
    taskText: reworkText,
    summary: notes?.trim() ?? 'Follow-up after MAX review — rework requested.',
    priority: original?.priority ?? 'medium',
    source: 'delegation',
    delegationPlanId: existing.delegationPlanId,
    structuredPayload: original?.structuredPayload ?? null,
  })

  const updated = requestDelegationReviewReworkRecord(reviewId, reworkWorkItem.id, notes)
  if (!updated) {
    return fail('review_not_actionable', 'Could not request rework.')
  }

  const maxId = resolveCanonicalEmployeeId(DELEGATION_DECIDER_EMPLOYEE_ID)
  const session = getMobileEmployeeChatSession(maxId)
  for (const message of session.messages) {
    if (
      message.kind === 'delegation_review' &&
      message.delegationReview?.reviewId === reviewId &&
      message.delegationReview.status === 'awaiting_review'
    ) {
      updateMobileEmployeeChatMessage(maxId, message.id, {
        delegationReview: {
          ...message.delegationReview,
          status: 'rework_requested',
          reworkNotes: notes?.trim() ?? null,
        },
      })
    }
  }

  appendMobileEmployeeChatMessage(maxId, {
    role: 'system',
    kind: 'system_status',
    content: 'MAX_REVIEW_REWORK_REQUESTED',
    workItemId: reworkWorkItem.id,
    delegationReview: {
      ...buildReviewSnapshot(updated),
      status: 'rework_requested',
    },
  })

  syncReviewChatMemory(maxId)
  syncReviewChatMemory(updated.builderEmployeeId)

  return success(updated, { reworkWorkItem })
}

export function listPendingMaxDelegationReviews(): DelegationReviewRecord[] {
  return listDelegationReviews({
    reviewerEmployeeId: resolveCanonicalEmployeeId(DELEGATION_DECIDER_EMPLOYEE_ID),
    status: 'awaiting_review',
  })
}
