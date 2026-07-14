/**
 * GitHub Evidence Reader — pure verification (AI-COMPANY-114).
 */

import { parseResultMarker } from '../cursorAutomationRunner/cursorAutomationResultMarker'
import type { CursorAutomationResultMarker } from '../cursorAutomationRunner/cursorAutomationRunnerTypes'
import type { CursorCheckResult } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import { parsePullRequestRef } from './githubEvidenceRepository'
import type {
  GitHubEvidenceItem,
  GitHubEvidenceReasonCode,
  GitHubEvidenceTransportSnapshot,
  GitHubRepositoryRef,
} from './githubEvidenceReaderTypes'

const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i
const PROTECTED_BRANCHES = new Set(['main', 'master', 'production', 'prod'])

export function isProtectedBranchName(branch: string): boolean {
  const normalized = branch.trim().toLowerCase()
  if (PROTECTED_BRANCHES.has(normalized)) return true
  if (normalized.startsWith('release/')) return true
  const leaf = normalized.split('/').pop() ?? normalized
  if (PROTECTED_BRANCHES.has(leaf)) return true
  if (leaf.startsWith('release/')) return true
  return false
}

export function normalizeChangedFilePath(path: string): string | null {
  const trimmed = path.trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (!trimmed || trimmed.startsWith('/') || trimmed.includes('../')) return null
  return trimmed
}

export function normalizeChangedFiles(paths: string[]): string[] {
  const unique = new Set<string>()
  for (const path of paths) {
    const normalized = normalizeChangedFilePath(path)
    if (normalized) unique.add(normalized)
  }
  return [...unique]
}

export function compareChangedFiles(markerFiles: string[], actualFiles: string[]): {
  ok: boolean
  missingInCommit: string[]
  extraInCommit: string[]
} {
  const marker = new Set(
    normalizeChangedFiles(markerFiles).filter((file) => !file.startsWith('tmp/ai-company-results/')),
  )
  const actual = new Set(normalizeChangedFiles(actualFiles))
  const missingInCommit = [...marker].filter((file) => !actual.has(file))
  const extraInCommit = [...actual].filter((file) => !marker.has(file))
  return { ok: missingInCommit.length === 0, missingInCommit, extraInCommit }
}

