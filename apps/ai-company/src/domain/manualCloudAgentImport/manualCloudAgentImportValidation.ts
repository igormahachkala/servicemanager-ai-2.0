/**
 * Manual Cloud Agent import — input validation (AI-COMPANY-111).
 */

import type {
  ManualCloudAgentImportInput,
  ManualCloudAgentImportReasonCode,
} from './manualCloudAgentImportTypes'

const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i

function isIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function isValidPullRequestUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return /\/pull\/\d+|\/merge_requests\/\d+|\/pulls\/\d+/.test(url.pathname)
  } catch {
    return false
  }
}

function normalizeChangedFiles(files: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const file of files) {
    const trimmed = file.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    normalized.push(trimmed)
  }
  return normalized
}

function hasExecutionEvidence(input: ManualCloudAgentImportInput): boolean {
  return (
    input.summary.trim().length > 0 ||
    input.changedFiles.length > 0 ||
    (input.commitSha?.trim().length ?? 0) > 0 ||
    (input.branch?.trim().length ?? 0) > 0 ||
    (input.pullRequestUrl?.trim().length ?? 0) > 0
  )
}

export type ManualCloudAgentImportValidationResult =
  | { ok: true; input: ManualCloudAgentImportInput }
  | { ok: false; reasonCode: ManualCloudAgentImportReasonCode; message: string }

export function validateManualCloudAgentImportInput(
  raw: ManualCloudAgentImportInput,
): ManualCloudAgentImportValidationResult {
  if (!raw.toolExecutionRunId?.trim()) {
    return {
      ok: false,
      reasonCode: 'TOOL_EXECUTION_RUN_NOT_FOUND',
      message: 'toolExecutionRunId is required.',
    }
  }

  if (!raw.finishedAt?.trim() || !isIsoTimestamp(raw.finishedAt)) {
    return {
      ok: false,
      reasonCode: 'INVALID_STATUS_COMBINATION',
      message: 'finishedAt must be a valid ISO timestamp.',
    }
  }

  if (raw.startedAt && !isIsoTimestamp(raw.startedAt)) {
    return {
      ok: false,
      reasonCode: 'INVALID_STATUS_COMBINATION',
      message: 'startedAt must be a valid ISO timestamp when provided.',
    }
  }

  if (
    raw.startedAt &&
    Date.parse(raw.finishedAt) < Date.parse(raw.startedAt)
  ) {
    return {
      ok: false,
      reasonCode: 'INVALID_STATUS_COMBINATION',
      message: 'finishedAt cannot be before startedAt.',
    }
  }

  if (raw.branch !== null && raw.branch.trim().length === 0) {
    return {
      ok: false,
      reasonCode: 'INVALID_STATUS_COMBINATION',
      message: 'branch cannot be an empty string.',
    }
  }

  if (raw.commitSha && !COMMIT_SHA_PATTERN.test(raw.commitSha.trim())) {
    return {
      ok: false,
      reasonCode: 'INVALID_COMMIT_SHA',
      message: 'commitSha must be 7–40 hexadecimal characters.',
    }
  }

  if (raw.pullRequestUrl && !isValidPullRequestUrl(raw.pullRequestUrl.trim())) {
    return {
      ok: false,
      reasonCode: 'INVALID_PULL_REQUEST_URL',
      message: 'pullRequestUrl must be a valid HTTP(S) pull/merge request URL.',
    }
  }

  for (const check of raw.checks) {
    if (!check.name?.trim()) {
      return {
        ok: false,
        reasonCode: 'INVALID_STATUS_COMBINATION',
        message: 'Each check must have a non-empty name.',
      }
    }
    if (check.status !== 'PASSED' && check.status !== 'FAILED' && check.status !== 'SKIPPED') {
      return {
        ok: false,
        reasonCode: 'INVALID_STATUS_COMBINATION',
        message: `Invalid check status: ${String(check.status)}`,
      }
    }
  }

  if (raw.finalStatus === 'SUCCEEDED' && !hasExecutionEvidence(raw)) {
    return {
      ok: false,
      reasonCode: 'EXECUTION_EVIDENCE_REQUIRED',
      message: 'SUCCEEDED requires execution evidence (summary, files, branch, commit, or PR).',
    }
  }

  if (raw.finalStatus === 'SUCCEEDED' && raw.errors.length > 0) {
    return {
      ok: false,
      reasonCode: 'INVALID_STATUS_COMBINATION',
      message: 'SUCCEEDED cannot include errors.',
    }
  }

  if (raw.finalStatus === 'FAILED' && raw.errors.length === 0 && !raw.summary.trim()) {
    return {
      ok: false,
      reasonCode: 'INVALID_STATUS_COMBINATION',
      message: 'FAILED requires errors or a non-empty summary.',
    }
  }

  const normalized: ManualCloudAgentImportInput = {
    ...raw,
    toolExecutionRunId: raw.toolExecutionRunId.trim(),
    branch: raw.branch?.trim() || null,
    commitSha: raw.commitSha?.trim() || null,
    pullRequestUrl: raw.pullRequestUrl?.trim() || null,
    summary: raw.summary.trim(),
    changedFiles: normalizeChangedFiles(raw.changedFiles),
    checks: raw.checks.map((check) => ({
      name: check.name.trim(),
      status: check.status,
      details: check.details?.trim(),
    })),
    artifacts: raw.artifacts.map((artifact) => ({
      type: artifact.type.trim(),
      reference: artifact.reference.trim(),
      description: artifact.description?.trim(),
    })),
    errors: raw.errors.map((error) => ({
      code: error.code.trim(),
      message: error.message.trim(),
      details: error.details,
    })),
    startedAt: raw.startedAt?.trim() || null,
    finishedAt: raw.finishedAt.trim(),
    externalCorrelationId: raw.externalCorrelationId?.trim() || null,
    metadata: raw.metadata ?? {},
  }

  return { ok: true, input: normalized }
}
