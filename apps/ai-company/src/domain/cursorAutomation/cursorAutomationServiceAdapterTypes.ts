/**
 * Cursor Automation Service Adapter — types & contract (AI-COMPANY-099B).
 *
 * Интерфейс для замены mock submit на реальный Cursor API.
 * НЕ подключено к Runtime orchestrator. Без credentials, без HTTP.
 *
 * @see docs/ai-company/AI-COMPANY-099B-cursor-automation-adapter-v1.md
 */

import type { KnowledgeCandidateDraft } from '../maxWorkerLoop/maxWorkerLoopDrafts'
import type {
  CursorAutomationPrSummary,
  CursorAutomationResult,
  CursorAutomationRuleCandidate,
  CursorAutomationTask,
} from './cursorAutomation'
import type { CursorAutomationHandoff } from './cursorAutomationTypes'

export const CURSOR_AUTOMATION_ADAPTER_CONTRACT_VERSION = 'v1' as const

export const CURSOR_AUTOMATION_ADAPTER_KINDS = ['mock_v1', 'cursor_api_v1'] as const

export type CursorAutomationServiceAdapterKind = (typeof CURSOR_AUTOMATION_ADAPTER_KINDS)[number]

/** Статусы adapter run — единый lifecycle для mock и real API. */
export const CURSOR_AUTOMATION_ADAPTER_RUN_STATUSES = [
  'draft',
  'ready_to_submit',
  'submitted',
  'running',
  'pr_opened',
  'completed',
  'failed',
  'cancelled',
] as const

export type CursorAutomationAdapterRunStatus = (typeof CURSOR_AUTOMATION_ADAPTER_RUN_STATUSES)[number]

export type CursorAutomationAdapterRunRecord = {
  adapterRunId: string
  localTaskId: string
  companyId: string
  workspaceId: string | null
  maxWorkerLoopId: string | null
  runtimeRunId: string | null
  handoffId: string | null
  ownerApprovalId: string | null
  status: CursorAutomationAdapterRunStatus
  promptMarkdown: string
  /** External Cursor automation / agent run id (null in mock until submit). */
  externalRunId: string | null
  prUrl: string | null
  prTitle: string | null
  prNumber: number | null
  buildStatus: 'unknown' | 'pending' | 'passing' | 'failing'
  pollCount: number
  submittedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type CursorAutomationSubmitInput = {
  companyId: string
  workspaceId: string | null
  task: CursorAutomationTask
  handoff: CursorAutomationHandoff | null
  promptMarkdown: string
  ownerApprovalId: string | null
  /** Owner gate must be approved before submit in production. */
  ownerApprovalStatus: 'none' | 'pending' | 'approved' | 'rejected'
}

export type CursorAutomationAdapterSubmitResult = {
  ok: boolean
  adapterRunId: string | null
  localTaskId: string
  status: CursorAutomationAdapterRunStatus
  externalRunId: string | null
  error: string | null
}

export type CursorAutomationStatusResult = {
  adapterRunId: string
  localTaskId: string
  status: CursorAutomationAdapterRunStatus
  externalRunId: string | null
  prSummary: CursorAutomationPrSummary | null
  buildStatus: CursorAutomationAdapterRunRecord['buildStatus']
  updatedAt: string
  error: string | null
}

export type CursorAutomationCancelResult = {
  ok: boolean
  adapterRunId: string
  status: CursorAutomationAdapterRunStatus
  error: string | null
}

export type CursorAutomationIngestAdapterInput = {
  adapterRunId: string
  task: CursorAutomationTask
  /** Raw webhook / poll payload from Cursor API — opaque. Mock uses stored run state. */
  raw: unknown
  knowledgeCandidates?: KnowledgeCandidateDraft[]
}

export type CursorAutomationIngestAdapterResult = {
  ok: boolean
  adapterRunId: string
  status: CursorAutomationAdapterRunStatus
  normalized: CursorAutomationResult | null
  error: string | null
}

export type CursorAutomationRuntimeReportPatch = CursorAutomationResult['runtimeReportPatch']

export type CursorAutomationRawPrPayload = {
  number?: number | null
  url?: string | null
  title?: string | null
  changedFiles?: number | null
  checksStatus?: 'pending' | 'passing' | 'failing' | 'unknown' | null
  reviewRequested?: boolean | null
}

export type CursorAutomationRawResultPayload = {
  prSummary?: CursorAutomationRawPrPayload | null
  pullRequest?: CursorAutomationRawPrPayload | null
  transcriptRef?: string | null
  artifacts?: unknown
  error?: string | null
  buildStatus?: CursorAutomationAdapterRunRecord['buildStatus'] | null
}

/**
 * Service adapter contract — mock_v1 today, cursor_api_v1 later.
 * Mapper methods are pure; safe to call without side effects.
 */
export type CursorAutomationServiceAdapter = {
  readonly adapterKind: CursorAutomationServiceAdapterKind
  readonly contractVersion: typeof CURSOR_AUTOMATION_ADAPTER_CONTRACT_VERSION

  submitAutomationTask(input: CursorAutomationSubmitInput): Promise<CursorAutomationAdapterSubmitResult>
  getAutomationStatus(adapterRunId: string): Promise<CursorAutomationStatusResult | null>
  cancelAutomationRun(adapterRunId: string): Promise<CursorAutomationCancelResult>
  ingestAutomationResult(input: CursorAutomationIngestAdapterInput): Promise<CursorAutomationIngestAdapterResult>

  mapPrToRuntimeReportPatch(
    task: CursorAutomationTask,
    pr: CursorAutomationPrSummary | null,
  ): CursorAutomationRuntimeReportPatch

  mapResultToMemoryEvolutionHints(
    task: CursorAutomationTask,
    pr: CursorAutomationPrSummary | null,
  ): string[]

  mapResultToCursorRulesCandidates(
    knowledgeCandidates: KnowledgeCandidateDraft[],
  ): CursorAutomationRuleCandidate[]
}

export function isTerminalAdapterRunStatus(status: CursorAutomationAdapterRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function canSubmitAdapterRun(status: CursorAutomationAdapterRunStatus): boolean {
  return status === 'draft' || status === 'ready_to_submit'
}

export function canCancelAdapterRun(status: CursorAutomationAdapterRunStatus): boolean {
  return status === 'submitted' || status === 'running' || status === 'pr_opened'
}

/** Map adapter status → Runtime Persistence V1 cursor_automation_run status hint. */
export function mapAdapterStatusToPersistenceHint(
  status: CursorAutomationAdapterRunStatus,
): string {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'ready_to_submit':
      return 'handoff_ready'
    case 'submitted':
      return 'queued'
    case 'running':
      return 'running'
    case 'pr_opened':
      return 'running'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
  }
}
