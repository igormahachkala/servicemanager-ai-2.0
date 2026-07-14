/**
 * Cursor Automation Runner — discovered result envelope (AI-COMPANY-113).
 */

import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import { assertValidCursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeValidation'
import type { CursorAutomationResultMarker } from './cursorAutomationRunnerTypes'

function normalizeChecks(
  checks: CursorAutomationResultMarker['checks'],
): CursorResultEnvelope['checks'] {
  return checks.map((check) => ({
    name: check.name,
    status:
      check.status === 'passed' ||
      check.status === 'failed' ||
      check.status === 'skipped' ||
      check.status === 'error' ||
      check.status === 'PASSED' ||
      check.status === 'FAILED'
        ? (check.status.toLowerCase() as 'passed' | 'failed' | 'skipped' | 'error')
        : 'unknown',
    outputSummary: check.outputSummary ?? null,
  }))
}

export function buildDiscoveredAutomationEnvelope(input: {
  marker: CursorAutomationResultMarker
  externalCorrelationId: string | null
  metadata?: Record<string, unknown>
}): CursorResultEnvelope {
  const failed = input.marker.status === 'FAILED'
  const succeeded = input.marker.status === 'SUCCEEDED'

  const envelope: CursorResultEnvelope = {
    toolExecutionRunId: input.marker.toolExecutionRunId,
    route: 'CURSOR_AUTOMATION_WEBHOOK',
    transportStatus: 'DISPATCHED',
    executionStatus: failed ? 'FAILED' : succeeded ? 'SUCCEEDED' : 'RESULT_PENDING',
    reviewStatus: succeeded ? 'PENDING' : 'NOT_REQUIRED',
    summary: input.marker.summary,
    branch: input.marker.branch,
    commitSha: input.marker.commitSha,
    pullRequestUrl: input.marker.pullRequestUrl,
    changedFiles: input.marker.changedFiles,
    checks: normalizeChecks(input.marker.checks),
    artifacts: [
      { kind: 'branch', label: 'branch', value: input.marker.branch, url: null },
      { kind: 'commit', label: 'commit', value: input.marker.commitSha, url: null },
      ...(input.marker.pullRequestUrl
        ? [
            {
              kind: 'pull_request' as const,
              label: 'pull_request',
              value: input.marker.pullRequestUrl,
              url: input.marker.pullRequestUrl,
            },
          ]
        : []),
      ...input.marker.changedFiles.map((file) => ({
        kind: 'file' as const,
        label: 'changed_file',
        value: file,
        url: null,
      })),
    ],
    errors: input.marker.errors.map((error) => ({
      code: error.code,
      message: error.message,
      source: 'execution' as const,
      terminal: failed,
    })),
    externalCorrelationId: input.externalCorrelationId,
    startedAt: null,
    finishedAt: input.marker.finishedAt,
    metadata: {
      transport: 'automation_webhook',
      enqueueOnly: false,
      reconciliation: 'result_marker_v1',
      ...input.metadata,
    },
  }

  if (succeeded || failed) {
    return assertValidCursorResultEnvelope(envelope)
  }
  return envelope
}
