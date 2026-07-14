/**
 * Unified → legacy review envelope adapter (AI-COMPANY-111).
 * Builder Review pipeline uses legacy 113F schema — execution status is not rewritten.
 */

import type { CursorResultEnvelope as LegacyCursorResultEnvelope } from '../cursorResult/cursorResultEnvelopeTypes'
import type { CursorResultEnvelope as UnifiedCursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'

function mapLegacyStatus(
  envelope: UnifiedCursorResultEnvelope,
): LegacyCursorResultEnvelope['status'] {
  if (envelope.executionStatus === 'SUCCEEDED') return 'completed'
  if (envelope.executionStatus === 'FAILED') return 'failed'
  return 'partial'
}

function mapCheckStatus(status: UnifiedCursorResultEnvelope['checks'][number]['status']) {
  if (status === 'passed' || status === 'failed' || status === 'skipped' || status === 'error') {
    return status
  }
  return 'error' as const
}

export function unifiedEnvelopeToLegacyReviewEnvelope(
  envelope: UnifiedCursorResultEnvelope,
  run: ToolExecutionRun,
): LegacyCursorResultEnvelope {
  return {
    version: 'v1',
    toolExecutionRunId: envelope.toolExecutionRunId,
    workItemId: run.workItemId,
    employeeId: run.employeeId,
    status: mapLegacyStatus(envelope),
    summary: envelope.summary ?? '',
    changedFiles: envelope.changedFiles,
    checks: envelope.checks.map((check) => ({
      name: check.name,
      status: mapCheckStatus(check.status),
      outputSummary: check.outputSummary ?? 'No structured output.',
    })),
    commit:
      envelope.commitSha || envelope.branch
        ? {
            sha: envelope.commitSha,
            message: null,
            branch: envelope.branch,
          }
        : null,
    pullRequest: envelope.pullRequestUrl
      ? { url: envelope.pullRequestUrl, title: null, number: null }
      : null,
    warnings: [],
    errors: envelope.errors.map((error) => error.message),
    assumptions: [],
    unfinishedItems:
      envelope.executionStatus === 'CANCELLED' || envelope.executionStatus === 'TIMED_OUT'
        ? [envelope.executionStatus]
        : [],
    completedAt: envelope.finishedAt ?? new Date().toISOString(),
  }
}
