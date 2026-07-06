import type { CursorAutomationWorkflowSnapshot } from '../cursorAutomation/cursorAutomationTypes'
import type { AutonomousDemoScenario } from './autonomousDemoScenario'
import { getAutonomousDemoScenario } from './autonomousDemoScenario'
import type { MaxWorkerLoopSnapshot } from './maxWorkerLoopEngine'

/** Frozen demo bundle for Owner review — all stages in one snapshot. */
export type AutonomousDemoSnapshot = {
  scenarioId: string
  scenarioTitle: string
  scenarioSummary: string
  capturedAt: string
  loopId: string
  runtimeRunId: string | null
  reportId: string | null
  /** Real Ollama reasoning excerpt. */
  reasoningExcerpt: string
  analysisExcerpt: string
  planSteps: string[]
  toolDecision: {
    required: boolean
    reason: string | null
    suggestedToolId: string | null
  }
  cursorAutomation: CursorAutomationWorkflowSnapshot
  memoryLessonsCount: number
  knowledgeCandidatesCount: number
  nextActionsLabels: string[]
  stageLabels: string[]
  notes: string[]
}

const AUTONOMOUS_DEMO_STAGE_LABELS_RU = [
  'Owner → MAX',
  'Ollama Reasoning',
  'Tool Decision',
  'Cursor Automation Plan',
  'Owner Approval (mock)',
  'Mock Submit',
  'Mock PR',
  'MAX Review',
  'Runtime Report',
  'Memory Evolution',
  'Knowledge Candidate',
] as const

export function buildAutonomousDemoSnapshot(
  scenarioId: string,
  snapshot: MaxWorkerLoopSnapshot,
): AutonomousDemoSnapshot {
  const scenario = getAutonomousDemoScenario(
    scenarioId as AutonomousDemoScenario['id'],
  )
  const cursor = snapshot.cursorAutomation

  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    scenarioSummary: scenario.summary,
    capturedAt: new Date().toISOString(),
    loopId: snapshot.loop.id,
    runtimeRunId: snapshot.loop.runtimeRunId,
    reportId: snapshot.loop.reportId,
    reasoningExcerpt: snapshot.reasoning.reasoningText.slice(0, 480),
    analysisExcerpt: snapshot.reasoning.analysis.slice(0, 320),
    planSteps: snapshot.reasoning.plan.slice(0, 6),
    toolDecision: {
      required: cursor.externalExecutorRequired,
      reason: cursor.needReason,
      suggestedToolId: cursor.suggestedToolId,
    },
    cursorAutomation: cursor,
    memoryLessonsCount: snapshot.memoryEvolutionDraft.lessons.length,
    knowledgeCandidatesCount: snapshot.knowledgeCandidates.length,
    nextActionsLabels: snapshot.nextActions.map((item) => item.label),
    stageLabels: [...AUTONOMOUS_DEMO_STAGE_LABELS_RU],
    notes: [
      'Reasoning и Runtime Report — real (Local Ollama + Task Runner).',
      'Owner Approval, Cursor submit, PR — mock V1 (без Cursor API, shell, git).',
      'Memory/Knowledge — drafts, не публикуются автоматически.',
    ],
  }
}
