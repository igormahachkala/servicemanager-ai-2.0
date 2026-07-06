/**
 * Cursor Automation — mock ingestion результата (AI-COMPANY-097C).
 */

import type { MaxWorkerLoopRecord } from '../maxWorkerLoop/maxWorkerLoop'
import type {
  CursorAutomationExpectedResult,
  CursorAutomationHandoff,
  CursorAutomationMockIngestion,
  CursorAutomationPlan,
} from './cursorAutomationTypes'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export function buildCursorAutomationExpectedResult(
  plan: CursorAutomationPlan,
): CursorAutomationExpectedResult {
  const branchSlug = slugify(plan.workingBranch || 'ai-company-flow')

  return {
    pullRequest: {
      title: plan.expectedPullRequest.title,
      url: `https://github.com/example/${plan.repository}/pull/mock-${branchSlug}`,
      branch: plan.workingBranch,
      baseBranch: plan.expectedPullRequest.targetBranch,
      state: 'draft',
    },
    report: {
      summary: `[MOCK] Cursor Automation выполнил задачу: ${plan.goal.slice(0, 120)}`,
      sections: plan.reportFormat,
      buildStatus: 'passed',
      checksRun: plan.requiredChecks,
    },
    artifacts: {
      changedFiles: plan.fileScope.slice(0, 3).map((scope) => scope.replace('/**', '/…')),
      commitMessageHint: plan.expectedPullRequest.title,
    },
  }
}

export function ingestCursorAutomationMockResult(input: {
  handoff: CursorAutomationHandoff
  loop: MaxWorkerLoopRecord
}): CursorAutomationMockIngestion {
  const result = buildCursorAutomationExpectedResult(input.handoff.plan)

  return {
    ingestedAt: new Date().toISOString(),
    source: 'mock_v1',
    ok: true,
    result,
    notes: [
      'Mock ingestion V1: PR URL и build status симулированы.',
      `Handoff ${input.handoff.handoffId} не отправлялся в Cursor API.`,
      `MAX Worker Loop ${input.loop.id} — результат принят для Runtime Report / Memory Evolution (draft).`,
    ],
  }
}
