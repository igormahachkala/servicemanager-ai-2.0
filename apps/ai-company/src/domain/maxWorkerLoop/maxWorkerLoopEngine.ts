import { getReportById } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import {
  buildRuntimeFailureDiagnostics,
  buildRuntimeFailureDiagnosticsFromRun,
  publishRuntimeFailureDebug,
  type RuntimeFailureDiagnostics,
} from '../runtime/runtimeFailureDiagnostics'
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
  buildMaxWorkerLoopDecisionPlan,
  resolveModelModeFromDecisionPlan,
  summarizeDecisionPlanPhase,
  summarizeModelSelectionPhase,
} from './maxWorkerLoopDecisionPlan'
import {
  buildTaskConstraintsWithPeerConsultation,
  buildTaskTextWithPeerConsultation,
  runMaxWorkerLoopPeerConsultation,
  summarizeConsultPeerPhase,
  type MaxWorkerLoopPeerConsultationSnapshot,
} from './maxWorkerLoopPeerConsultation'
import {
  createMaxWorkerLoopRecord,
  updateMaxWorkerLoopPhase,
  upsertMaxWorkerLoopRecord,
} from './maxWorkerLoopStorage'
import type { OwnerApprovalGate } from './maxWorkerLoopApproval'
import { resolveOwnerApprovalGate } from './maxWorkerLoopApproval'
import { buildCursorAutomationWorkflowSnapshot } from '../cursorAutomation/cursorAutomationWorkflow'
import {
  linkDecisionPlanRuntimeRun,
  saveDecisionPlanRecord,
} from '../decisionPlan/decisionPlanStorage'
import { getCursorAutomationSubmitRunByLoopId } from '../cursorAutomation/cursorAutomationSubmitStorage'
import { mapSubmitRunToWorkflowStatus } from '../cursorAutomation/cursorAutomationSubmit'
import {
  buildCursorResultIntegrationIfReady,
  type CursorResultHistoryEventDraft,
} from '../cursorAutomation/cursorAutomationResultIntegration'
import type { DecisionPlan } from '../decisionPlan'
import {
  buildEmployeeWorkerLoopContext,
  defaultEmployeeWorkerLoopConstraints,
  resolveEmployeeWorkerLoopFeatures,
} from '../employeeWorkerLoop/employeeWorkerLoopContext'
import { handleBuilderToolDecisionAfterPlan } from '../builderToolDecision/builderToolDecisionWorkerLoopBridge'
import type { WorkItem } from '../employeeWorkQueue'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { recordMaxWorkerLoopDailyJournalOnCompletion } from '../employeeDailyJournal'

export type MaxWorkerLoopSnapshot = {
  loop: MaxWorkerLoopRecord
  decisionPlan: DecisionPlan | null
  peerConsultation: MaxWorkerLoopPeerConsultationSnapshot | null
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

function enrichReasoningFromDecisionPlan(
  reasoning: MaxWorkerLoopReasoningResult,
  decisionPlan: DecisionPlan | null,
): MaxWorkerLoopReasoningResult {
  if (!decisionPlan) return reasoning
  return {
    ...reasoning,
    toolNeeded: decisionPlan.cursorAutomationRequired || decisionPlan.toolRegistryRequired,
    toolNeededReason:
      decisionPlan.cursorAutomationReason ??
      decisionPlan.toolRegistryReason ??
      reasoning.toolNeededReason,
    ollamaModelTag: reasoning.ollamaModelTag ?? decisionPlan.primaryModel.ollamaTag,
  }
}

export type MaxWorkerLoopRunResult = {
  snapshot: MaxWorkerLoopSnapshot | null
  loop: MaxWorkerLoopRecord
  demoSnapshot: AutonomousDemoSnapshot | null
}

function markRunningPhases(record: MaxWorkerLoopRecord): MaxWorkerLoopRecord {
  let next = updateMaxWorkerLoopPhase(record, 'owner_task', 'done', 'Задача Owner принята')
  next = updateMaxWorkerLoopPhase(next, 'decision_plan', 'active', 'Employee Brain строит Decision Plan')
  next = { ...next, status: 'running' }
  return upsertMaxWorkerLoopRecord(next)
}

function applyToolBranchCompletedPhases(
  record: MaxWorkerLoopRecord,
  cursor: CursorAutomationWorkflowSnapshot,
  options: { demoApprovalDone: boolean },
): MaxWorkerLoopRecord {
  let next = updateMaxWorkerLoopPhase(
    record,
    'tool_need_check',
    'done',
    cursor.needReason ?? 'Decision Plan: требуется внешний исполнитель',
  )

  if (options.demoApprovalDone) {
    next = updateMaxWorkerLoopPhase(
      next,
      'owner_approval',
      'done',
      'Demo: Owner Approval зафиксирован (mock gate, без /ops/approvals UI)',
    )
  } else {
    next = updateMaxWorkerLoopPhase(
      next,
      'owner_approval',
      'done',
      record.decisionPlan?.ownerApprovalReasons.join(' · ') ??
        'Decision Plan: требуется Owner Approval перед Cursor Automation',
    )
  }

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
      : 'V1 safe — invoke не выполняется; Tool Branch отражает Decision Plan',
  )

  return next
}

