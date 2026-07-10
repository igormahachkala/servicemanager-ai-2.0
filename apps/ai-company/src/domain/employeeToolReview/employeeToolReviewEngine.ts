/**
 * Employee Tool Review — engine (AI-COMPANY-113F).
 * Builder reviews Cursor result → Accept / Rework → MAX DelegationReview handoff.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import { DELEGATION_DECIDER_EMPLOYEE_ID } from '../delegationEngine'
import { prepareCursorLocalTask } from '../cursorLocalAdapter/cursorLocalAdapterPrepare'
import { getEmployeeWorkItemById } from '../employeeWorkQueue/employeeWorkQueueStorage'
import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry'
import { loadReports, saveReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  appendMobileEmployeeChatMessage,
  getMobileEmployeeChatSession,
  updateMobileEmployeeChatMessage,
} from '../../mobile/chat/mobileEmployeeChatStorage'
import type { MobileEmployeeChatCursorToolReviewSnapshot } from '../../mobile/chat/mobileEmployeeChat'
import { recordConversationExchange } from '../conversationMemory'
import { createDelegationReview } from '../delegationReview/delegationReviewStorage'
import { postMaxReviewCardFromToolReview } from '../delegationReview/delegationReviewEngine'
import {
  acceptToolExecutionResult,
  getToolExecutionRun,
  requestToolExecutionRework,
} from '../toolExecution/toolExecutionRunStorage'
import type { EmployeeToolReview } from './employeeToolReviewTypes'
import {
  getEmployeeToolReview,
  listEmployeeToolReviews,
  markEmployeeToolReviewAccepted,
  markEmployeeToolReviewSentToMax,
  rejectEmployeeToolReview,
  requestEmployeeToolReviewRework,
} from './employeeToolReviewStorage'

export type EmployeeToolReviewFailure = {
  ok: false
  code:
    | 'review_not_found'
    | 'review_not_actionable'
    | 'run_not_found'
    | 'delegation_missing'
    | 'accept_failed'
    | 'rework_failed'
    | 'handoff_failed'
  message: string
}

export type EmployeeToolReviewSuccess<T> = {
  ok: true
  review: EmployeeToolReview
  data: T
}

export type EmployeeToolReviewResult<T> = EmployeeToolReviewSuccess<T> | EmployeeToolReviewFailure

function fail<T>(
  code: EmployeeToolReviewFailure['code'],
  message: string,
): EmployeeToolReviewResult<T> {
  return { ok: false, code, message }
}

function success<T>(review: EmployeeToolReview, data: T): EmployeeToolReviewResult<T> {
  return { ok: true, review, data }
}

function syncBuilderChatMemory(): void {
  const builderId = resolveCanonicalEmployeeId(BUILDER_EMPLOYEE_ID)
  const session = getMobileEmployeeChatSession(builderId)
  recordConversationExchange({ employeeId: builderId, messages: session.messages })
}

export function buildCursorToolReviewSnapshot(
  review: EmployeeToolReview,
  taskTitle: string,
): MobileEmployeeChatCursorToolReviewSnapshot {
  const status =
    review.status === 'sent_to_max'
      ? 'sent_to_max'
      : review.status === 'accepted'
        ? 'accepted'
        : review.status === 'rework_requested'
          ? 'rework_requested'
          : review.status === 'rejected'
            ? 'rejected'
            : 'awaiting_employee_review'

  return {
    reviewId: review.id,
    status,
    toolExecutionRunId: review.toolExecutionRunId,
    workItemId: review.workItemId,
    taskTitle,
    summary: review.envelope.summary,
    changedFiles: review.envelope.changedFiles,
    checks: review.evaluation.checkAssessments,
    commitSha: review.envelope.commit?.sha ?? null,
    commitMessage: review.envelope.commit?.message ?? null,
    commitBranch: review.envelope.commit?.branch ?? null,
    pullRequestUrl: review.envelope.pullRequest?.url ?? null,
    warnings: review.envelope.warnings,
    errors: review.envelope.errors,
    unfinishedItems: review.envelope.unfinishedItems,
    assumptions: review.envelope.assumptions,
    evaluationNotes: review.evaluation.notes,
    reworkReason: review.reworkReason,
    delegationReviewId: review.delegationReviewId,
    reportId: review.reportId,
  }
}

function createCursorCompletionReport(review: EmployeeToolReview, taskTitle: string): Report {
  const now = new Date().toISOString()
  const envelope = review.envelope
  const summary = envelope.summary

  const report: Report = {
    id: `rpt-cursor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    companyId: review.companyId,
    title: `Cursor: ${taskTitle}`,
    type: 'task',
    employeeId: review.employeeId,
    workspaceId: null,
    summary,
    findings: [
      `Changed files: ${envelope.changedFiles.length > 0 ? envelope.changedFiles.join(', ') : 'none listed'}`,
      ...envelope.checks.map(
        (check) => `Check ${check.name}: ${check.status} — ${check.outputSummary}`,
      ),
    ],
    risks: envelope.warnings,
    recommendations:
      envelope.unfinishedItems.length > 0
        ? ['Review unfinished items before Owner closure.', ...envelope.unfinishedItems]
        : ['MAX should review Cursor output before Owner closure.'],
    evidence: [
      {
        id: `ev-terun-${review.toolExecutionRunId}`,
        label: 'Tool Execution Run',
        kind: 'artifact',
        value: review.toolExecutionRunId,
      },
      {
        id: `ev-etrev-${review.id}`,
        label: 'Employee Tool Review',
        kind: 'artifact',
        value: review.id,
      },
    ],
    status: 'published',
    createdAt: now,
    updatedAt: now,
    runtimeBody: {
      briefSummary: summary,
      checked: envelope.checks.map((item) => item.name),
      found: [summary, ...envelope.changedFiles],
      risks: envelope.warnings.map((message) => ({ severity: 'medium' as const, message })),
      recommendations: envelope.unfinishedItems,
      nextStep: 'Await MAX review — Accept or Rework.',
      ownerDecisionRequired: null,
      formattedMarkdown: [
        `# Cursor completion report`,
        '',
        `**Task:** ${taskTitle}`,
        '',
        summary,
        '',
        envelope.errors.length > 0 ? `**Errors:** ${envelope.errors.join('; ')}` : '',
        envelope.warnings.length > 0 ? `**Warnings:** ${envelope.warnings.join('; ')}` : '',
        '',
        `_Submitted at ${now}_`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  }

  saveReports([report, ...loadReports()])
  return report
}

export function postBuilderCursorToolReviewCard(review: EmployeeToolReview): void {
  const builderId = resolveCanonicalEmployeeId(BUILDER_EMPLOYEE_ID)
  const run = getToolExecutionRun(review.toolExecutionRunId)
  const taskTitle = run?.title ?? 'Cursor task'

  appendMobileEmployeeChatMessage(builderId, {
    role: 'system',
    kind: 'cursor_tool_review',
    content: 'CURSOR_TOOL_REVIEW_CARD',
    workItemId: review.workItemId,
    toolExecutionRunId: review.toolExecutionRunId,
    cursorToolReview: buildCursorToolReviewSnapshot(review, taskTitle),
  })
  syncBuilderChatMemory()
}

function updateBuilderReviewChatCard(review: EmployeeToolReview, taskTitle: string): void {
  const builderId = resolveCanonicalEmployeeId(BUILDER_EMPLOYEE_ID)
  const session = getMobileEmployeeChatSession(builderId)
  const snapshot = buildCursorToolReviewSnapshot(review, taskTitle)

  for (const message of session.messages) {
    if (
      message.kind === 'cursor_tool_review' &&
      message.cursorToolReview?.reviewId === review.id
    ) {
      updateMobileEmployeeChatMessage(builderId, message.id, {
        cursorToolReview: snapshot,
      })
    }
  }
}

function prepareReworkTaskEnvelope(review: EmployeeToolReview, reason: string): string {
  const run = getToolExecutionRun(review.toolExecutionRunId)
  if (!run) return ''

  const instructions = [
    run.instructions,
    '',
    '## Builder rework notes',
    reason.trim(),
    '',
    '## Previous Cursor result summary',
    review.envelope.summary,
    review.envelope.errors.length > 0
      ? `\nErrors to fix:\n${review.envelope.errors.map((item) => `- ${item}`).join('\n')}`
      : '',
    review.envelope.unfinishedItems.length > 0
      ? `\nUnfinished:\n${review.envelope.unfinishedItems.map((item) => `- ${item}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const envelope = prepareCursorLocalTask({
    title: `${run.title} (rework)`,
    instructions,
    expectedResult: run.expectedResult,
    fileScope: run.fileScope,
    checks: run.checks,
    toolExecutionRunId: run.id,
    workItemId: run.workItemId,
    employeeId: run.employeeId,
    companyId: run.companyId,
  })

  return envelope.envelopeId
}

export function acceptBuilderCursorToolReview(
  reviewId: string,
): EmployeeToolReviewResult<{ report: Report; delegationReviewId: string | null }> {
  const existing = getEmployeeToolReview(reviewId)
  if (!existing) {
    return fail('review_not_found', `Review ${reviewId} was not found.`)
  }
  if (existing.status !== 'awaiting_employee_review') {
    return fail('review_not_actionable', `Review is not awaiting Builder review (${existing.status}).`)
  }

  const run = getToolExecutionRun(existing.toolExecutionRunId)
  if (!run) {
    return fail('run_not_found', 'ToolExecutionRun was not found.')
  }

  const acceptedRun = acceptToolExecutionResult(run.id, 'Builder accepted Cursor result.')
  if (!acceptedRun) {
    return fail('accept_failed', 'Could not accept tool execution result.')
  }

  const workItem = getEmployeeWorkItemById(existing.workItemId)
  const taskTitle = run.title
  const report = createCursorCompletionReport(existing, taskTitle)

  let delegationReviewId: string | null = null
  if (run.delegationPlanId) {
    const delegationReview = createDelegationReview({
      companyId: existing.companyId ?? DEFAULT_COMPANY_ID,
      delegationPlanId: run.delegationPlanId,
      builderEmployeeId: existing.employeeId,
      reviewerEmployeeId: resolveCanonicalEmployeeId(DELEGATION_DECIDER_EMPLOYEE_ID),
      builderWorkItemId: existing.workItemId,
      taskTitle,
      taskText: workItem?.taskText ?? run.instructions,
      reportId: report.id,
      initialStatus: 'awaiting_review',
    })
    delegationReviewId = delegationReview?.id ?? null

    if (delegationReview) {
      postMaxReviewCardFromToolReview(delegationReview)
    }
  } else {
    return fail('delegation_missing', 'ToolExecutionRun has no delegationPlanId — MAX handoff blocked.')
  }

  const acceptedReview =
    markEmployeeToolReviewAccepted(existing.id, {
      reportId: report.id,
      delegationReviewId,
      message: 'Builder accepted Cursor result.',
    }) ?? existing

  const sentReview =
    markEmployeeToolReviewSentToMax(acceptedReview.id, {
      reportId: report.id,
      delegationReviewId: delegationReviewId!,
      message: 'Result sent to MAX for review.',
    }) ?? acceptedReview

  updateBuilderReviewChatCard(sentReview, taskTitle)

  const builderId = resolveCanonicalEmployeeId(BUILDER_EMPLOYEE_ID)
  appendMobileEmployeeChatMessage(builderId, {
    role: 'system',
    kind: 'system_status',
    content: 'BUILDER_CURSOR_ACCEPTED_SENT_TO_MAX',
    workItemId: existing.workItemId,
    toolExecutionRunId: existing.toolExecutionRunId,
    reportId: report.id,
    cursorToolReview: buildCursorToolReviewSnapshot(sentReview, taskTitle),
  })
  syncBuilderChatMemory()

  return success(sentReview, { report, delegationReviewId })
}

export function requestBuilderCursorToolReviewRework(
  reviewId: string,
  reason: string,
): EmployeeToolReviewResult<{ reworkEnvelopeId: string | null }> {
  const existing = getEmployeeToolReview(reviewId)
  if (!existing) {
    return fail('review_not_found', `Review ${reviewId} was not found.`)
  }
  if (existing.status !== 'awaiting_employee_review') {
    return fail('review_not_actionable', `Review is not awaiting Builder review (${existing.status}).`)
  }

  const trimmed = reason.trim()
  if (!trimmed) {
    return fail('rework_failed', 'Rework reason is required.')
  }

  const run = getToolExecutionRun(existing.toolExecutionRunId)
  if (!run) {
    return fail('run_not_found', 'ToolExecutionRun was not found.')
  }

  requestToolExecutionRework(run.id, trimmed)
  const reworkEnvelopeId = prepareReworkTaskEnvelope(existing, trimmed)

  const updated =
    requestEmployeeToolReviewRework(existing.id, trimmed, reworkEnvelopeId) ?? existing

  updateBuilderReviewChatCard(updated, run.title)

  const builderId = resolveCanonicalEmployeeId(BUILDER_EMPLOYEE_ID)
  appendMobileEmployeeChatMessage(builderId, {
    role: 'system',
    kind: 'system_status',
    content: 'BUILDER_CURSOR_REWORK_REQUESTED',
    workItemId: existing.workItemId,
    toolExecutionRunId: existing.toolExecutionRunId,
    cursorToolReview: buildCursorToolReviewSnapshot(updated, run.title),
  })
  syncBuilderChatMemory()

  return success(updated, { reworkEnvelopeId: reworkEnvelopeId || null })
}

export function rejectBuilderCursorToolReview(
  reviewId: string,
  reason?: string | null,
): EmployeeToolReviewResult<{ review: EmployeeToolReview }> {
  const existing = getEmployeeToolReview(reviewId)
  if (!existing) {
    return fail('review_not_found', `Review ${reviewId} was not found.`)
  }
  if (existing.status !== 'awaiting_employee_review') {
    return fail('review_not_actionable', `Review is not awaiting Builder review (${existing.status}).`)
  }

  const run = getToolExecutionRun(existing.toolExecutionRunId)
  const updated = rejectEmployeeToolReview(existing.id, reason) ?? existing
  if (run) {
    updateBuilderReviewChatCard(updated, run.title)
  }
  syncBuilderChatMemory()

  return success(updated, { review: updated })
}

export function listPendingBuilderCursorToolReviews(): EmployeeToolReview[] {
  return listEmployeeToolReviews({
    reviewerEmployeeId: BUILDER_EMPLOYEE_ID,
    status: 'awaiting_employee_review',
  })
}
