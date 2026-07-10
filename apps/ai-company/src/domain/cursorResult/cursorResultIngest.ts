/**
 * Cursor Result — ingest validated envelope + Builder review bootstrap (AI-COMPANY-113F).
 */

import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry'
import {
  getToolExecutionRun,
  recordToolExecutionResultFromBridge,
} from '../toolExecution/toolExecutionRunStorage'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import {
  validateCursorResultEnvelope,
  type CursorResultValidationIssue,
} from './cursorResultEnvelopeValidation'
import type { CursorResultEnvelope } from './cursorResultEnvelopeTypes'
import { createEmployeeToolReview, getEmployeeToolReviewByRunId } from '../employeeToolReview/employeeToolReviewStorage'
import { evaluateCursorResultForBuilderReview } from '../employeeToolReview/employeeToolReviewEvaluation'
import { postBuilderCursorToolReviewCard } from '../employeeToolReview/employeeToolReviewEngine'
import type { EmployeeToolReview } from '../employeeToolReview/employeeToolReviewTypes'

export type IngestCursorResultOutcome =
  | {
      ok: true
      envelope: CursorResultEnvelope
      run: ToolExecutionRun
      review: EmployeeToolReview
      idempotent: boolean
    }
  | { ok: false; issues: CursorResultValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/** Upgrade legacy bridge result.json (113E) to v1 envelope fields before validation. */
export function normalizeLegacyCursorResultRaw(
  raw: unknown,
  run: ToolExecutionRun,
): Record<string, unknown> | null {
  if (!isRecord(raw)) return null

  if (raw.version === 'v1' && typeof raw.toolExecutionRunId === 'string') {
    return raw
  }

  const runId =
    typeof raw.toolExecutionRunId === 'string'
      ? raw.toolExecutionRunId
      : typeof raw.runId === 'string'
        ? raw.runId
        : run.id

  const checksRaw = raw.checks
  let checks: Array<{ name: string; status: string; outputSummary: string }> = []
  if (Array.isArray(checksRaw)) {
    if (checksRaw.every((item) => typeof item === 'string')) {
      checks = checksRaw.map((item) => ({
        name: item,
        status: 'passed',
        outputSummary: 'Legacy bridge check entry (no structured output).',
      }))
    } else {
      checks = checksRaw
        .map((item) => {
          if (!isRecord(item)) return null
          if (typeof item.name !== 'string' || typeof item.outputSummary !== 'string') return null
          return {
            name: item.name,
            status: typeof item.status === 'string' ? item.status : 'passed',
            outputSummary: item.outputSummary,
          }
        })
        .filter((item): item is { name: string; status: string; outputSummary: string } => item !== null)
    }
  }

  if (checks.length === 0) {
    checks = (run.checks ?? []).map((name) => ({
      name,
      status: 'skipped',
      outputSummary: 'Check not reported in legacy result — verify manually.',
    }))
  }

  const commit =
    typeof raw.commit === 'string'
      ? { sha: null, message: raw.commit, branch: null }
      : raw.commit

  const pullRequest =
    typeof raw.pullRequest === 'string'
      ? { url: raw.pullRequest, title: null, number: null }
      : raw.pullRequest

  return {
    version: 'v1',
    toolExecutionRunId: runId,
    workItemId: typeof raw.workItemId === 'string' ? raw.workItemId : run.workItemId,
    employeeId: typeof raw.employeeId === 'string' ? raw.employeeId : run.employeeId,
    status: raw.status ?? 'partial',
    summary: raw.summary ?? '',
    changedFiles: parseStringArray(raw.changedFiles),
    checks,
    commit: commit ?? null,
    pullRequest: pullRequest ?? null,
    warnings: parseStringArray(raw.warnings),
    errors: parseStringArray(raw.errors),
    assumptions: parseStringArray(raw.assumptions),
    unfinishedItems: parseStringArray(raw.unfinishedItems),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : new Date().toISOString(),
  }
}

export function ingestCursorResultEnvelope(
  raw: unknown,
  options: { expectedRunId?: string } = {},
): IngestCursorResultOutcome {
  let validation = validateCursorResultEnvelope(raw, options)

  if (!validation.ok) {
    const runId =
      isRecord(raw) && typeof raw.runId === 'string'
        ? raw.runId
        : isRecord(raw) && typeof raw.toolExecutionRunId === 'string'
          ? raw.toolExecutionRunId
          : options.expectedRunId

    if (runId) {
      const run = getToolExecutionRun(runId)
      if (run) {
        const normalized = normalizeLegacyCursorResultRaw(raw, run)
        if (normalized) {
          validation = validateCursorResultEnvelope(normalized, options)
        }
      }
    }
  }

  if (!validation.ok) {
    return { ok: false, issues: validation.issues }
  }

  const { envelope, run } = validation

  const existingReview = getEmployeeToolReviewByRunId(run.id)
  if (
    existingReview &&
    (run.status === 'awaiting_employee_review' ||
      run.status === 'accepted' ||
      run.status === 'rework_requested')
  ) {
    return {
      ok: true,
      envelope,
      run,
      review: existingReview,
      idempotent: true,
    }
  }

  const recorded = recordToolExecutionResultFromBridge({
    runId: run.id,
    output: envelope as unknown as Record<string, unknown>,
    deliveryMode: 'cursor_v1',
  })

  if (!recorded) {
    return {
      ok: false,
      issues: [{ code: 'invalid_shape', message: 'Could not record tool execution result.' }],
    }
  }

  let review = getEmployeeToolReviewByRunId(run.id)
  if (!review) {
    const evaluation = evaluateCursorResultForBuilderReview(envelope, run)
    review = createEmployeeToolReview({
      companyId: run.companyId,
      employeeId: run.employeeId,
      reviewerEmployeeId: BUILDER_EMPLOYEE_ID,
      toolExecutionRunId: run.id,
      workItemId: run.workItemId,
      delegationPlanId: run.delegationPlanId,
      envelope,
      evaluation,
    })
    postBuilderCursorToolReviewCard(review)
  }

  return {
    ok: true,
    envelope,
    run: recorded,
    review,
    idempotent: false,
  }
}
