import type { DecisionPlan } from '../decisionPlan'
import type { RuntimeFailureDiagnostics } from '../runtime/runtimeFailureDiagnostics'
import type { MaxWorkerLoopPeerConsultationSnapshot } from './maxWorkerLoopPeerConsultation'

/** MAX Worker Loop — core types and phase model (V1 safe scaffold). */

export const MAX_WORKER_EMPLOYEE_ID = 'ag-max' as const

export const MAX_WORKER_LOOP_VERSION = 'v1-safe' as const

/** Phases mirror the target Owner → MAX → Report cycle. Tool branch is V2. */
export const MAX_WORKER_LOOP_PHASES = [
  'owner_task',
  'decision_plan',
  'consult_peer',
  'model_selection',
  'max_intake',
  'ollama_reasoning',
  'analysis',
  'plan',
  'tool_need_check',
  'owner_approval',
  'tool_registry',
  'verification',
  'runtime_report',
  'memory_evolution_draft',
  'knowledge_candidate_draft',
  'next_actions',
] as const

export type MaxWorkerLoopPhase = (typeof MAX_WORKER_LOOP_PHASES)[number]

export const MAX_WORKER_LOOP_STATUSES = [
  'draft',
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const

export type MaxWorkerLoopStatus = (typeof MAX_WORKER_LOOP_STATUSES)[number]

/** Russian labels for UI / logs — V1 domain copy, not i18n layer yet. */
export const MAX_WORKER_LOOP_PHASE_LABELS_RU: Record<MaxWorkerLoopPhase, string> = {
  owner_task: 'Задача Owner',
  decision_plan: 'Decision Plan (Brain)',
  consult_peer: 'Консультация с коллегой',
  model_selection: 'Выбор модели',
  max_intake: 'Приём MAX',
  ollama_reasoning: 'Reasoning (Local Ollama)',
  analysis: 'Анализ',
  plan: 'План',
  tool_need_check: 'Нужен инструмент?',
  owner_approval: 'Одобрение Owner',
  tool_registry: 'Реестр инструментов',
  verification: 'Верификация',
  runtime_report: 'Runtime Report',
  memory_evolution_draft: 'Черновик Memory Evolution',
  knowledge_candidate_draft: 'Черновик Knowledge Candidate',
  next_actions: 'Следующие действия',
}

export const MAX_WORKER_LOOP_STATUS_LABELS_RU: Record<MaxWorkerLoopStatus, string> = {
  draft: 'Черновик',
  queued: 'В очереди',
  running: 'Выполняется',
  waiting_approval: 'Ожидает одобрения Owner',
  completed: 'Завершён',
  failed: 'Ошибка',
  cancelled: 'Отменён',
}

/** V1 phases that run in the safe path (no tools). */
export const MAX_WORKER_LOOP_SAFE_PHASES: MaxWorkerLoopPhase[] = [
  'owner_task',
  'decision_plan',
  'consult_peer',
  'model_selection',
  'max_intake',
  'ollama_reasoning',
  'analysis',
  'plan',
  'tool_need_check',
  'runtime_report',
  'memory_evolution_draft',
  'knowledge_candidate_draft',
  'next_actions',
]

export type MaxWorkerLoopInput = {
  taskText: string
  title?: string
  projectId: string
  workspaceId: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  expectedOutput?: string
  constraints?: string
  /** Default: technical_audit for MAX coding audits. */
  mode?: 'technical_audit' | 'handoff_preparation' | 'documentation'
  modelMode?: 'coding' | 'deep' | 'fast'
  /** AI-COMPANY-098C — first autonomous demo scenario id. */
  autonomousDemoScenarioId?: string | null
}

export type MaxWorkerLoopPhaseProgress = {
  phase: MaxWorkerLoopPhase
  status: 'pending' | 'active' | 'done' | 'skipped' | 'failed'
  detail?: string
  completedAt?: string
}

export type MaxWorkerLoopRecord = {
  id: string
  version: typeof MAX_WORKER_LOOP_VERSION
  employeeId: string
  status: MaxWorkerLoopStatus
  currentPhase: MaxWorkerLoopPhase
  phases: MaxWorkerLoopPhaseProgress[]
  input: MaxWorkerLoopInput
  deliveryTaskId: string | null
  runtimeRunId: string | null
  reportId: string | null
  taskRunnerRecordId: string | null
  /** Employee Brain Decision Plan — persisted on loop record (102B). */
  decisionPlan: DecisionPlan | null
  /** Peer consult snapshot — Decision Plan → Employee Conversation bridge (102C). */
  peerConsultation: MaxWorkerLoopPeerConsultationSnapshot | null
  safeMode: true
  autonomousDemoScenarioId: string | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  errorMessage: string | null
  failureDiagnostics: RuntimeFailureDiagnostics | null
}
