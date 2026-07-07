/**
 * Cursor Automation Workflow V1 — типы (097C + 099A submit + 099C result integration).
 * Без реального Cursor API. MAX (Ollama) → plan → Owner Approval → mock handoff/PR.
 */

import type { WorkerLoopToolBranchSnapshot } from '../toolRegistry/toolRegistryWorkerLoopBridge'
import type { CursorResultIntegrationBundle } from './cursorAutomationResultIntegration'
import type { CursorAutomationSubmitRun } from './cursorAutomationSubmitRun'

export const CURSOR_AUTOMATION_TOOL_REGISTRY_ID = 'cursor-automation' as const

export const CURSOR_AUTOMATION_WORKFLOW_VERSION = 'v1-mock' as const

export const CURSOR_AUTOMATION_WORKFLOW_PHASES = [
  'owner_task',
  'decision_plan',
  'model_selection',
  'max_ollama_analysis',
  'external_executor_decision',
  'automation_plan',
  'owner_approval',
  'handoff_prepared',
  'cursor_automation_mock',
  'mock_pr_ingested',
  'max_acceptance',
  'runtime_report',
  'memory_evolution',
  'knowledge_candidate',
] as const

export type CursorAutomationWorkflowPhase = (typeof CURSOR_AUTOMATION_WORKFLOW_PHASES)[number]

export type CursorAutomationWorkflowStatus =
  | 'not_applicable'
  | 'analyzing'
  | 'external_executor_required'
  | 'plan_ready'
  | 'awaiting_owner_approval'
  | 'waiting_for_owner_approval'
  | 'ready_for_cursor_automation'
  | 'rejected'
  | 'handoff_ready'
  | 'submitted_mock'
  | 'submitted_pending_real_adapter'
  | 'waiting_for_result'
  | 'submit_failed'
  | 'mock_submitted'
  | 'mock_result_ready'
  | 'accepted'
  | 'completed'

export type CursorAutomationPlan = {
  goal: string
  repository: string
  repositoryPath: string
  baseBranch: string
  workingBranch: string
  fileScope: string[]
  forbidden: string[]
  requiredChecks: string[]
  reportFormat: string[]
  mustNotDo: string[]
  expectedPullRequest: {
    title: string
    descriptionOutline: string[]
    targetBranch: string
  }
  cursorRulesRefs: string[]
}

export type CursorAutomationHandoff = {
  handoffId: string
  version: typeof CURSOR_AUTOMATION_WORKFLOW_VERSION
  employeeId: string
  runtimeRunId: string | null
  maxWorkerLoopId: string | null
  promptMarkdown: string
  plan: CursorAutomationPlan
  createdAt: string
  /** V1: mock — не отправлено в Cursor API. */
  deliveryMode: 'mock_v1'
}

export type CursorAutomationExpectedResult = {
  pullRequest: {
    title: string
    url: string
    branch: string
    baseBranch: string
    state: 'open' | 'draft' | 'merged'
  }
  report: {
    summary: string
    sections: string[]
    buildStatus: 'unknown' | 'passed' | 'failed'
    checksRun: string[]
  }
  artifacts: {
    changedFiles: string[]
    commitMessageHint: string
  }
}

export type CursorAutomationMockIngestion = {
  ingestedAt: string
  source: 'mock_v1'
  ok: boolean
  result: CursorAutomationExpectedResult
  notes: string[]
}

export type CursorAutomationWorkflowLogEntry = {
  at: string
  phase: CursorAutomationWorkflowPhase
  level: 'info' | 'warn'
  message: string
}

export type CursorAutomationWorkflowSnapshot = {
  version: typeof CURSOR_AUTOMATION_WORKFLOW_VERSION
  status: CursorAutomationWorkflowStatus
  externalExecutorRequired: boolean
  needReason: string | null
  suggestedToolId: typeof CURSOR_AUTOMATION_TOOL_REGISTRY_ID | null
  plan: CursorAutomationPlan | null
  handoff: CursorAutomationHandoff | null
  expectedResult: CursorAutomationExpectedResult | null
  mockIngestion: CursorAutomationMockIngestion | null
  ownerApprovalRequired: boolean
  ownerApprovalStatus: 'none' | 'pending' | 'approved' | 'rejected'
  /** Submit run после Owner Approval (099A). */
  submitRun: CursorAutomationSubmitRun | null
  /** Cursor result → Report / Memory / Knowledge / History (099C). */
  resultIntegration: CursorResultIntegrationBundle | null
  /** Tool Branch Snapshot для UI — display-only в V1 safe mode. */
  toolBranch: WorkerLoopToolBranchSnapshot | null
  workflowLog: CursorAutomationWorkflowLogEntry[]
}
