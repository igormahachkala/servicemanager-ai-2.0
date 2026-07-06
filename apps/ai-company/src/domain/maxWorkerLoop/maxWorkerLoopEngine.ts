import { getReportById } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { getRuntimeRunById } from '../runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../runtime/runtimeRun'
import { startTaskRunner } from '../taskRunner/taskRunner'
import { defaultExpectedOutput } from '../taskRunner/taskRunnerTemplates'
import { buildCursorAutomationWorkflowSnapshot } from '../cursorAutomation/cursorAutomationWorkflow'
import type { CursorAutomationWorkflowSnapshot } from '../cursorAutomation/cursorAutomationTypes'
import {
  buildKnowledgeCandidateDrafts,
  buildMaxWorkerLoopNextActions,
  buildMemoryEvolutionDraft,
  type KnowledgeCandidateDraft,
  type MaxWorkerLoopNextAction,
  type MemoryEvolutionDraft,
} from './maxWorkerLoopDrafts'
import type { MaxWorkerLoopInput, MaxWorkerLoopRecord } from './maxWorkerLoop'
import { MAX_WORKER_EMPLOYEE_ID } from './maxWorkerLoop'
import { buildMaxWorkerLoopReasoningResult, type MaxWorkerLoopReasoningResult } from './maxWorkerLoopReasoning'
import { buildMaxWorkerLoopReport, type MaxWorkerLoopReport } from './maxWorkerLoopReport'
import {
  createMaxWorkerLoopRecord,
  updateMaxWorkerLoopPhase,
  upsertMaxWorkerLoopRecord,
} from './maxWorkerLoopStorage'
import type { OwnerApprovalGate } from './maxWorkerLoopApproval'
import { resolveOwnerApprovalGate } from './maxWorkerLoopApproval'

export type MaxWorkerLoopSnapshot = {
  loop: MaxWorkerLoopRecord
  reasoning: MaxWorkerLoopReasoningResult
  report: MaxWorkerLoopReport
  memoryEvolutionDraft: MemoryEvolutionDraft
  knowledgeCandidates: KnowledgeCandidateDraft[]
  nextActions: MaxWorkerLoopNextAction[]
  ownerApproval: OwnerApprovalGate
  cursorAutomation: CursorAutomationWorkflowSnapshot
}

function markRunningPhases(record: MaxWorkerLoopRecord): MaxWorkerLoopRecord {
  let next = updateMaxWorkerLoopPhase(record, 'owner_task', 'done', 'Задача Owner принята')
  next = updateMaxWorkerLoopPhase(next, 'max_intake', 'active', 'Запуск через Task Runner')
  next = { ...next, status: 'running' }
  return upsertMaxWorkerLoopRecord(next)
}

function markCompletedPhases(record: MaxWorkerLoopRecord): MaxWorkerLoopRecord {
  const steps: Array<[MaxWorkerLoopRecord['currentPhase'], string]> = [
    ['max_intake', 'MAX принял задачу'],
    ['ollama_reasoning', 'Local Ollama reasoning завершён'],
    ['analysis', 'Анализ извлечён из отчёта'],
    ['plan', 'План сформирован из рекомендаций'],
    ['tool_need_check', 'Инструмент не требуется (V1 safe)'],
    ['runtime_report', 'Runtime Report создан'],
    ['memory_evolution_draft', 'Черновик Memory Evolution'],
    ['knowledge_candidate_draft', 'Черновики Knowledge Candidate'],
    ['next_actions', 'Следующие действия сформированы'],
  ]

  let next = record
  for (const [phase, detail] of steps) {
    next = updateMaxWorkerLoopPhase(next, phase, 'done', detail)
  }

  const skippedPhases = ['owner_approval', 'tool_registry', 'verification'] as const
  for (const phase of skippedPhases) {
    next = updateMaxWorkerLoopPhase(next, phase, 'skipped', 'V1 safe — ветка инструментов отключена')
  }

  const finishedAt = new Date().toISOString()
  next = {
    ...next,
    status: 'completed',
    currentPhase: 'next_actions',
    finishedAt,
    updatedAt: finishedAt,
  }
  return upsertMaxWorkerLoopRecord(next)
}

