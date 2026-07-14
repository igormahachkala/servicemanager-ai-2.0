/**
 * Cursor Automation — result marker validation (AI-COMPANY-113).
 */

import type { CursorAutomationResultMarker } from './cursorAutomationRunnerTypes'

const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

export type ResultMarkerEvidence = {
  branchExists: boolean
  commitExists: boolean
  pullRequestValid: boolean
}

export type ResultMarkerValidationIssue = {
  code: string
  message: string
}

export function parseResultMarker(raw: unknown): CursorAutomationResultMarker | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  if (typeof record.toolExecutionRunId !== 'string') return null
  if (record.status !== 'SUCCEEDED' && record.status !== 'FAILED') return null
  if (typeof record.summary !== 'string') return null
  if (typeof record.branch !== 'string') return null
  if (typeof record.commitSha !== 'string') return null
  if (typeof record.finishedAt !== 'string') return null

  return {
    toolExecutionRunId: record.toolExecutionRunId,
    status: record.status,
    summary: record.summary,
    branch: record.branch,
    commitSha: record.commitSha,
    pullRequestUrl:
      typeof record.pullRequestUrl === 'string' ? record.pullRequestUrl : null,
    changedFiles: Array.isArray(record.changedFiles)
      ? record.changedFiles.filter((item): item is string => typeof item === 'string')
      : [],
    checks: Array.isArray(record.checks)
      ? record.checks
          .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((item) => ({
            name: typeof item.name === 'string' ? item.name : 'check',
            status: typeof item.status === 'string' ? item.status : 'unknown',
            outputSummary:
              typeof item.outputSummary === 'string' ? item.outputSummary : null,
          }))
      : [],
    errors: Array.isArray(record.errors)
      ? record.errors
          .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((item) => ({
            code: typeof item.code === 'string' ? item.code : 'ERROR',
            message: typeof item.message === 'string' ? item.message : 'Unknown error',
          }))
      : [],
    finishedAt: record.finishedAt,
  }
}

export function validateResultMarker(input: {
  marker: CursorAutomationResultMarker
  expectedRunId: string
  evidence: ResultMarkerEvidence
}): { ok: true } | { ok: false; issues: ResultMarkerValidationIssue[] } {
  const issues: ResultMarkerValidationIssue[] = []
  const { marker, expectedRunId, evidence } = input

  if (marker.toolExecutionRunId !== expectedRunId) {
    issues.push({
      code: 'RUN_ID_MISMATCH',
      message: `Marker run id ${marker.toolExecutionRunId} does not match ${expectedRunId}.`,
    })
  }

  if (!ISO_TIMESTAMP_PATTERN.test(marker.finishedAt)) {
    issues.push({
      code: 'INVALID_FINISHED_AT',
      message: 'finishedAt must be a valid ISO timestamp.',
    })
  }

  if (!marker.branch.trim()) {
    issues.push({ code: 'MISSING_BRANCH', message: 'branch is required.' })
  } else if (!evidence.branchExists) {
    issues.push({
      code: 'BRANCH_NOT_FOUND',
      message: `Branch ${marker.branch} was not found in repository evidence.`,
    })
  }

  if (!COMMIT_SHA_PATTERN.test(marker.commitSha)) {
    issues.push({
      code: 'INVALID_COMMIT_SHA',
      message: 'commitSha must be 7–40 hexadecimal characters.',
    })
  } else if (!evidence.commitExists) {
    issues.push({
      code: 'COMMIT_NOT_FOUND',
      message: `Commit ${marker.commitSha} was not found in repository evidence.`,
    })
  }

  if (marker.pullRequestUrl && !evidence.pullRequestValid) {
    issues.push({
      code: 'INVALID_PULL_REQUEST',
      message: 'pullRequestUrl does not match repository evidence.',
    })
  }

  if (marker.status === 'SUCCEEDED') {
    if (!evidence.commitExists) {
      issues.push({
        code: 'SUCCEEDED_WITHOUT_COMMIT',
        message: 'SUCCEEDED status requires commit evidence.',
      })
    }
    if (!marker.summary.trim()) {
      issues.push({
        code: 'SUCCEEDED_WITHOUT_SUMMARY',
        message: 'SUCCEEDED status requires summary.',
      })
    }
  }

  if (marker.status === 'FAILED' && marker.errors.length === 0 && !marker.summary.trim()) {
    issues.push({
      code: 'FAILED_WITHOUT_REASON',
      message: 'FAILED status requires summary or errors.',
    })
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

export function markerStatusMatchesEvidence(
  marker: CursorAutomationResultMarker,
  evidence: ResultMarkerEvidence,
): boolean {
  if (marker.status === 'SUCCEEDED') {
    return evidence.commitExists && evidence.branchExists
  }
  return true
}