export function normalizeReportedChecks(
  checks: CursorAutomationResultMarker['checks'],
): CursorCheckResult[] {
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

export function normalizeVerifiedChecks(
  snapshot: GitHubEvidenceTransportSnapshot,
): CursorCheckResult[] {
  return snapshot.checkRuns.map((run) => ({
    name: run.name,
    status:
      run.conclusion === 'success'
        ? 'passed'
        : run.conclusion === 'failure'
          ? 'failed'
          : run.conclusion === 'skipped'
            ? 'skipped'
            : 'unknown',
    outputSummary: run.status,
  }))
}

export type VerificationOutcome = {
  valid: boolean
  reasonCode: GitHubEvidenceReasonCode
  marker: CursorAutomationResultMarker | null
  evidence: GitHubEvidenceItem[]
  errors: Array<{ code: string; message: string }>
  changedFiles: string[]
  reportedChecks: CursorCheckResult[]
  verifiedChecks: CursorCheckResult[]
}

function buildInvalid(
  marker: CursorAutomationResultMarker | null,
  reasonCode: GitHubEvidenceReasonCode,
  evidence: GitHubEvidenceItem[],
  errors: Array<{ code: string; message: string }>,
  snapshot: GitHubEvidenceTransportSnapshot,
  reportedChecks: CursorCheckResult[] = marker ? normalizeReportedChecks(marker.checks) : [],
  verifiedChecks: CursorCheckResult[] = normalizeVerifiedChecks(snapshot),
  changedFiles: string[] = [],
): VerificationOutcome {
  return {
    valid: false,
    reasonCode,
    marker,
    evidence,
    errors,
    changedFiles,
    reportedChecks,
    verifiedChecks,
  }
}

export function verifyGitHubEvidence(input: {
  toolExecutionRunId: string
  repository: GitHubRepositoryRef
  baseBranch: string
  branchPrefix: string
  resultMarkerPath: string
  dispatchedAt: string
  requiresPullRequest: boolean
  markerContent: string | null
  markerBranch: string | null
  snapshot: GitHubEvidenceTransportSnapshot
  clockSkewMs: number
}): VerificationOutcome {
  const evidence: GitHubEvidenceItem[] = []
  const errors: Array<{ code: string; message: string }> = []
  const emptySnapshot = input.snapshot

  if (!input.markerContent || !input.markerBranch) {
    return buildInvalid(null, 'MARKER_NOT_FOUND', evidence, errors, emptySnapshot)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(input.markerContent)
  } catch {
    return buildInvalid(null, 'MARKER_INVALID', evidence, [{ code: 'MARKER_INVALID', message: 'Invalid JSON.' }], emptySnapshot)
  }

  const marker = parseResultMarker(parsed)
  if (!marker) {
    return buildInvalid(
      null,
      'MARKER_INVALID',
      [{ type: 'MARKER', reference: input.resultMarkerPath, verified: false, details: {} }],
      [{ code: 'MARKER_INVALID', message: 'Marker schema is invalid.' }],
      emptySnapshot,
    )
  }

  evidence.push({
    type: 'MARKER',
    reference: input.resultMarkerPath,
    verified: true,
    details: { branch: input.markerBranch },
  })

  if (marker.toolExecutionRunId !== input.toolExecutionRunId) {
    errors.push({ code: 'RUN_ID_MISMATCH', message: 'Marker run id mismatch.' })
    return buildInvalid(marker, 'RUN_ID_MISMATCH', evidence, errors, emptySnapshot)
  }

  const branch = marker.branch.trim()
  if (!branch.startsWith(input.branchPrefix)) {
    errors.push({ code: 'BRANCH_PREFIX_MISMATCH', message: `Branch must start with ${input.branchPrefix}` })
    return buildInvalid(marker, 'BRANCH_PREFIX_MISMATCH', evidence, errors, emptySnapshot)
  }

  if (isProtectedBranchName(branch)) {
    errors.push({ code: 'PROTECTED_BRANCH_REJECTED', message: `Protected branch ${branch} rejected.` })
    return buildInvalid(marker, 'PROTECTED_BRANCH_REJECTED', evidence, errors, emptySnapshot)
  }

  if (!COMMIT_SHA_PATTERN.test(marker.commitSha)) {
    errors.push({ code: 'INVALID_COMMIT_SHA', message: 'Invalid commit SHA in marker.' })
    return buildInvalid(marker, 'INVALID_COMMIT_SHA', evidence, errors, emptySnapshot)
  }

  if (!input.snapshot.commitExists) {
    errors.push({ code: 'COMMIT_NOT_FOUND', message: `Commit ${marker.commitSha} not found.` })
    return buildInvalid(marker, 'COMMIT_NOT_FOUND', evidence, errors, emptySnapshot)
  }

  if (!input.snapshot.commitOnBranch) {
    errors.push({ code: 'COMMIT_BRANCH_MISMATCH', message: 'Commit is not reachable from branch.' })
    return buildInvalid(marker, 'COMMIT_BRANCH_MISMATCH', evidence, errors, emptySnapshot)
  }

  if (input.snapshot.commitTimestamp) {
    const dispatchedAt = Date.parse(input.dispatchedAt)
    const commitAt = Date.parse(input.snapshot.commitTimestamp)
    if (Number.isFinite(dispatchedAt) && Number.isFinite(commitAt)) {
      if (commitAt + input.clockSkewMs < dispatchedAt) {
        errors.push({ code: 'COMMIT_BEFORE_DISPATCH', message: 'Commit is older than dispatch window.' })
        return buildInvalid(marker, 'COMMIT_BEFORE_DISPATCH', evidence, errors, emptySnapshot)
      }
    }
  }

  evidence.push({ type: 'BRANCH', reference: branch, verified: true, details: { markerBranch: input.markerBranch } })
  evidence.push({ type: 'COMMIT', reference: marker.commitSha, verified: true, details: { onBranch: branch } })

  const reportedChecks = normalizeReportedChecks(marker.checks)
  const verifiedChecks = normalizeVerifiedChecks(input.snapshot)

  if (marker.pullRequestUrl) {
    const prRef = parsePullRequestRef(marker.pullRequestUrl, input.repository)
    if (!prRef.ok) {
      errors.push({ code: 'PR_REPOSITORY_MISMATCH', message: 'PR URL does not match repository.' })
      return buildInvalid(marker, 'PR_REPOSITORY_MISMATCH', evidence, errors, emptySnapshot, reportedChecks, verifiedChecks)
    }

    const pr = input.snapshot.pullRequest
    if (!pr) {
      errors.push({ code: 'PR_NOT_FOUND', message: 'Pull request not found in GitHub evidence.' })
      return buildInvalid(marker, 'PR_NOT_FOUND', evidence, errors, emptySnapshot, reportedChecks, verifiedChecks)
    }

    if (pr.merged) {
      errors.push({ code: 'MERGED_PR_REJECTED', message: 'Merged PR cannot be used as execution evidence in V1.' })
      return buildInvalid(marker, 'MERGED_PR_REJECTED', evidence, errors, emptySnapshot, reportedChecks, verifiedChecks)
    }

    if (pr.headBranch !== branch) {
      errors.push({ code: 'PR_BRANCH_MISMATCH', message: 'PR head branch mismatch.' })
      return buildInvalid(marker, 'PR_BRANCH_MISMATCH', evidence, errors, emptySnapshot, reportedChecks, verifiedChecks)
    }

    if (pr.state !== 'OPEN' && !pr.draft) {
      errors.push({ code: 'PR_NOT_FOUND', message: `PR state ${pr.state} is not acceptable for V1.` })
      return buildInvalid(marker, 'PR_NOT_FOUND', evidence, errors, emptySnapshot, reportedChecks, verifiedChecks)
    }

    evidence.push({
      type: 'PULL_REQUEST',
      reference: marker.pullRequestUrl,
      verified: true,
      details: { number: pr.number, state: pr.state, draft: pr.draft },
    })
  } else if (input.requiresPullRequest) {
    errors.push({ code: 'PR_NOT_FOUND', message: 'Required pull request is missing.' })
    return buildInvalid(marker, 'PR_NOT_FOUND', evidence, errors, emptySnapshot, reportedChecks, verifiedChecks)
  }

  const fileCompare = compareChangedFiles(marker.changedFiles, input.snapshot.commitChangedFiles)
  const changedFiles = normalizeChangedFiles([
    ...input.snapshot.commitChangedFiles,
    ...marker.changedFiles,
  ])

  if (!fileCompare.ok) {
    errors.push({
      code: 'CHANGED_FILES_MISMATCH',
      message: `Changed files mismatch. Missing: ${fileCompare.missingInCommit.join(', ')}`,
    })
    return buildInvalid(marker, 'CHANGED_FILES_MISMATCH', evidence, errors, emptySnapshot, reportedChecks, verifiedChecks, changedFiles)
  }

  if (marker.status === 'SUCCEEDED' && (!marker.summary.trim() || !input.snapshot.commitExists)) {
    errors.push({ code: 'EVIDENCE_INCOMPLETE', message: 'Succeeded marker lacks complete evidence.' })
    return buildInvalid(marker, 'EVIDENCE_INCOMPLETE', evidence, errors, emptySnapshot, reportedChecks, verifiedChecks, changedFiles)
  }

  for (const check of verifiedChecks) {
    evidence.push({
      type: 'CHECK',
      reference: check.name,
      verified: true,
      details: { status: check.status },
    })
  }

  return {
    valid: true,
    reasonCode: 'EVIDENCE_VERIFIED',
    marker,
    evidence,
    errors,
    changedFiles,
    reportedChecks,
    verifiedChecks,
  }
}
