/**
 * Owner-facing entry point for a local analysis task (UI block 1 + 3).
 *
 * Creating: a work item for the builder (the only executor the bridge binds
 * tool runs to) + requestToolExecution(toolId 'ollama'). Approval follows the
 * capability: with the autonomy switch on the run is approved at creation and
 * the executor starts; otherwise it waits in awaiting_owner like any run.
 *
 * Reading: a flat view over the stored run + its envelope, so the page renders
 * without knowing envelope internals.
 */

import { createEmployeeWorkItem } from '../employeeWorkQueue/employeeWorkQueueStorage'
import { EMPLOYEE_ROUTE_IDS, resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { readEnvelopeFromToolResult } from '../cursorResultEnvelope/cursorResultEnvelopeAdapters'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import { requestToolExecution } from '../toolExecution/toolExecutionRunBridge'
import { listToolExecutionRuns } from '../toolExecution/toolExecutionRunStorage'
import type { ToolExecutionRun, ToolExecutionRunStatus } from '../toolExecution/toolExecutionRunTypes'
import { parseAnalysisBlocks, type AnalysisBlock } from './ollamaAnalysisSections'
import type { OllamaGenerationMetrics } from './ollamaAnalysisClient'

export type CreateOllamaAnalysisTaskInput = {
  title: string
  instructions: string
  companyId?: string
}

export function createOllamaAnalysisTask(input: CreateOllamaAnalysisTaskInput): ToolExecutionRun {
  const title = input.title.trim()
  const instructions = input.instructions.trim()
  if (!title) throw new Error('Analysis task needs a title.')
  if (!instructions) throw new Error('Analysis task needs instructions.')

  const workItem = createEmployeeWorkItem({
    employeeId: resolveCanonicalEmployeeId(EMPLOYEE_ROUTE_IDS.builder),
    title,
    taskText: instructions,
    source: 'manual',
    companyId: input.companyId ?? null,
  })

  const { run } = requestToolExecution({
    toolId: 'ollama',
    workItemId: workItem.id,
    companyId: workItem.companyId,
    title,
    instructions,
    expectedResult: 'Problem / Risk / Recommendation / Effort',
  })
  return run
}

export function listOllamaAnalysisRuns(): ToolExecutionRun[] {
  return listToolExecutionRuns({ toolId: 'ollama' }).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export type OllamaAnalysisPhase =
  | 'waiting_owner'
  | 'in_progress'
  | 'done'
  | 'accepted'
  | 'failed'
  | 'closed'

export function resolveOllamaAnalysisPhase(status: ToolExecutionRunStatus): OllamaAnalysisPhase {
  switch (status) {
    case 'draft':
    case 'awaiting_owner':
      return 'waiting_owner'
    case 'approved':
    case 'queued':
    case 'running':
      return 'in_progress'
    case 'result_received':
    case 'awaiting_employee_review':
      return 'done'
    case 'accepted':
      return 'accepted'
    case 'failed':
      return 'failed'
    default:
      return 'closed'
  }
}

export type OllamaAnalysisView = {
  runId: string
  title: string
  instructions: string
  status: ToolExecutionRunStatus
  phase: OllamaAnalysisPhase
  createdAt: string
  envelope: CursorResultEnvelope | null
  answerText: string | null
  preamble: string
  blocks: AnalysisBlock[]
  sectionsValidated: boolean | null
  missingSections: string[]
  emptySections: string[]
  model: string | null
  metrics: OllamaGenerationMetrics | null
  errors: string[]
  canApprove: boolean
  canAccept: boolean
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function buildOllamaAnalysisView(run: ToolExecutionRun): OllamaAnalysisView {
  const envelope = run.result ? readEnvelopeFromToolResult(run.result) : null
  const meta = (envelope?.metadata ?? {}) as Record<string, unknown>
  const sections = (meta.analysisSections ?? {}) as Record<string, unknown>
  const answerText = envelope?.summary ?? null
  const parsed = answerText ? parseAnalysisBlocks(answerText) : { preamble: '', blocks: [] }

  const errors = [
    ...(envelope?.errors ?? []).map((e) => `${e.code}: ${e.message}`),
    ...(run.error && !(envelope?.errors ?? []).length ? [run.error] : []),
  ]

  return {
    runId: run.id,
    title: run.title,
    instructions: run.instructions,
    status: run.status,
    phase: resolveOllamaAnalysisPhase(run.status),
    createdAt: run.createdAt,
    envelope,
    answerText,
    preamble: parsed.preamble,
    blocks: parsed.blocks,
    // Only an answer can be judged against the section contract; a transport
    // failure carries sectionsValidated:false too, but there is nothing to judge.
    sectionsValidated:
      answerText && typeof meta.sectionsValidated === 'boolean' ? meta.sectionsValidated : null,
    missingSections: asStringArray(sections.missing),
    emptySections: asStringArray(sections.empty),
    model: typeof meta.analysisModel === 'string' ? meta.analysisModel : null,
    metrics: (meta.analysisMetrics as OllamaGenerationMetrics | undefined) ?? null,
    errors,
    canApprove: run.status === 'awaiting_owner',
    canAccept: run.status === 'awaiting_employee_review' || run.status === 'result_received',
  }
}
