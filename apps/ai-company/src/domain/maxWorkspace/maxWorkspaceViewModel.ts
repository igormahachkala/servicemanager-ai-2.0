/**
 * MAX Employee Workspace — view model (AI-COMPANY-100A).
 * Только реальные данные из Worker Loop / Runtime / snapshot. Без fake progress.
 */

import type { RuntimeRun } from '../runtime/runtimeRun'
import type { RuntimeProfile } from '../runtime/runtimeStorage'
import { getModelById } from '../runtime/runtimeStorage'
import type { MaxWorkerLoopPanelView } from '../maxWorkerLoop/maxWorkerLoopViewModel'
import {
  MAX_WORKER_LOOP_PHASE_LABELS_RU,
  MAX_WORKER_LOOP_STATUS_LABELS_RU,
  type MaxWorkerLoopRecord,
} from '../maxWorkerLoop/maxWorkerLoop'
import type { MaxWorkerLoopSnapshot } from '../maxWorkerLoop/maxWorkerLoopEngine'
import type {
  KnowledgeCandidateDraft,
  MaxWorkerLoopNextAction,
  MemoryEvolutionDraft,
} from '../maxWorkerLoop/maxWorkerLoopDrafts'

const CURSOR_AUTOMATION_STATUS_LABELS_RU: Record<string, string> = {
  not_applicable: 'Не требуется',
  analyzing: 'Анализ',
  external_executor_required: 'Нужен внешний исполнитель',
  plan_ready: 'План готов',
  awaiting_owner_approval: 'Ожидание Owner',
  waiting_for_owner_approval: 'Waiting for Owner Approval',
  ready_for_cursor_automation: 'Ready for Cursor Automation',
  rejected: 'Отклонено Owner',
  handoff_ready: 'Handoff готов',
  submitted_mock: 'Отправлено (mock stub)',
  submitted_pending_real_adapter: 'Отправлено — ожидает adapter',
  waiting_for_result: 'Ожидание результата',
  submit_failed: 'Ошибка отправки',
  mock_submitted: 'Mock отправлен',
  mock_result_ready: 'Mock результат',
  accepted: 'Принято MAX',
  completed: 'Завершено',
}

const OWNER_APPROVAL_LABELS_RU: Record<string, string> = {
  none: 'Не требуется',
  pending: 'Ожидает решения Owner',
  approved: 'Одобрено Owner',
  rejected: 'Отклонено Owner',
}

export type MaxWorkspaceTaskView = {
  title: string
  taskText: string
  startedAt: string | null
  loopId: string
}

export type MaxWorkspaceWorkStatusView = {
  status: MaxWorkerLoopRecord['status']
  statusLabel: string
  errorMessage: string | null
  isActive: boolean
}

export type MaxWorkspaceModelView = {
  displayName: string
  modelId: string | null
  ollamaTag: string | null
  providerId: string | null
  durationMs: number | null
}

export type MaxWorkspacePhaseView = {
  domainPhase: MaxWorkerLoopRecord['currentPhase']
  domainPhaseLabel: string
  uiStepLabel: string | null
  uiStepStatus: string | null
}

export type MaxWorkspaceExternalExecutorView = {
  required: boolean
  reason: string | null
  toolId: string | null
}

export type MaxWorkspaceOwnerApprovalView = {
  required: boolean
  status: string
  statusLabel: string
}

export type MaxWorkspaceCursorAutomationView = {
  status: string
  statusLabel: string
  submitRunId: string | null
  hasResultIntegration: boolean
}

export type MaxWorkspaceReportView = {
  id: string
  title: string
  summary: string
  updatedAt: string
}

export type MaxWorkspaceMemoryDraftView = {
  id: string
  title: string
  category: string
  preview: string
}

export type MaxWorkspaceKnowledgeCandidateView = {
  id: string
  title: string
  summary: string
}

export type MaxWorkspaceNextActionView = {
  id: string
  label: string
  priority: string
  kind: string
}

export type MaxWorkspaceView = {
  hasWork: boolean
  task: MaxWorkspaceTaskView | null
  workStatus: MaxWorkspaceWorkStatusView | null
  thinkingModel: MaxWorkspaceModelView | null
  workerLoopPhase: MaxWorkspacePhaseView | null
  externalExecutor: MaxWorkspaceExternalExecutorView | null
  ownerApproval: MaxWorkspaceOwnerApprovalView | null
  cursorAutomation: MaxWorkspaceCursorAutomationView | null
  lastReport: MaxWorkspaceReportView | null
  memoryDrafts: MaxWorkspaceMemoryDraftView[]
  knowledgeCandidates: MaxWorkspaceKnowledgeCandidateView[]
  nextActions: MaxWorkspaceNextActionView[]
  runtimeRunId: string | null
  reportId: string | null
}

function mapMemoryDrafts(draft: MemoryEvolutionDraft | null): MaxWorkspaceMemoryDraftView[] {
  if (!draft || draft.lessons.length === 0) return []
  return draft.lessons.map((lesson, index) => ({
    id: `${draft.runId}-lesson-${index}`,
    title: lesson.title,
    category: lesson.category,
    preview: lesson.content.slice(0, 160),
  }))
}

