/**
 * Runtime Persistence V1 — сущности контракта (AI-COMPANY-098B).
 * Payload-типы — JSON-serializable, готовы к Prisma Json column / отдельным таблицам.
 */

import type {
  PersistenceRecordBase,
  RuntimePersistenceEntityKind,
} from './runtimePersistenceCommon'

// ─── RuntimeRun ─────────────────────────────────────────────────────────────

export const RUNTIME_RUN_PERSISTENCE_STATUSES = [
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const

export type RuntimeRunPersistenceStatus = (typeof RUNTIME_RUN_PERSISTENCE_STATUSES)[number]

export type RuntimeRunPersistencePayload = {
  employeeId: string
  runtimeProfileId: string
  modelId: string
  providerId: string
  taskId: string | null
  chatId: string | null
  pipelineStepCount: number
  resultSummary: string | null
  /** Полный RuntimeRun JSON — optional blob для replay/debug */
  runtimeSnapshot: Record<string, unknown> | null
}

export type RuntimeRunPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'runtime_run'
  status: RuntimeRunPersistenceStatus
  payload: RuntimeRunPersistencePayload
  /** reportId — denormalized quick link */
  reportId: string | null
}

// ─── WorkerLoop ─────────────────────────────────────────────────────────────

export const WORKER_LOOP_PERSISTENCE_STATUSES = [
  'draft',
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const

export type WorkerLoopPersistenceStatus = (typeof WORKER_LOOP_PERSISTENCE_STATUSES)[number]

export type WorkerLoopPhasePersistence = {
  phase: string
  status: 'pending' | 'active' | 'done' | 'skipped' | 'failed'
  detail: string | null
  completedAt: string | null
}

export type WorkerLoopPersistencePayload = {
  employeeId: string
  loopVersion: string
  safeMode: boolean
  currentPhase: string
  phases: WorkerLoopPhasePersistence[]
  input: {
    taskText: string
    title: string | null
    projectId: string
    mode: string | null
    modelMode: string | null
    priority: string | null
  }
  deliveryTaskId: string | null
  taskRunnerRecordId: string | null
  errorMessage: string | null
  cursorAutomationRequired: boolean | null
}

export type WorkerLoopPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'worker_loop'
  status: WorkerLoopPersistenceStatus
  payload: WorkerLoopPersistencePayload
  runtimeRunId: string | null
  reportId: string | null
}

// ─── ToolInvocation ─────────────────────────────────────────────────────────

export const TOOL_INVOCATION_PERSISTENCE_STATUSES = [
  'planned',
  'approval_pending',
  'submitted',
  'running',
  'completed',
  'failed',
  'cancelled',
  'blocked_v1',
] as const

export type ToolInvocationPersistenceStatus = (typeof TOOL_INVOCATION_PERSISTENCE_STATUSES)[number]

export type ToolInvocationPersistencePayload = {
  toolRegistryId: string
  toolName: string
  employeeId: string
  action: string
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  needSignal: 'reasoning' | 'policy' | 'capability' | 'manual'
  needReason: string | null
  requiresOwnerApproval: boolean
  approvalId: string | null
  executionLogPage: '/ops/tool-executions'
  errorMessage: string | null
}

export type ToolInvocationPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'tool_invocation'
  status: ToolInvocationPersistenceStatus
  payload: ToolInvocationPersistencePayload
  runtimeRunId: string | null
  workerLoopId: string | null
}

// ─── OwnerApproval ────────────────────────────────────────────────────────────

export const OWNER_APPROVAL_PERSISTENCE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'expired',
] as const

export type OwnerApprovalPersistenceStatus = (typeof OWNER_APPROVAL_PERSISTENCE_STATUSES)[number]

export type OwnerApprovalPersistencePayload = {
  title: string
  description: string
  employeeId: string
  actionType: string
  priority: string
  policyRule: string
  /** Что одобряется — tool, cursor handoff, memory publish, … */
  subjectKind:
    | 'tool_invocation'
    | 'cursor_automation_run'
    | 'memory_draft'
    | 'knowledge_draft'
    | 'generic'
  subjectId: string | null
  decidedBy: PersistenceRecordBase['owner'] | null
  decidedAt: string | null
  decisionNote: string | null
}

export type OwnerApprovalPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'owner_approval'
  status: OwnerApprovalPersistenceStatus
  payload: OwnerApprovalPersistencePayload
}

// ─── MemoryDraft ──────────────────────────────────────────────────────────────

export const MEMORY_DRAFT_PERSISTENCE_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'published',
  'rejected',
  'superseded',
] as const

export type MemoryDraftPersistenceStatus = (typeof MEMORY_DRAFT_PERSISTENCE_STATUSES)[number]

export type MemoryDraftLessonPersistence = {
  id: string
  category: 'finding' | 'mistake' | 'improvement' | 'knowledge'
  title: string
  content: string
}

export type MemoryDraftPersistencePayload = {
  employeeId: string
  lessons: MemoryDraftLessonPersistence[]
  estimatedExperiencePoints: number
  source: 'max_worker_loop' | 'runtime_completion' | 'manual'
  note: string | null
  /** После publish — id MemoryEvolutionRecord / MemoryEntry */
  publishedEvolutionId: string | null
  publishedMemoryEntryIds: string[]
}

