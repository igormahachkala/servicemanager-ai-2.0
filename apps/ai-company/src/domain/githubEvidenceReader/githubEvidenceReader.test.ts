/**
 * GitHub Evidence Reader — tests (AI-COMPANY-114).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CursorAutomationResultMarker } from '../cursorAutomationRunner/cursorAutomationRunnerTypes.ts'
import { reconcileCursorAutomationResult } from '../cursorAutomationRunner/cursorAutomationReconciliation.ts'
import { createDefaultReconcileDeps } from '../cursorAutomationRunner/cursorAutomationRunnerDefaultDeps.ts'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver.ts'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes.ts'
import {
  compareChangedFiles,
  isProtectedBranchName,
  normalizeChangedFiles,
  normalizeReportedChecks,
  normalizeVerifiedChecks,
  verifyGitHubEvidence,
} from './githubEvidenceVerification.ts'
import { resolveGitHubExecutionEvidence } from './resolveGitHubExecutionEvidence.ts'
import type {
  GitHubEvidenceTransport,
  GitHubEvidenceTransportSnapshot,
  GitHubExecutionEvidenceResult,
} from './githubEvidenceReaderTypes.ts'
import { redactGitHubSecret } from './githubEvidenceSecretRedaction.ts'

const RUN_ID = 'terun-evidence-001'
const REPO = { owner: 'igor', name: 'servicemanager-ai-2.0' }
const DISPATCHED_AT = '2026-07-14T09:00:00.000Z'
const MARKER_PATH = `tmp/ai-company-results/${RUN_ID}.json`

function baseMarker(overrides: Partial<CursorAutomationResultMarker> = {}): CursorAutomationResultMarker {
  return {
    toolExecutionRunId: RUN_ID,
    status: 'SUCCEEDED',
    summary: 'Created test file',
    branch: 'cursor/autonomous-001',
    commitSha: 'abc1234567890abcdef1234567890abcdef1234',
    pullRequestUrl: 'https://github.com/igor/servicemanager-ai-2.0/pull/42',
    changedFiles: ['tmp/autonomous-builder-test.txt'],
    checks: [{ name: 'build', status: 'PASSED', outputSummary: null }],
    errors: [],
    finishedAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  }
}

function verifiedSnapshot(marker: CursorAutomationResultMarker): GitHubEvidenceTransportSnapshot {
  return {
    authAvailable: true,
    accessDenied: false,
    rateLimited: false,
    transportError: null,
    branches: [{ name: marker.branch, updatedAt: '2026-07-14T09:30:00.000Z' }],
    markerBranch: marker.branch,
    markerContent: JSON.stringify(marker),
    commitExists: true,
    commitOnBranch: true,
    commitTimestamp: '2026-07-14T09:45:00.000Z',
    commitChangedFiles: marker.changedFiles,
    pullRequest: marker.pullRequestUrl
      ? {
          url: marker.pullRequestUrl,
          number: 42,
          state: 'OPEN',
          headBranch: marker.branch,
          baseBranch: 'main',
          merged: false,
          draft: true,
        }
      : null,
    checkRuns: [{ name: 'build', status: 'completed', conclusion: 'success' }],
  }
}

function createMockTransport(snapshot: GitHubEvidenceTransportSnapshot): GitHubEvidenceTransport {
  return {
    fetchSnapshot: async () => snapshot,
  }
}

function resolveInput(overrides: Record<string, unknown> = {}) {
  return {
    toolExecutionRunId: RUN_ID,
    repository: REPO,
    baseBranch: 'main',
    branchPrefix: 'cursor/',
    resultMarkerPath: MARKER_PATH,
    externalCorrelationId: 'bc-001',
    dispatchedAt: DISPATCHED_AT,
    requiresPullRequest: false,
    ...overrides,
  }
}

describe('githubEvidenceReader', () => {
  it('1. marker not found → PENDING/NOT_FOUND', async () => {
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport({
        authAvailable: true,
        accessDenied: false,
        rateLimited: false,
        transportError: null,
        branches: [],
        markerBranch: null,
        markerContent: null,
        commitExists: false,
        commitOnBranch: false,
        commitTimestamp: null,
        commitChangedFiles: [],
        pullRequest: null,
        checkRuns: [],
      }),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'NOT_FOUND')
    assert.equal(result.reasonCode, 'MARKER_NOT_FOUND')
  })

  it('1b. repository not found (gh 404) → GITHUB_REPO_NOT_FOUND', async () => {
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: {
        fetchSnapshot: async () => {
          throw Object.assign(new Error('repo_not_found'), { code: 404 })
        },
      },
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'PENDING')
    assert.equal(result.reasonCode, 'GITHUB_REPO_NOT_FOUND')
    assert.equal(result.errors[0]?.code, 'GITHUB_REPO_NOT_FOUND')
  })

  it('1c. gh 403 during branch listing → GITHUB_ACCESS_DENIED', async () => {
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: {
        fetchSnapshot: async () => {
          throw Object.assign(new Error('access_denied'), { code: 403 })
        },
      },
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'PENDING')
    assert.equal(result.reasonCode, 'GITHUB_ACCESS_DENIED')
    assert.equal(result.errors[0]?.code, 'GITHUB_ACCESS_DENIED')
  })

  it('1d. gh 429 during branch listing → GITHUB_RATE_LIMITED', async () => {
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: {
        fetchSnapshot: async () => {
          throw Object.assign(new Error('rate_limited'), { code: 429 })
        },
      },
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'PENDING')
    assert.equal(result.reasonCode, 'GITHUB_RATE_LIMITED')
    assert.equal(result.errors[0]?.code, 'GITHUB_RATE_LIMITED')
  })

  it('2. valid marker found', async () => {
    const marker = baseMarker()
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(verifiedSnapshot(marker)),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'FOUND')
    assert.equal(result.reasonCode, 'EVIDENCE_VERIFIED')
    assert.equal(result.marker?.toolExecutionRunId, RUN_ID)
  })

  it('3. invalid JSON marker', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    snapshot.markerContent = '{not-json'
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'MARKER_INVALID')
  })

  it('4. toolExecutionRunId mismatch', async () => {
    const marker = baseMarker({ toolExecutionRunId: 'other-run' })
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(verifiedSnapshot(marker)),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'RUN_ID_MISMATCH')
  })

  it('5. branch not found → commit not on branch', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    snapshot.commitOnBranch = false
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'COMMIT_BRANCH_MISMATCH')
  })

  it('6. protected branch rejected', async () => {
    const marker = baseMarker({ branch: 'cursor/prod' })
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(verifiedSnapshot(marker)),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'PROTECTED_BRANCH_REJECTED')
    assert.equal(isProtectedBranchName('release/1.0'), true)
  })

  it('7. branch prefix mismatch', async () => {
    const marker = baseMarker({ branch: 'feature/autonomous-001' })
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(verifiedSnapshot(marker)),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'BRANCH_PREFIX_MISMATCH')
  })

  it('8. commit not found', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    snapshot.commitExists = false
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'COMMIT_NOT_FOUND')
  })

  it('9. invalid commit SHA', async () => {
    const marker = baseMarker({ commitSha: 'not-a-sha' })
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(verifiedSnapshot(marker)),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'INVALID_COMMIT_SHA')
  })

  it('10. commit not reachable from branch', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    snapshot.commitOnBranch = false
    const verification = verifyGitHubEvidence({
      toolExecutionRunId: RUN_ID,
      repository: REPO,
      baseBranch: 'main',
      branchPrefix: 'cursor/',
      resultMarkerPath: MARKER_PATH,
      dispatchedAt: DISPATCHED_AT,
      requiresPullRequest: false,
      markerContent: JSON.stringify(marker),
      markerBranch: marker.branch,
      snapshot,
      clockSkewMs: 300_000,
    })
    assert.equal(verification.valid, false)
    assert.equal(verification.reasonCode, 'COMMIT_BRANCH_MISMATCH')
  })

  it('11. commit before dispatch rejected', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    snapshot.commitTimestamp = '2026-07-14T08:00:00.000Z'
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 60_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'COMMIT_BEFORE_DISPATCH')
  })

  it('12. valid commit accepted', async () => {
    const marker = baseMarker()
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(verifiedSnapshot(marker)),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'FOUND')
    assert.ok(result.evidence.some((item) => item.type === 'COMMIT' && item.verified))
  })

  it('13. PR optional and absent accepted', async () => {
    const marker = baseMarker({ pullRequestUrl: null })
    const snapshot = verifiedSnapshot(marker)
    snapshot.pullRequest = null
    const result = await resolveGitHubExecutionEvidence(resolveInput({ requiresPullRequest: false }), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'FOUND')
  })

  it('14. required PR absent rejected', async () => {
    const marker = baseMarker({ pullRequestUrl: null })
    const snapshot = verifiedSnapshot(marker)
    snapshot.pullRequest = null
    const result = await resolveGitHubExecutionEvidence(resolveInput({ requiresPullRequest: true }), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'PR_NOT_FOUND')
  })

  it('15. PR repository mismatch', async () => {
    const marker = baseMarker({
      pullRequestUrl: 'https://github.com/other/repo/pull/1',
    })
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(verifiedSnapshot(marker)),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'PR_REPOSITORY_MISMATCH')
  })

  it('16. PR branch mismatch', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    if (snapshot.pullRequest) snapshot.pullRequest.headBranch = 'cursor/other-branch'
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'PR_BRANCH_MISMATCH')
  })

  it('17. draft PR accepted', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    if (snapshot.pullRequest) snapshot.pullRequest.draft = true
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'FOUND')
  })

  it('18. open PR accepted', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    if (snapshot.pullRequest) {
      snapshot.pullRequest.draft = false
      snapshot.pullRequest.state = 'OPEN'
    }
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'FOUND')
  })

  it('19. merged PR rejected for execution evidence V1', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    if (snapshot.pullRequest) snapshot.pullRequest.merged = true
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.equal(result.reasonCode, 'MERGED_PR_REJECTED')
  })

  it('20. changed files normalized', () => {
    const normalized = normalizeChangedFiles(['./tmp/a.txt', 'tmp/a.txt', '/abs.txt', '../secret.txt'])
    assert.deepEqual(normalized, ['tmp/a.txt'])
  })

  it('21. changed files mismatch reported', () => {
    const compare = compareChangedFiles(['tmp/a.txt'], ['tmp/b.txt'])
    assert.equal(compare.ok, false)
    assert.deepEqual(compare.missingInCommit, ['tmp/a.txt'])
  })

  it('22. reported checks separated from verified checks', () => {
    const marker = baseMarker({
      checks: [{ name: 'build', status: 'PASSED', outputSummary: 'ok' }],
    })
    const reported = normalizeReportedChecks(marker.checks)
    const verified = normalizeVerifiedChecks(verifiedSnapshot(marker))
    assert.equal(reported[0].status, 'passed')
    assert.equal(verified[0].status, 'passed')
    assert.notEqual(reported, verified)
  })

  it('23. GitHub auth unavailable', async () => {
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport({
        authAvailable: false,
        accessDenied: false,
        rateLimited: false,
        transportError: 'auth_unavailable',
        branches: [],
        markerBranch: null,
        markerContent: null,
        commitExists: false,
        commitOnBranch: false,
        commitTimestamp: null,
        commitChangedFiles: [],
        pullRequest: null,
        checkRuns: [],
      }),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'PENDING')
    assert.equal(result.reasonCode, 'GITHUB_AUTH_UNAVAILABLE')
  })

  it('24. GitHub access denied', async () => {
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport({
        authAvailable: true,
        accessDenied: true,
        rateLimited: false,
        transportError: 'access_denied',
        branches: [],
        markerBranch: null,
        markerContent: null,
        commitExists: false,
        commitOnBranch: false,
        commitTimestamp: null,
        commitChangedFiles: [],
        pullRequest: null,
        checkRuns: [],
      }),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'PENDING')
    assert.equal(result.reasonCode, 'GITHUB_ACCESS_DENIED')
  })

  it('25. rate limit response', async () => {
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport({
        authAvailable: true,
        accessDenied: false,
        rateLimited: true,
        transportError: 'rate_limited',
        branches: [],
        markerBranch: null,
        markerContent: null,
        commitExists: false,
        commitOnBranch: false,
        commitTimestamp: null,
        commitChangedFiles: [],
        pullRequest: null,
        checkRuns: [],
      }),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'PENDING')
    assert.equal(result.reasonCode, 'GITHUB_RATE_LIMITED')
  })

  it('26. transport failure', async () => {
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: {
        fetchSnapshot: async () => {
          throw new Error('network down')
        },
      },
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'PENDING')
    assert.equal(result.reasonCode, 'GITHUB_TRANSPORT_ERROR')
  })

  it('27. repeated reconciliation idempotent', async () => {
    const marker = baseMarker()
    const evidence = {
      status: 'FOUND' as const,
      marker,
      branch: marker.branch,
      commitSha: marker.commitSha,
      pullRequestUrl: marker.pullRequestUrl,
      changedFiles: marker.changedFiles,
      checks: [],
      reportedChecks: [],
      verifiedChecks: [],
      errors: [],
        evidence: [
          { type: 'BRANCH' as const, reference: marker.branch, verified: true, details: {} },
          { type: 'COMMIT' as const, reference: marker.commitSha, verified: true, details: {} },
          {
            type: 'PULL_REQUEST' as const,
            reference: marker.pullRequestUrl!,
            verified: true,
            details: {},
          },
        ],
      reasonCode: 'EVIDENCE_VERIFIED' as const,
      checkedAt: '2026-07-14T10:00:00.000Z',
    }

    let reviewCount = 0
    let existingReview: { id: string } | null = null
    const run: ToolExecutionRun = {
      id: RUN_ID,
      version: 'v1',
      companyId: 'company-default',
      employeeId: EMPLOYEE_ROUTE_IDS.builder,
      toolId: 'cursor',
      toolRequestId: 'td-001',
      workItemId: 'wi-001',
      delegationPlanId: 'dp-001',
      workerLoopId: null,
      builderToolDecisionId: null,
      legacyBuilderRunId: null,
      title: 'test',
      instructions: 'x',
      expectedResult: 'y',
      fileScope: [],
      checks: [],
      status: 'running',
      createdAt: DISPATCHED_AT,
      updatedAt: DISPATCHED_AT,
      approvedAt: DISPATCHED_AT,
      startedAt: DISPATCHED_AT,
      completedAt: null,
      failedAt: null,
      error: null,
      history: [],
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'k',
            dispatchPhase: 'RESULT_PENDING',
            ownerApprovedAt: DISPATCHED_AT,
            dispatchedAt: DISPATCHED_AT,
            reconciliationStartedAt: DISPATCHED_AT,
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: MARKER_PATH,
            branchPrefix: 'cursor/',
            attempts: [],
            timeoutAt: '2099-01-01T00:00:00.000Z',
            timeoutReason: null,
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    }

    const deps = createDefaultReconcileDeps({
      getRun: () => run,
      upsertRun: (r) => r,
      recordResult: (input) => ({
        ...run,
        status: 'awaiting_employee_review',
        result: { ...run.result!, output: input.output },
      }),
      failRun: () => run,
      resolveGitHubEvidence: async () => evidence,
      getReviewByRunId: () => existingReview as never,
      createReview: () => {
        reviewCount += 1
        existingReview = { id: 'review-1' }
        return existingReview as never
      },
      logEvent: () => {},
      now: () => Date.parse('2026-07-14T10:05:00.000Z'),
    })

    const first = await reconcileCursorAutomationResult({ runId: RUN_ID, pollIntervalMs: 0 }, deps)
    const second = await reconcileCursorAutomationResult({ runId: RUN_ID, pollIntervalMs: 0 }, deps)
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.equal(reviewCount, 1)
  })

  it('28. terminal run not overwritten', async () => {
    const marker = baseMarker()
    const run: ToolExecutionRun = {
      id: RUN_ID,
      version: 'v1',
      companyId: 'company-default',
      employeeId: EMPLOYEE_ROUTE_IDS.builder,
      toolId: 'cursor',
      toolRequestId: 'td-001',
      workItemId: 'wi-001',
      delegationPlanId: 'dp-001',
      workerLoopId: null,
      builderToolDecisionId: null,
      legacyBuilderRunId: null,
      title: 'test',
      instructions: 'x',
      expectedResult: 'y',
      fileScope: [],
      checks: [],
      status: 'awaiting_employee_review',
      createdAt: DISPATCHED_AT,
      updatedAt: DISPATCHED_AT,
      approvedAt: DISPATCHED_AT,
      startedAt: DISPATCHED_AT,
      completedAt: null,
      failedAt: null,
      error: null,
      history: [],
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'k',
            dispatchPhase: 'REVIEW_REQUIRED',
            ownerApprovedAt: DISPATCHED_AT,
            dispatchedAt: DISPATCHED_AT,
            reconciliationStartedAt: DISPATCHED_AT,
            reconciliationLastCheckedAt: '2026-07-14T10:00:00.000Z',
            reconciliationPollCount: 1,
            resultMarkerPath: MARKER_PATH,
            branchPrefix: 'cursor/',
            attempts: [],
            timeoutAt: '2099-01-01T00:00:00.000Z',
            timeoutReason: null,
          },
          cursorResultEnvelopeV110: {
            toolExecutionRunId: RUN_ID,
            route: 'CURSOR_AUTOMATION_WEBHOOK',
            transportStatus: 'DISPATCHED',
            executionStatus: 'SUCCEEDED',
            reviewStatus: 'PENDING',
            summary: 'done',
            branch: marker.branch,
            commitSha: marker.commitSha,
            pullRequestUrl: marker.pullRequestUrl,
            changedFiles: marker.changedFiles,
            checks: [],
            artifacts: [],
            errors: [],
            externalCorrelationId: null,
            startedAt: DISPATCHED_AT,
            finishedAt: '2026-07-14T10:00:00.000Z',
            metadata: {},
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    }

    const deps = createDefaultReconcileDeps({
      getRun: () => run,
      upsertRun: () => run,
      resolveGitHubEvidence: async () => ({
        status: 'FOUND',
        marker,
        branch: marker.branch,
        commitSha: marker.commitSha,
        pullRequestUrl: marker.pullRequestUrl,
        changedFiles: marker.changedFiles,
        checks: [],
        reportedChecks: [],
        verifiedChecks: [],
        errors: [],
        evidence: [],
        reasonCode: 'EVIDENCE_VERIFIED',
        checkedAt: '2026-07-14T10:00:00.000Z',
      }),
      logEvent: () => {},
    })

    const outcome = await reconcileCursorAutomationResult({ runId: RUN_ID, pollIntervalMs: 0 }, deps)
    assert.equal(outcome.ok, true)
    if (outcome.ok) assert.equal(outcome.status, 'DISCOVERED')
  })

  it('29. verified success → Builder Review path', async () => {
    const marker = baseMarker()
    let reviewCreated = false
    const run: ToolExecutionRun = {
      id: RUN_ID,
      version: 'v1',
      companyId: 'company-default',
      employeeId: EMPLOYEE_ROUTE_IDS.builder,
      toolId: 'cursor',
      toolRequestId: 'td-001',
      workItemId: 'wi-001',
      delegationPlanId: 'dp-001',
      workerLoopId: null,
      builderToolDecisionId: null,
      legacyBuilderRunId: null,
      title: 'test',
      instructions: 'x',
      expectedResult: 'y',
      fileScope: [],
      checks: [],
      status: 'running',
      createdAt: DISPATCHED_AT,
      updatedAt: DISPATCHED_AT,
      approvedAt: DISPATCHED_AT,
      startedAt: DISPATCHED_AT,
      completedAt: null,
      failedAt: null,
      error: null,
      history: [],
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'k',
            dispatchPhase: 'RESULT_PENDING',
            ownerApprovedAt: DISPATCHED_AT,
            dispatchedAt: DISPATCHED_AT,
            reconciliationStartedAt: DISPATCHED_AT,
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: MARKER_PATH,
            branchPrefix: 'cursor/',
            attempts: [],
            timeoutAt: '2099-01-01T00:00:00.000Z',
            timeoutReason: null,
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    }

    const deps = createDefaultReconcileDeps({
      getRun: () => run,
      upsertRun: (r) => r,
      recordResult: (input) => ({
        ...run,
        status: 'awaiting_employee_review',
        result: { ...run.result!, output: input.output },
      }),
      failRun: () => run,
      resolveGitHubEvidence: async () => ({
        status: 'FOUND',
        marker,
        branch: marker.branch,
        commitSha: marker.commitSha,
        pullRequestUrl: marker.pullRequestUrl,
        changedFiles: marker.changedFiles,
        checks: [],
        reportedChecks: [],
        verifiedChecks: [],
        errors: [],
        evidence: [
          { type: 'BRANCH', reference: marker.branch, verified: true, details: {} },
          { type: 'COMMIT', reference: marker.commitSha, verified: true, details: {} },
          {
            type: 'PULL_REQUEST',
            reference: marker.pullRequestUrl!,
            verified: true,
            details: {},
          },
        ],
        reasonCode: 'EVIDENCE_VERIFIED',
        checkedAt: '2026-07-14T10:00:00.000Z',
      }),
      createReview: () => {
        reviewCreated = true
        return { id: 'review-1' } as never
      },
      logEvent: () => {},
      now: () => Date.parse('2026-07-14T10:05:00.000Z'),
    })

    const outcome = await reconcileCursorAutomationResult({ runId: RUN_ID, pollIntervalMs: 0 }, deps)
    assert.equal(outcome.ok, true)
    if (outcome.ok) {
      assert.equal(outcome.status, 'DISCOVERED')
      assert.equal(reviewCreated, true)
    }
  })

  it('30. verified failed marker → FAILED', async () => {
    const marker = baseMarker({
      status: 'FAILED',
      summary: 'Task failed',
      pullRequestUrl: null,
      errors: [{ code: 'TASK_FAILED', message: 'boom' }],
    })
    const run: ToolExecutionRun = {
      id: RUN_ID,
      version: 'v1',
      companyId: 'company-default',
      employeeId: EMPLOYEE_ROUTE_IDS.builder,
      toolId: 'cursor',
      toolRequestId: 'td-001',
      workItemId: 'wi-001',
      delegationPlanId: 'dp-001',
      workerLoopId: null,
      builderToolDecisionId: null,
      legacyBuilderRunId: null,
      title: 'test',
      instructions: 'x',
      expectedResult: 'y',
      fileScope: [],
      checks: [],
      status: 'running',
      createdAt: DISPATCHED_AT,
      updatedAt: DISPATCHED_AT,
      approvedAt: DISPATCHED_AT,
      startedAt: DISPATCHED_AT,
      completedAt: null,
      failedAt: null,
      error: null,
      history: [],
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'k',
            dispatchPhase: 'RESULT_PENDING',
            ownerApprovedAt: DISPATCHED_AT,
            dispatchedAt: DISPATCHED_AT,
            reconciliationStartedAt: DISPATCHED_AT,
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: MARKER_PATH,
            branchPrefix: 'cursor/',
            attempts: [],
            timeoutAt: '2099-01-01T00:00:00.000Z',
            timeoutReason: null,
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    }

    const deps = createDefaultReconcileDeps({
      getRun: () => run,
      upsertRun: (r) => r,
      recordResult: () => run,
      failRun: () => ({ ...run, status: 'failed' }),
      resolveGitHubEvidence: async () => ({
        status: 'FAILED',
        marker,
        branch: marker.branch,
        commitSha: marker.commitSha,
        pullRequestUrl: null,
        changedFiles: [],
        checks: [],
        reportedChecks: [],
        verifiedChecks: [],
        errors: [],
        evidence: [
          { type: 'BRANCH', reference: marker.branch, verified: true, details: {} },
          { type: 'COMMIT', reference: marker.commitSha, verified: true, details: {} },
        ],
        reasonCode: 'EVIDENCE_VERIFIED',
        checkedAt: '2026-07-14T10:00:00.000Z',
      }),
      logEvent: () => {},
      now: () => Date.parse('2026-07-14T10:05:00.000Z'),
    })

    const outcome = await reconcileCursorAutomationResult({ runId: RUN_ID, pollIntervalMs: 0 }, deps)
    assert.equal(outcome.ok, true)
    if (outcome.ok) assert.equal(outcome.status, 'FAILED')
  })

  it('31. invalid evidence never → SUCCEEDED', async () => {
    const marker = baseMarker()
    const snapshot = verifiedSnapshot(marker)
    snapshot.commitExists = false
    const result = await resolveGitHubExecutionEvidence(resolveInput(), {
      transport: createMockTransport(snapshot),
      config: { mode: 'gh_cli', repositoryAllowlist: [], maxBranches: 20, branchPrefix: 'cursor/', clockSkewMs: 300_000 },
    })
    assert.equal(result.status, 'INVALID')
    assert.notEqual(result.status, 'FOUND')
  })

  it('32. secret redaction', () => {
    const redacted = redactGitHubSecret('Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890')
    assert.equal(redacted.includes('ghp_'), false)
    assert.ok(redacted.includes('REDACTED'))
  })
})