function markAutonomousDemoCompletedPhases(
  record: MaxWorkerLoopRecord,
  cursor: CursorAutomationWorkflowSnapshot,
): MaxWorkerLoopRecord {
  const baseSteps: Array<[MaxWorkerLoopRecord['currentPhase'], string]> = [
    [
      'decision_plan',
      record.decisionPlan ? summarizeDecisionPlanPhase(record.decisionPlan) : 'Decision Plan (Brain)',
    ],    [
      'consult_peer',
      record.peerConsultation
        ? summarizeConsultPeerPhase(record.peerConsultation)
        : 'Peer consult — не выполнялся',
    ],
    [
      'model_selection',
      record.decisionPlan ? summarizeModelSelectionPhase(record.decisionPlan) : 'Model selection',
    ],
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
    next = applyToolBranchCompletedPhases(next, cursor, { demoApprovalDone: true })
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
    ['decision_plan', record.decisionPlan ? summarizeDecisionPlanPhase(record.decisionPlan) : 'Decision Plan'],    [
      'consult_peer',
      record.peerConsultation
        ? summarizeConsultPeerPhase(record.peerConsultation)
        : 'Peer consult — не выполнялся',
    ],
    [
      'model_selection',
      record.decisionPlan ? summarizeModelSelectionPhase(record.decisionPlan) : 'Model selection',
    ],
    ['max_intake', record.phases.find((item) => item.phase === 'max_intake')?.detail?.trim() ?? 'Задача принята'],
    ['ollama_reasoning', 'Local Ollama reasoning завершён'],
    ['analysis', 'Анализ извлечён из отчёта'],
    ['plan', 'План сформирован из рекомендаций'],
    ['runtime_report', 'Runtime Report создан'],
    ['memory_evolution_draft', 'Черновик Memory Evolution'],
    ['knowledge_candidate_draft', 'Черновики Knowledge Candidate'],
    ['next_actions', 'Следующие действия сформированы'],
  ]

  let next = record
  for (const [phase, detail] of steps) {
    next = updateMaxWorkerLoopPhase(next, phase, 'done', detail)
  }

  if (cursor?.externalExecutorRequired) {
    next = applyToolBranchCompletedPhases(next, cursor, { demoApprovalDone: false })
  } else {
    next = updateMaxWorkerLoopPhase(
      next,
      'tool_need_check',
      'done',
      record.decisionPlan?.cursorAutomationRequired
        ? 'Decision Plan: Cursor не активирован (V1 safe)'
        : 'Инструмент не требуется (V1 safe)',
    )
    for (const phase of ['owner_approval', 'tool_registry', 'verification'] as const) {
      next = updateMaxWorkerLoopPhase(next, phase, 'skipped', 'V1 safe — ветка инструментов не вызывается')
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

function markFailed(
  record: MaxWorkerLoopRecord,
  message: string,
  diagnostics?: RuntimeFailureDiagnostics | null,
): MaxWorkerLoopRecord {
  const failureDiagnostics =
    diagnostics ??
    buildRuntimeFailureDiagnostics({
      loop: record,
      workerLoopId: record.id,
      runtimeRunId: record.runtimeRunId,
      phase: record.currentPhase,
      errorMessage: message,
    })
  publishRuntimeFailureDebug(failureDiagnostics)

  const failed = upsertMaxWorkerLoopRecord({
    ...record,
    status: 'failed',
    errorMessage: failureDiagnostics.errorMessage ?? message,
    failureDiagnostics,
    finishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return updateMaxWorkerLoopPhase(failed, record.currentPhase, 'failed', failureDiagnostics.errorMessage ?? message)
}

/** Assemble full V1 snapshot from completed run — pure read path, drafts only. */
export function assembleMaxWorkerLoopSnapshot(
  loop: MaxWorkerLoopRecord,
  run: RuntimeRun,
  report: Report,
  options?: { enableCursorAutomation?: boolean },
): MaxWorkerLoopSnapshot {
  const enableCursorAutomation =
    options?.enableCursorAutomation ??
    resolveEmployeeWorkerLoopFeatures(loop.employeeId).cursorAutomation
  const decisionPlan = loop.decisionPlan
  const reasoning = enrichReasoningFromDecisionPlan(
    buildMaxWorkerLoopReasoningResult(run, report),
    decisionPlan,
  )
  const maxReport = buildMaxWorkerLoopReport(loop, run, report)
  const memoryEvolutionDraft = buildMemoryEvolutionDraft(run, report)
  const knowledgeCandidates = buildKnowledgeCandidateDrafts(run, memoryEvolutionDraft.lessons)
  const nextActions = buildMaxWorkerLoopNextActions(report)
  const ownerApproval = resolveOwnerApprovalGate(reasoning, loop.safeMode, decisionPlan)
  const baseCursor = buildCursorAutomationWorkflowSnapshot({ loop, run, report })
  const cursorAutomation = enableCursorAutomation
    ? enrichCursorAutomationSnapshot({
        loop,
        run,
        report,
        memoryEvolutionDraft,
        knowledgeCandidates,
        base: baseCursor,
      })
    : baseCursor

  return {
    loop,
    decisionPlan,
    peerConsultation: loop.peerConsultation,
    reasoning,
    report: maxReport,
    memoryEvolutionDraft,
    knowledgeCandidates,
    nextActions,
    ownerApproval,
    cursorAutomation,
  }
}

export type RunEmployeeWorkerLoopParams = {
  employeeId: string
  input: MaxWorkerLoopInput
  /** Source Work Queue item — required for Builder tool decision (113B). */
  workItem?: WorkItem | null
}

/**
 * Generic Employee Worker Loop — any digital employee (AI-COMPANY-112G).
 * Delegates to existing Task Runner + Runtime. MAX is a special case via wrapper.
 */
export async function runEmployeeWorkerLoop(
  params: RunEmployeeWorkerLoopParams,
): Promise<MaxWorkerLoopRunResult> {
  const employeeId = resolveCanonicalEmployeeId(params.employeeId)
  const input = params.input
  const context = buildEmployeeWorkerLoopContext(employeeId)
  const features = context.features
  const mode = input.mode ?? 'technical_audit'
  const requestedModelMode = input.modelMode ?? 'coding'

  let loop = createMaxWorkerLoopRecord(
    {
      ...input,
      constraints:
        input.constraints?.trim() ||
        defaultEmployeeWorkerLoopConstraints(employeeId, context),
      expectedOutput: input.expectedOutput?.trim() || defaultExpectedOutput(mode),
      autonomousDemoScenarioId: features.autonomousDemo
        ? input.autonomousDemoScenarioId ?? null
        : null,
    },
    employeeId,
  )

  loop = markRunningPhases(loop)

  try {
    const decisionPlan = buildMaxWorkerLoopDecisionPlan({
      loop,
      requestedModelMode,
      employeeId,
      brainProfile: context.brainProfile,
    })
    saveDecisionPlanRecord({
      plan: decisionPlan,
      employeeId,
      maxWorkerLoopId: loop.id,
      runtimeRunId: null,
      savedAt: new Date().toISOString(),
    })
    const modelMode = resolveModelModeFromDecisionPlan(decisionPlan)

    loop = upsertMaxWorkerLoopRecord({
      ...loop,
      decisionPlan,
      updatedAt: new Date().toISOString(),
    })
    loop = updateMaxWorkerLoopPhase(loop, 'decision_plan', 'done', summarizeDecisionPlanPhase(decisionPlan))

    const builderToolBranch = handleBuilderToolDecisionAfterPlan({
      employeeId,
      loop,
      decisionPlan,
      workItem: params.workItem ?? null,
    })
    if (builderToolBranch.handled) {
      return {
        snapshot: null,
        loop: builderToolBranch.loop,
        demoSnapshot: null,
      }
    }

    let peerConsultation: MaxWorkerLoopPeerConsultationSnapshot
    if (features.peerConsultation) {
      loop = updateMaxWorkerLoopPhase(loop, 'consult_peer', 'active', 'Decision Plan → peer consult')
      loop = upsertMaxWorkerLoopRecord(loop)
      try {
        peerConsultation = runMaxWorkerLoopPeerConsultation({ loop, decisionPlan })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Peer consult failed'
        peerConsultation = {
          status: 'failed',
          required: decisionPlan.peerConsultation.required,
          skipReason: message,
          peerEmployeeId: decisionPlan.peerConsultation.peerEmployeeId,
          peerDisplayName: decisionPlan.peerConsultation.peerDisplayName,
          consultReason: decisionPlan.peerConsultation.reason,
          conversationId: null,
          questionMessageId: null,
          answerMessageId: null,
          decisionId: null,
          questionBody: null,
          answerBody: null,
          decisionSummary: null,
          consumedSummary: null,
          taskEnrichment: null,
          completedAt: new Date().toISOString(),
        }
      }
    } else {
      peerConsultation = {
        status: 'skipped',
        required: false,
        skipReason: `${context.employeeCodename}: peer consult не используется в V1 generic loop`,
        peerEmployeeId: null,
        peerDisplayName: null,
        consultReason: null,
        conversationId: null,
        questionMessageId: null,
        answerMessageId: null,
        decisionId: null,
        questionBody: null,
        answerBody: null,
        decisionSummary: null,
        consumedSummary: null,
        taskEnrichment: null,
        completedAt: new Date().toISOString(),
      }
      loop = updateMaxWorkerLoopPhase(loop, 'consult_peer', 'skipped', peerConsultation.skipReason ?? undefined)
    }

    loop = upsertMaxWorkerLoopRecord({
      ...loop,
      peerConsultation,
      updatedAt: new Date().toISOString(),
    })

    if (features.peerConsultation) {
      loop = updateMaxWorkerLoopPhase(
        loop,
        'consult_peer',
        peerConsultation.status === 'failed'
          ? 'failed'
          : peerConsultation.status === 'skipped'
            ? 'skipped'
            : 'done',
        summarizeConsultPeerPhase(peerConsultation),
      )
    }

    if (peerConsultation.status === 'failed') {
      loop = markFailed(loop, peerConsultation.skipReason ?? 'Peer consult failed')
      return { snapshot: null, loop, demoSnapshot: null }
    }

    loop = updateMaxWorkerLoopPhase(
      loop,
      'model_selection',
      'done',
      summarizeModelSelectionPhase(decisionPlan),
    )
    loop = updateMaxWorkerLoopPhase(
      loop,
      'max_intake',
      'active',
      `${context.employeeCodename} принял задачу`,
    )
    loop = upsertMaxWorkerLoopRecord(loop)

    const defaultConstraints = defaultEmployeeWorkerLoopConstraints(employeeId, context)
    const enrichedTaskText = features.peerConsultation
      ? buildTaskTextWithPeerConsultation(input.taskText, peerConsultation)
      : input.taskText
    const enrichedConstraints = features.peerConsultation
      ? buildTaskConstraintsWithPeerConsultation(loop.input.constraints ?? defaultConstraints, peerConsultation)
      : loop.input.constraints ?? defaultConstraints

    const { record, run } = await startTaskRunner({
      taskText: enrichedTaskText,
      title: input.title,
      mode,
      modelMode,
      employeeId,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      priority: input.priority ?? 'medium',
      expectedOutput: loop.input.expectedOutput ?? defaultExpectedOutput(mode),
      constraints: enrichedConstraints,
    })

    loop = upsertMaxWorkerLoopRecord({
      ...loop,
      deliveryTaskId: record.deliveryTaskId,
      runtimeRunId: run.id,
      reportId: run.reportId,
      taskRunnerRecordId: record.id,
      decisionPlan: {
        ...decisionPlan,
        taskId: record.deliveryTaskId,
      },
      updatedAt: new Date().toISOString(),
    })
    linkDecisionPlanRuntimeRun(decisionPlan.id, run.id)

    if (run.status !== 'completed' || !run.reportId) {
      const message =
        run.status === 'waiting_approval'
          ? 'Runtime ожидает одобрения — V1 safe mode не использует approval gate.'
          : `Runtime завершился со статусом: ${run.status}`
      const diagnostics = buildRuntimeFailureDiagnosticsFromRun(run, loop, message)
      loop = markFailed(loop, diagnostics.errorMessage ?? message, diagnostics)
      return { snapshot: null, loop, demoSnapshot: null }
    }

    const report = getReportById(run.reportId)
    if (!report) {
      loop = markFailed(loop, 'Runtime Report не найден после завершения.')
      return { snapshot: null, loop, demoSnapshot: null }
    }

    const snapshotOptions = { enableCursorAutomation: features.cursorAutomation }
    const previewSnapshot = assembleMaxWorkerLoopSnapshot(loop, run, report, snapshotOptions)
    loop = markCompletedPhases(loop, previewSnapshot.cursorAutomation)
    const snapshot = assembleMaxWorkerLoopSnapshot(loop, run, report, snapshotOptions)
    recordMaxWorkerLoopDailyJournalOnCompletion({ snapshot, run, report })
    const demoSnapshot =
      features.autonomousDemo && loop.autonomousDemoScenarioId
        ? buildAutonomousDemoSnapshot(loop.autonomousDemoScenarioId, snapshot)
        : null
    return { snapshot, loop, demoSnapshot }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка Worker Loop'
    const diagnostics = buildRuntimeFailureDiagnostics({
      loop,
      workerLoopId: loop.id,
      runtimeRunId: loop.runtimeRunId,
      phase: loop.currentPhase,
      error,
      errorMessage: message,
    })
    loop = markFailed(loop, message, diagnostics)
    return { snapshot: null, loop, demoSnapshot: null }
  }
}

/** Legacy MAX wrapper — delegates to generic employee loop. */
export async function runMaxWorkerLoop(input: MaxWorkerLoopInput): Promise<MaxWorkerLoopRunResult> {
  return runEmployeeWorkerLoop({ employeeId: MAX_WORKER_EMPLOYEE_ID, input })
}

/**
 * V1 safe execution: delegates to existing Task Runner + Runtime.
 * @deprecated Prefer runEmployeeWorkerLoop / runMaxWorkerLoop.
 */
export async function runMaxWorkerLoopV1(input: MaxWorkerLoopInput): Promise<MaxWorkerLoopRunResult> {
  return runMaxWorkerLoop(input)
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