export type MemoryDraftPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'memory_draft'
  status: MemoryDraftPersistenceStatus
  payload: MemoryDraftPersistencePayload
  runtimeRunId: string
  reportId: string
  workerLoopId: string | null
  ownerApprovalId: string | null
}

// ─── KnowledgeDraft ───────────────────────────────────────────────────────────

export const KNOWLEDGE_DRAFT_PERSISTENCE_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'published',
  'rejected',
  'archived',
] as const

export type KnowledgeDraftPersistenceStatus = (typeof KNOWLEDGE_DRAFT_PERSISTENCE_STATUSES)[number]

export type KnowledgeDraftPersistencePayload = {
  title: string
  summary: string
  content: string
  type: 'documentation' | 'best_practice' | 'runbook' | 'policy'
  source: 'max_worker_loop' | 'memory_evolution' | 'cursor_automation' | 'manual'
  tags: string[]
  ownerEmployeeId: string
  lessonCategory: string | null
  /** После publish — id Knowledge item */
  publishedKnowledgeId: string | null
}

export type KnowledgeDraftPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'knowledge_draft'
  status: KnowledgeDraftPersistenceStatus
  payload: KnowledgeDraftPersistencePayload
  runtimeRunId: string
  memoryDraftId: string | null
  workerLoopId: string | null
  ownerApprovalId: string | null
}

// ─── CursorAutomationRun ──────────────────────────────────────────────────────

export const CURSOR_AUTOMATION_RUN_PERSISTENCE_STATUSES = [
  'draft',
  'planned',
  'approval_pending',
  'handoff_ready',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const

export type CursorAutomationRunPersistenceStatus =
  (typeof CURSOR_AUTOMATION_RUN_PERSISTENCE_STATUSES)[number]

export type CursorAutomationRunPersistencePayload = {
  title: string
  instructions: string
  triggerKind: string
  requestedByEmployeeId: string
  repository: {
    owner: string
    repo: string
    branch: string
  }
  enabledTools: string[]
  toolRegistryV1Id: 'cursor-automation'
  requiresOwnerApproval: boolean
  handoffId: string | null
  promptMarkdown: string | null
  deliveryMode: 'mock_v1' | 'cursor_api'
  prUrl: string | null
  prTitle: string | null
  buildStatus: 'unknown' | 'passed' | 'failed' | null
  errorMessage: string | null
}

export type CursorAutomationRunPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'cursor_automation_run'
  status: CursorAutomationRunPersistenceStatus
  payload: CursorAutomationRunPersistencePayload
  runtimeRunId: string | null
  workerLoopId: string | null
  toolInvocationId: string | null
  ownerApprovalId: string | null
}

// ─── Report ───────────────────────────────────────────────────────────────────

export const REPORT_PERSISTENCE_STATUSES = ['draft', 'published', 'archived'] as const

export type ReportPersistenceStatus = (typeof REPORT_PERSISTENCE_STATUSES)[number]

export type ReportPersistencePayload = {
  title: string
  type: string
  summary: string
  findings: string[]
  risks: string[]
  recommendations: string[]
  evidenceCount: number
  employeeId: string | null
  /** Structured Senior Engineer body — optional JSON blob */
  runtimeBody: Record<string, unknown> | null
}

export type ReportPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'report'
  status: ReportPersistenceStatus
  payload: ReportPersistencePayload
  runtimeRunId: string | null
  workerLoopId: string | null
}

// ─── HistoryEvent ─────────────────────────────────────────────────────────────

export const HISTORY_EVENT_PERSISTENCE_KINDS = [
  'runtime_started',
  'runtime_completed',
  'runtime_failed',
  'worker_loop_phase',
  'tool_invoked',
  'approval_requested',
  'approval_decided',
  'report_created',
  'memory_draft_created',
  'knowledge_draft_created',
  'cursor_automation_submitted',
  'cursor_automation_completed',
  'audit',
] as const

export type HistoryEventPersistenceKind = (typeof HISTORY_EVENT_PERSISTENCE_KINDS)[number]

export type HistoryEventPersistencePayload = {
  kind: HistoryEventPersistenceKind
  label: string
  detail: string | null
  severity: 'info' | 'success' | 'warn' | 'error'
  employeeId: string | null
  metadata: Record<string, string | number | boolean | null>
  /** Idempotency key — dedupe при replay webhook / retry */
  idempotencyKey: string | null
}

export type HistoryEventPersistenceRecord = PersistenceRecordBase & {
  entityKind: 'history_event'
  /** History events are append-only — status always 'recorded' */
  status: 'recorded'
  payload: HistoryEventPersistencePayload
  /** Primary subject this event narrates */
  subjectRef: { entity: RuntimePersistenceEntityKind; id: string } | null
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type RuntimePersistenceRecord =
  | RuntimeRunPersistenceRecord
  | WorkerLoopPersistenceRecord
  | ToolInvocationPersistenceRecord
  | OwnerApprovalPersistenceRecord
  | MemoryDraftPersistenceRecord
  | KnowledgeDraftPersistenceRecord
  | CursorAutomationRunPersistenceRecord
  | ReportPersistenceRecord
  | HistoryEventPersistenceRecord
