import { getReportById } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { getRuntimeRunById } from '../runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../runtime/runtimeRun'
import { startTaskRunner } from '../taskRunner/taskRunner'
import { defaultExpectedOutput } from '../taskRunner/taskRunnerTemplates'
import type { CursorAutomationWorkflowSnapshot } from '../cursorAutomation/cursorAutomationTypes'
import { buildAutonomousDemoSnapshot, type AutonomousDemoSnapshot } from './autonomousDemoSnapshot'
import {
  DEFAULT_AUTONOMOUS_DEMO_SCENARIO_ID,
  getAutonomousDemoScenario,
  type AutonomousDemoScenarioId,
} from './autonomousDemoScenario'
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
import { buildCursorAutomationWorkflowSnapshot } from '../cursorAutomation/cursorAutomationWorkflow'
import { getCursorAutomationSubmitRunByLoopId } from '../cursorAutomation/cursorAutomationSubmitStorage'
import { mapSubmitRunToWorkflowStatus } from '../cursorAutomation/cursorAutomationSubmit'
import {
  buildCursorResultIntegrationIfReady,
  type CursorResultHistoryEventDraft,
} from '../cursorAutomation/cursorAutomationResultIntegration'

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

function enrichCursorAutomationSnapshot(input: {
  loop: MaxWorkerLoopRecord
  run: RuntimeRun
  report: Report
  memoryEvolutionDraft: MemoryEvolutionDraft
  knowledgeCandidates: KnowledgeCandidateDraft[]
  base: CursorAutomationWorkflowSnapshot
}): CursorAutomationWorkflowSnapshot {
  const submitRun = getCursorAutomationSubmitRunByLoopId(input.loop.id)
  const submitStatus = mapSubmitRunToWorkflowStatus(submitRun)

  let cursorAutomation: CursorAutomationWorkflowSnapshot = {
    ...input.base,
    submitRun,
    resultIntegration: null,
    expectedResult: submitRun?.handoffPayload.expectedResult ?? input.base.expectedResult,
    status: submitStatus ?? input.base.status,
  }

  const resultIntegration = buildCursorResultIntegrationIfReady({
    loop: input.loop,
    run: input.run,
    report: input.report,
    submitRun,
    expectedResult:
      submitRun?.handoffPayload.expectedResult ??
      input.base.expectedResult ??
      input.base.mockIngestion?.result ??
      null,
    memoryEvolutionDraft: input.memoryEvolutionDraft,
    baseKnowledgeCandidates: input.knowledgeCandidates,
    externalExecutorRequired: input.base.externalExecutorRequired,
  })

  if (!resultIntegration) {
    return cursorAutomation
  }

  const expectedResult =
    submitRun?.handoffPayload.expectedResult ?? cursorAutomation.expectedResult

  return {
    ...cursorAutomation,
    resultIntegration,
    mockIngestion: expectedResult
      ? {
          ingestedAt: resultIntegration.ingestedAt,
          source: 'mock_v1',
          ok: resultIntegration.maxReview.status === 'accepted',
          result: expectedResult,
          notes: [
            'Mock ingestion V1 via Cursor result integration (099C).',
            ...resultIntegration.historyEvents
              .slice(0, 3)
              .map((event: CursorResultHistoryEventDraft) => event.label),
          ],
        }
      : cursorAutomation.mockIngestion,
    workflowLog: [
      ...cursorAutomation.workflowLog,
      {
        at: resultIntegration.ingestedAt,
        phase: 'mock_pr_ingested',
        level: 'info',
        message:
          'Cursor result ingested — Runtime Report patch, Memory hints, Knowledge drafts (draft only).',
      },
    ],
  }
}

export type MaxWorkerLoopRunResult = {
  snapshot: MaxWorkerLoopSnapshot | null
  loop: MaxWorkerLoopRecord
  demoSnapshot: AutonomousDemoSnapshot | null
}

function markRunningPhases(record: MaxWorkerLoopRecord): MaxWorkerLoopRecord {
  let next = updateMaxWorkerLoopPhase(record, 'owner_task', 'done', 'Задача Owner принята')
  next = updateMaxWorkerLoopPhase(next, 'max_intake', 'active', 'Запуск через Task Runner')
  next = { ...next, status: 'running' }
  return upsertMaxWorkerLoopRecord(next)
}

