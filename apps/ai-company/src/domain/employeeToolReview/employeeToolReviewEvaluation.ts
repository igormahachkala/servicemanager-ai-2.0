/**
 * Employee Tool Review — envelope evaluation (AI-COMPANY-113F).
 */

import type { CursorResultCheck, CursorResultEnvelope } from '../cursorResult/cursorResultEnvelopeTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import type { EmployeeToolReviewEvaluation } from './employeeToolReviewTypes'

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
    envelope.checks.every((item) => item.status === 'passed')
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
  const checksPassed = checkAssessments.length > 0 && checkAssessments.every((item) => item.passed)
  const hasErrors = envelope.errors.length > 0 || envelope.status === 'failed'
  const hasUnfinished = envelope.unfinishedItems.length > 0 || envelope.status === 'partial'

  const notes: string[] = []
  if (outOfScope.length > 0) {
    notes.push(`Out of scope files: ${outOfScope.join(', ')}`)
  }
  if (!checksPassed) {
    notes.push('One or more checks did not pass.')
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
    checksPassed,
    checkAssessments,
    expectedResultAligned: evaluateExpectedResultAlignment(envelope, run.expectedResult),
    hasErrors,
    hasUnfinished,
    notes,
  }
}