function mapKnowledgeCandidates(items: KnowledgeCandidateDraft[]): MaxWorkspaceKnowledgeCandidateView[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary.slice(0, 200),
  }))
}

function mapNextActions(items: MaxWorkerLoopNextAction[]): MaxWorkspaceNextActionView[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    priority: item.priority,
    kind: item.kind,
  }))
}

function resolveThinkingModel(input: {
  snapshot: MaxWorkerLoopSnapshot | null
  runtimeRun: RuntimeRun | null
  profile: RuntimeProfile
}): MaxWorkspaceModelView | null {
  const reasoning = input.snapshot?.reasoning
  const modelId = reasoning?.modelId ?? input.runtimeRun?.modelId ?? input.profile.primaryModelId
  const catalog = modelId ? getModelById(modelId) : null

  if (!modelId && !reasoning?.ollamaModelTag) return null

  return {
    displayName: catalog?.name ?? modelId ?? '—',
    modelId,
    ollamaTag: reasoning?.ollamaModelTag ?? input.runtimeRun?.result?.resolvedOllamaTag ?? null,
    providerId: reasoning?.providerId ?? input.runtimeRun?.providerId ?? null,
    durationMs: reasoning?.durationMs ?? null,
  }
}

export function buildMaxWorkspaceView(input: {
  loop: MaxWorkerLoopRecord | null
  snapshot: MaxWorkerLoopSnapshot | null
  runtimeRun: RuntimeRun | null
  profile: RuntimeProfile
  panelView: MaxWorkerLoopPanelView | null
}): MaxWorkspaceView {
  const { loop, snapshot, runtimeRun, profile, panelView } = input

  if (!loop) {
    return {
      hasWork: false,
      task: null,
      workStatus: null,
      thinkingModel: resolveThinkingModel({ snapshot: null, runtimeRun: null, profile }),
      workerLoopPhase: null,
      externalExecutor: null,
      ownerApproval: null,
      cursorAutomation: null,
      lastReport: null,
      memoryDrafts: [],
      knowledgeCandidates: [],
      nextActions: [],
      runtimeRunId: null,
      reportId: null,
    }
  }

  const cursor = snapshot?.cursorAutomation ?? null
  const currentUiStep = panelView?.steps.find((step) => step.id === panelView.currentStepId) ?? null

  const lastReport: MaxWorkspaceReportView | null = snapshot?.report
    ? {
        id: snapshot.report.reportId,
        title: snapshot.report.title,
        summary: snapshot.report.summary.slice(0, 280),
        updatedAt: snapshot.report.createdAt,
      }
    : loop.reportId
      ? {
          id: loop.reportId,
          title: 'Runtime Report',
          summary: 'Отчёт связан с циклом — откройте для полного содержимого.',
          updatedAt: loop.updatedAt,
        }
      : null

  return {
    hasWork: true,
    task: {
      title: loop.input.title?.trim() || 'Задача Owner',
      taskText: loop.input.taskText,
      startedAt: loop.createdAt,
      loopId: loop.id,
    },
    workStatus: {
      status: loop.status,
      statusLabel: MAX_WORKER_LOOP_STATUS_LABELS_RU[loop.status],
      errorMessage: loop.errorMessage,
      isActive: loop.status === 'running' || loop.status === 'queued',
    },
    thinkingModel: resolveThinkingModel({ snapshot, runtimeRun, profile }),
    workerLoopPhase: {
      domainPhase: loop.currentPhase,
      domainPhaseLabel: MAX_WORKER_LOOP_PHASE_LABELS_RU[loop.currentPhase],
      uiStepLabel: currentUiStep?.label ?? null,
      uiStepStatus: currentUiStep?.status ?? null,
    },
    externalExecutor: cursor
      ? {
          required: cursor.externalExecutorRequired,
          reason: cursor.needReason,
          toolId: cursor.suggestedToolId,
        }
      : { required: false, reason: null, toolId: null },
    ownerApproval: cursor
      ? {
          required: cursor.ownerApprovalRequired,
          status: cursor.ownerApprovalStatus,
          statusLabel: OWNER_APPROVAL_LABELS_RU[cursor.ownerApprovalStatus] ?? cursor.ownerApprovalStatus,
        }
      : { required: false, status: 'none', statusLabel: OWNER_APPROVAL_LABELS_RU.none },
    cursorAutomation: cursor?.externalExecutorRequired
      ? {
          status: cursor.status,
          statusLabel: CURSOR_AUTOMATION_STATUS_LABELS_RU[cursor.status] ?? cursor.status,
          submitRunId: cursor.submitRun?.runId ?? null,
          hasResultIntegration: Boolean(cursor.resultIntegration),
        }
      : null,
    lastReport,
    memoryDrafts: mapMemoryDrafts(snapshot?.memoryEvolutionDraft ?? null),
    knowledgeCandidates: mapKnowledgeCandidates(snapshot?.knowledgeCandidates ?? []),
    nextActions: mapNextActions(snapshot?.nextActions ?? []),
    runtimeRunId: loop.runtimeRunId,
    reportId: loop.reportId,
  }
}