function markFailed(record: MaxWorkerLoopRecord, message: string): MaxWorkerLoopRecord {
  const failed = upsertMaxWorkerLoopRecord({
    ...record,
    status: 'failed',
    errorMessage: message,
    finishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return updateMaxWorkerLoopPhase(failed, record.currentPhase, 'failed', message)
}

/** Assemble full V1 snapshot from completed run — pure read path, drafts only. */
export function assembleMaxWorkerLoopSnapshot(
  loop: MaxWorkerLoopRecord,
  run: RuntimeRun,
  report: Report,
): MaxWorkerLoopSnapshot {
  const reasoning = buildMaxWorkerLoopReasoningResult(run, report)
  const maxReport = buildMaxWorkerLoopReport(loop, run, report)
  const memoryEvolutionDraft = buildMemoryEvolutionDraft(run, report)
  const knowledgeCandidates = buildKnowledgeCandidateDrafts(run, memoryEvolutionDraft.lessons)
  const nextActions = buildMaxWorkerLoopNextActions(report)
  const ownerApproval = resolveOwnerApprovalGate(reasoning, loop.safeMode)
  const cursorAutomation = buildCursorAutomationWorkflowSnapshot({ loop, run, report })

  return {
    loop,
    reasoning,
    report: maxReport,
    memoryEvolutionDraft,
    knowledgeCandidates,
    nextActions,
    ownerApproval,
    cursorAutomation,
  }
}

/**
 * V1 safe execution: delegates to existing Task Runner + Runtime.
 * No external tools, no shell/git/docker. Builds draft snapshot on success.
 */
export async function runMaxWorkerLoopV1(
  input: MaxWorkerLoopInput,
): Promise<{ snapshot: MaxWorkerLoopSnapshot | null; loop: MaxWorkerLoopRecord }> {
  const mode = input.mode ?? 'technical_audit'
  const modelMode = input.modelMode ?? 'coding'

  let loop = createMaxWorkerLoopRecord({
    ...input,
    constraints:
      input.constraints?.trim() ||
      'V1 MAX Worker Loop: только reasoning через Local Ollama; без shell, git, docker и внешних API.',
    expectedOutput: input.expectedOutput?.trim() || defaultExpectedOutput(mode),
  })
  loop = markRunningPhases(loop)

  try {
    const { record, run } = await startTaskRunner({
      taskText: input.taskText,
      title: input.title,
      mode,
      modelMode,
      employeeId: MAX_WORKER_EMPLOYEE_ID,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      priority: input.priority ?? 'medium',
      expectedOutput: loop.input.expectedOutput ?? defaultExpectedOutput(mode),
      constraints: loop.input.constraints ?? '',
    })

    loop = upsertMaxWorkerLoopRecord({
      ...loop,
      deliveryTaskId: record.deliveryTaskId,
      runtimeRunId: run.id,
      reportId: run.reportId,
      taskRunnerRecordId: record.id,
      updatedAt: new Date().toISOString(),
    })

    if (run.status !== 'completed' || !run.reportId) {
      const message =
        run.status === 'waiting_approval'
          ? 'Runtime ожидает одобрения — V1 safe mode не использует approval gate.'
          : `Runtime завершился со статусом: ${run.status}`
      loop = markFailed(loop, message)
      return { snapshot: null, loop }
    }

    const report = getReportById(run.reportId)
    if (!report) {
      loop = markFailed(loop, 'Runtime Report не найден после завершения.')
      return { snapshot: null, loop }
    }

    loop = markCompletedPhases(loop)
    const snapshot = assembleMaxWorkerLoopSnapshot(loop, run, report)
    return { snapshot, loop }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка MAX Worker Loop'
    loop = markFailed(loop, message)
    return { snapshot: null, loop }
  }
}

/** Rebuild snapshot for an existing completed run (e.g. Runtime History). */
export function rebuildMaxWorkerLoopSnapshotFromRun(
  loop: MaxWorkerLoopRecord,
  runtimeRunId: string,
): MaxWorkerLoopSnapshot | null {
  const run = getRuntimeRunById(runtimeRunId)
  if (!run || !run.reportId) return null
  const report = getReportById(run.reportId)
  if (!report) return null
  return assembleMaxWorkerLoopSnapshot(loop, run, report)
}