function markAutonomousDemoCompletedPhases(
  record: MaxWorkerLoopRecord,
  cursor: CursorAutomationWorkflowSnapshot,
): MaxWorkerLoopRecord {
  const baseSteps: Array<[MaxWorkerLoopRecord['currentPhase'], string]> = [
    ['max_intake', 'MAX принял demo-задачу Owner'],
    ['ollama_reasoning', 'Local Ollama reasoning завершён (real)'],
    ['analysis', 'Анализ извлечён из Runtime Report'],
    ['plan', 'План сформирован из рекомендаций'],
    ['runtime_report', 'Runtime Report создан (real)'],
    ['memory_evolution_draft', 'Черновик Memory Evolution'],
    ['knowledge_candidate_draft', 'Черновики Knowledge Candidate'],
    ['next_actions', 'Next Actions сформированы'],
  ]

  let next = record
  for (const [phase, detail] of baseSteps) {
    next = updateMaxWorkerLoopPhase(next, phase, 'done', detail)
  }

  if (cursor.externalExecutorRequired) {
    next = updateMaxWorkerLoopPhase(
      next,
      'tool_need_check',
      'done',
      cursor.needReason ?? 'Требуется Cursor Automation',
    )
    next = updateMaxWorkerLoopPhase(
      next,
      'owner_approval',
      'done',
      'Demo: Owner Approval зафиксирован (mock gate, без /ops/approvals UI)',
    )
    next = updateMaxWorkerLoopPhase(
      next,
      'tool_registry',
      'done',
      `Tool Registry · ${cursor.suggestedToolId ?? 'cursor-automation'}`,
    )
    next = updateMaxWorkerLoopPhase(
      next,
      'verification',
      'done',
      cursor.mockIngestion
        ? `MAX Review · mock PR ${cursor.mockIngestion.result.pullRequest.url}`
        : 'MAX Review mock результата',
    )
  } else {
    next = updateMaxWorkerLoopPhase(next, 'tool_need_check', 'done', 'Внешний исполнитель не требуется')
    for (const phase of ['owner_approval', 'tool_registry', 'verification'] as const) {
      next = updateMaxWorkerLoopPhase(next, phase, 'skipped', 'Autonomous demo — tool branch не нужен')
    }
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

function markCompletedPhases(
  record: MaxWorkerLoopRecord,
  cursor?: CursorAutomationWorkflowSnapshot,
): MaxWorkerLoopRecord {
  if (record.autonomousDemoScenarioId && cursor) {
    return markAutonomousDemoCompletedPhases(record, cursor)
  }

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
  const cursorAutomation = enrichCursorAutomationSnapshot({
    loop,
    run,
    report,
    memoryEvolutionDraft,
    knowledgeCandidates,
    base: buildCursorAutomationWorkflowSnapshot({ loop, run, report }),
  })

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
export async function runMaxWorkerLoopV1(input: MaxWorkerLoopInput): Promise<MaxWorkerLoopRunResult> {
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
      return { snapshot: null, loop, demoSnapshot: null }
    }

    const report = getReportById(run.reportId)
    if (!report) {
      loop = markFailed(loop, 'Runtime Report не найден после завершения.')
      return { snapshot: null, loop, demoSnapshot: null }
    }

    const previewSnapshot = assembleMaxWorkerLoopSnapshot(loop, run, report)
    loop = markCompletedPhases(loop, previewSnapshot.cursorAutomation)
    const snapshot = assembleMaxWorkerLoopSnapshot(loop, run, report)
    const demoSnapshot = loop.autonomousDemoScenarioId
      ? buildAutonomousDemoSnapshot(loop.autonomousDemoScenarioId, snapshot)
      : null
    return { snapshot, loop, demoSnapshot }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка MAX Worker Loop'
    loop = markFailed(loop, message)
    return { snapshot: null, loop, demoSnapshot: null }
  }
}

/** AI-COMPANY-098C — first autonomous demo with full stage visibility. */
export async function runAutonomousDemoScenario(
  scenarioId: AutonomousDemoScenarioId = DEFAULT_AUTONOMOUS_DEMO_SCENARIO_ID,
): Promise<MaxWorkerLoopRunResult> {
  const scenario = getAutonomousDemoScenario(scenarioId)
  return runMaxWorkerLoopV1({
    ...scenario.input,
    autonomousDemoScenarioId: scenarioId,
  })
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
