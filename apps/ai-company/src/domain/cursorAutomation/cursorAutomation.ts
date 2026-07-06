/**
 * Cursor Automation Tool — domain types (AI-COMPANY-097A).
 * Cursor is a Tool Registry entry, not a digital employee.
 * No real Cursor API calls in V1 — adapter placeholders only.
 */

import type { ToolRegistryV1ToolId } from '../toolRegistry/toolRegistry'

export const CURSOR_AUTOMATION_TOOL_ID = 'cursor-automation' as const satisfies ToolRegistryV1ToolId

export const CURSOR_AUTOMATION_RUN_STATUSES = [
  'draft',
  'planned',
  'approval_pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const

export type CursorAutomationRunStatus = (typeof CURSOR_AUTOMATION_RUN_STATUSES)[number]

export const CURSOR_AUTOMATION_TRIGGER_KINDS = [
  'manual',
  'runtime-handoff',
  'git',
  'schedule',
] as const

export type CursorAutomationTriggerKind = (typeof CURSOR_AUTOMATION_TRIGGER_KINDS)[number]

export type CursorAutomationTrigger =
  | {
      kind: 'manual'
      requestedBy: 'owner' | 'employee'
      note?: string
    }
  | {
      kind: 'runtime-handoff'
      runtimeRunId: string
      maxWorkerLoopId?: string | null
      employeeId: string
    }
  | {
      kind: 'git'
      event: 'push' | 'pull_request' | 'ci_completed'
      owner: string
      repo: string
      branch?: string
    }
  | {
      kind: 'schedule'
      cron: string
      timezone?: string
    }

/** Planned automation handoff from MAX / Atlas / Sentinel / Helm reasoning. */
export type CursorAutomationTask = {
  id: string
  title: string
  instructions: string
  trigger: CursorAutomationTrigger
  requestedByEmployeeId: string
  runtimeRunId: string | null
  maxWorkerLoopId: string | null
  projectId: string | null
  workspaceId: string | null
  repository: {
    owner: string
    repo: string
    branch: string
  }
  /** Tool ids enabled in the automation workflow (Cursor-side). */
  enabledTools: string[]
  status: CursorAutomationRunStatus
  requiresOwnerApproval: boolean
  toolRegistryV1Id: typeof CURSOR_AUTOMATION_TOOL_ID
  createdAt: string
  updatedAt: string
}

export type CursorAutomationPrSummary = {
  number: number | null
  url: string | null
  title: string
  changedFiles: number
  checksStatus: 'pending' | 'passing' | 'failing' | 'unknown'
  reviewRequested: boolean
}

/** Draft rule file derived from Knowledge — not written to disk in V1. */
export type CursorAutomationRuleCandidate = {
  id: string
  title: string
  summary: string
  proposedPath: string
  content: string
  sourceKnowledgeCandidateId: string | null
  status: 'draft'
}

export type CursorAutomationResult = {
  taskId: string
  status: CursorAutomationRunStatus
  prSummary: CursorAutomationPrSummary | null
  transcriptRef: string | null
  artifacts: string[]
  ruleCandidates: CursorAutomationRuleCandidate[]
  runtimeReportPatch: {
    section: 'tool_execution'
    summary: string
    toolRegistryV1Id: typeof CURSOR_AUTOMATION_TOOL_ID
  }
  memoryEvolutionHints: string[]
  finishedAt: string | null
  errorMessage: string | null
}

export type CursorAutomationPlanInput = {
  title: string
  instructions: string
  requestedByEmployeeId: string
  runtimeRunId?: string | null
  maxWorkerLoopId?: string | null
  projectId?: string | null
  workspaceId?: string | null
  repository?: Partial<CursorAutomationTask['repository']>
  trigger?: CursorAutomationTrigger
  enabledTools?: string[]
  requiresOwnerApproval?: boolean
}

export type CursorAutomationPromptContext = {
  employeeCodename: string
  taskTitle: string
  ownerGoal: string
  constraints: string[]
  expectedOutcome: string
  priorReportSummary?: string | null
}

export type CursorAutomationIngestInput = {
  task: CursorAutomationTask
  /** Raw payload from future Cursor Automations API — opaque in V1. */
  raw: unknown
}
