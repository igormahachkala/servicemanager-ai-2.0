/**
 * Cursor Result Envelope — validation (AI-COMPANY-113F).
 */

import { scanCursorLocalSecurityViolations } from '../cursorLocalAdapter/cursorLocalAdapterSecurity'
import { getToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  CURSOR_RESULT_CHECK_STATUSES,
  CURSOR_RESULT_ENVELOPE_STATUSES,
  CURSOR_RESULT_ENVELOPE_VERSION,
  type CursorResultCheck,
  type CursorResultEnvelope,
  type CursorResultEnvelopeStatus,
} from './cursorResultEnvelopeTypes'

export type CursorResultValidationIssue = {
  code:
    | 'invalid_shape'
    | 'run_not_found'
    | 'employee_mismatch'
    | 'work_item_mismatch'
    | 'secrets_detected'
    | 'file_out_of_scope'
    | 'invalid_check'
  message: string
}

export type CursorResultValidationResult =
  | { ok: true; envelope: CursorResultEnvelope; run: ToolExecutionRun }
  | { ok: false; issues: CursorResultValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim())
}

function parseCheck(value: unknown): CursorResultCheck | null {
  if (!isRecord(value)) return null
  if (typeof value.name !== 'string' || !value.name.trim()) return null
  const status =
    typeof value.status === 'string' &&
    (CURSOR_RESULT_CHECK_STATUSES as readonly string[]).includes(value.status)
      ? (value.status as CursorResultCheck['status'])
      : null
  if (!status) return null
  if (typeof value.outputSummary !== 'string' || !value.outputSummary.trim()) return null
  return {
    name: value.name.trim(),
    status,
    outputSummary: value.outputSummary.trim(),
  }
}

function parseCommit(value: unknown): CursorResultEnvelope['commit'] {
  if (!isRecord(value)) return null
  return {
    sha: typeof value.sha === 'string' ? value.sha.trim() : null,
    message: typeof value.message === 'string' ? value.message.trim() : null,
    branch: typeof value.branch === 'string' ? value.branch.trim() : null,
  }
}

function parsePullRequest(value: unknown): CursorResultEnvelope['pullRequest'] {
  if (!isRecord(value)) return null
  return {
    url: typeof value.url === 'string' ? value.url.trim() : null,
    title: typeof value.title === 'string' ? value.title.trim() : null,
    number: typeof value.number === 'number' ? value.number : null,
  }
}

export function parseCursorResultEnvelope(raw: unknown): CursorResultEnvelope | null {
  if (!isRecord(raw)) return null

  const version = raw.version === CURSOR_RESULT_ENVELOPE_VERSION ? raw.version : null
  const toolExecutionRunId =
    typeof raw.toolExecutionRunId === 'string'
      ? raw.toolExecutionRunId.trim()
      : typeof raw.runId === 'string'
        ? raw.runId.trim()
        : ''
  const workItemId = typeof raw.workItemId === 'string' ? raw.workItemId.trim() : ''
  const employeeId = typeof raw.employeeId === 'string' ? raw.employeeId.trim() : ''
  const status =
    typeof raw.status === 'string' &&
    (CURSOR_RESULT_ENVELOPE_STATUSES as readonly string[]).includes(raw.status)
      ? (raw.status as CursorResultEnvelopeStatus)
      : null
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : ''
  const completedAt = typeof raw.completedAt === 'string' ? raw.completedAt.trim() : ''

  if (
    !version ||
    !toolExecutionRunId ||
    !workItemId ||
    !employeeId ||
    !status ||
    !summary ||
    !completedAt
  ) {
    return null
  }

  const checks = Array.isArray(raw.checks)
    ? raw.checks.map(parseCheck).filter((item): item is CursorResultCheck => item !== null)
    : []

  return {
    version,
    toolExecutionRunId,
    workItemId,
    employeeId: resolveCanonicalEmployeeId(employeeId),
    status,
    summary,
    changedFiles: parseStringArray(raw.changedFiles),
    checks,
    commit: parseCommit(raw.commit),
    pullRequest: parsePullRequest(raw.pullRequest),
    warnings: parseStringArray(raw.warnings),
    errors: parseStringArray(raw.errors),
    assumptions: parseStringArray(raw.assumptions),
    unfinishedItems: parseStringArray(raw.unfinishedItems),
    completedAt,
  }
}

function fileMatchesScope(filePath: string, scopePattern: string): boolean {
  const normalizedFile = filePath.replace(/\\/g, '/').replace(/^\.\//, '')
  const normalizedScope = scopePattern.replace(/\\/g, '/').replace(/^\.\//, '')

  if (normalizedScope.endsWith('/**')) {
    const prefix = normalizedScope.slice(0, -3)
    return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`)
  }
  if (normalizedScope.endsWith('/*')) {
    const prefix = normalizedScope.slice(0, -2)
    if (!normalizedFile.startsWith(`${prefix}/`)) return false
    return normalizedFile.slice(prefix.length + 1).split('/').length === 1
  }
  return normalizedFile === normalizedScope || normalizedFile.startsWith(`${normalizedScope}/`)
}

function validateFileScope(changedFiles: string[], fileScope: string[]): string[] {
  if (fileScope.length === 0) return []
  return changedFiles.filter(
    (file) => !fileScope.some((scope) => fileMatchesScope(file, scope)),
  )
}

function scanEnvelopeSecrets(envelope: CursorResultEnvelope): CursorResultValidationIssue[] {
  const haystack = JSON.stringify(envelope)
  const violations = scanCursorLocalSecurityViolations(haystack)
  if (violations.length === 0) return []
  return violations.map((item) => ({
    code: 'secrets_detected' as const,
    message: `Result blocked (${item.label}): ${item.match}`,
  }))
}

export function validateCursorResultEnvelope(
  raw: unknown,
  options: { expectedRunId?: string } = {},
): CursorResultValidationResult {
  const issues: CursorResultValidationIssue[] = []
  const envelope = parseCursorResultEnvelope(raw)
  if (!envelope) {
    return {
      ok: false,
      issues: [{ code: 'invalid_shape', message: 'result.json does not match CursorResultEnvelope v1.' }],
    }
  }

  if (options.expectedRunId && envelope.toolExecutionRunId !== options.expectedRunId) {
    issues.push({
      code: 'invalid_shape',
      message: `toolExecutionRunId mismatch (expected ${options.expectedRunId}).`,
    })
  }

  const run = getToolExecutionRun(envelope.toolExecutionRunId)
  if (!run) {
    issues.push({
      code: 'run_not_found',
      message: `ToolExecutionRun ${envelope.toolExecutionRunId} was not found.`,
    })
  } else {
    if (resolveCanonicalEmployeeId(envelope.employeeId) !== run.employeeId) {
      issues.push({
        code: 'employee_mismatch',
        message: 'employeeId does not match ToolExecutionRun.',
      })
    }
    if (envelope.workItemId !== run.workItemId) {
      issues.push({
        code: 'work_item_mismatch',
        message: 'workItemId does not match ToolExecutionRun.',
      })
    }
    const outOfScope = validateFileScope(envelope.changedFiles, run.fileScope)
    for (const file of outOfScope) {
      issues.push({
        code: 'file_out_of_scope',
        message: `changedFiles entry outside fileScope: ${file}`,
      })
    }
  }

  if (envelope.checks.length === 0) {
    issues.push({
      code: 'invalid_check',
      message: 'checks must include at least one entry with name, status, outputSummary.',
    })
  }

  issues.push(...scanEnvelopeSecrets(envelope))

  if (issues.length > 0 || !run) {
    return { ok: false, issues }
  }

  return { ok: true, envelope, run }
}
