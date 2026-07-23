/**
 * Employee Tool Review — envelope evaluation (AI-COMPANY-113F).
 */

import type { CursorResultCheck, CursorResultEnvelope } from '../cursorResult/cursorResultEnvelopeTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import {
  checksPassedFromOutcome,
  type EmployeeToolReviewChecksOutcome,
  type EmployeeToolReviewEvaluation,
} from './employeeToolReviewTypes'

/**
 * "Were checks required?" comes from the request (`run.checks`), never from the
 * emptiness of the reported list. Reading it off the result would let an
 * executor that silently skipped its checks grade exactly like an analysis task
 * that legitimately had none.
 */
function resolveChecksOutcome(
  assessments: Array<{ passed: boolean }>,
  requiredChecks: string[],
): EmployeeToolReviewChecksOutcome {
  if (assessments.length === 0) {
    return requiredChecks.length > 0 ? 'missing' : 'not_required'
  }
  return assessments.every((item) => item.passed) ? 'passed' : 'failed'
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

function assessCheck(check: CursorResultCheck): {
  name: string
  status: string
  outputSummary: string
  passed: boolean
} {
  return {
    name: check.name,
    status: check.status,
    outputSummary: check.outputSummary,
    passed: check.status === 'passed',
  }
}

function evaluateExpectedResultAlignment(
  envelope: CursorResultEnvelope,
  expectedResult: string,
  checksOutcome: EmployeeToolReviewChecksOutcome,
): boolean {
  const expected = expectedResult.trim()
  if (!expected) {
    return envelope.status === 'completed' && envelope.errors.length === 0
  }

  const tokens = expected
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4)
  if (tokens.length === 0) {
    return envelope.status === 'completed' && envelope.errors.length === 0
  }

  const haystack = [
    envelope.summary,
    ...envelope.changedFiles,
    ...envelope.checks.map((item) => item.outputSummary),
  ]
    .join(' ')
    .toLowerCase()

  const matched = tokens.filter((token) => haystack.includes(token)).length
  const ratio = matched / tokens.length

  if (ratio >= 0.25) return true
  return (
    envelope.status === 'completed' &&
    envelope.errors.length === 0 &&
    checksPassedFromOutcome(checksOutcome)
  )
}

export function evaluateCursorResultForBuilderReview(
  envelope: CursorResultEnvelope,
  run: ToolExecutionRun,
): EmployeeToolReviewEvaluation {
  const outOfScope =
    run.fileScope.length === 0
      ? []
      : envelope.changedFiles.filter(
          (file) => !run.fileScope.some((scope) => fileMatchesScope(file, scope)),
        )

  const checkAssessments = envelope.checks.map(assessCheck)
  const checksOutcome = resolveChecksOutcome(checkAssessments, run.checks)
  const checksPassed = checksPassedFromOutcome(checksOutcome)
  const hasErrors = envelope.errors.length > 0 || envelope.status === 'failed'
  const hasUnfinished = envelope.unfinishedItems.length > 0 || envelope.status === 'partial'

  const notes: string[] = []
  if (outOfScope.length > 0) {
    notes.push(`Out of scope files: ${outOfScope.join(', ')}`)
  }
  if (checksOutcome === 'failed') {
    notes.push('One or more checks did not pass.')
  }
  if (checksOutcome === 'missing') {
    notes.push(`Checks were required but none were reported: ${run.checks.join(', ')}`)
  }
  if (hasErrors) {
    notes.push('Result contains errors — review before accepting.')
  }
  if (hasUnfinished) {
    notes.push('Unfinished items reported — confirm before MAX handoff.')
  }
  if (envelope.warnings.length > 0) {
    notes.push(`Warnings: ${envelope.warnings.slice(0, 3).join('; ')}`)
  }

  return {
    fileScopeOk: outOfScope.length === 0,
    outOfScopeFiles: outOfScope,
    checksOutcome,
    checksPassed,
    checkAssessments,
    expectedResultAligned: evaluateExpectedResultAlignment(envelope, run.expectedResult, checksOutcome),
    hasErrors,
    hasUnfinished,
    notes,
  }
}
