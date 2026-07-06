/**
 * Cursor Automation → AI Company integration (AI-COMPANY-099C).
 * Pure mappers: Runtime Report, MAX Review, Memory hints, Knowledge drafts, History events.
 * Без publish — только draft/hint. Без реального Cursor API.
 */

import type { HistoryEventPersistencePayload } from '../runtimePersistence/runtimePersistenceEntities'
import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type {
  KnowledgeCandidateDraft,
  MemoryEvolutionDraft,
} from '../maxWorkerLoop/maxWorkerLoopDrafts'
import type { MaxWorkerLoopRecord } from '../maxWorkerLoop/maxWorkerLoop'
import {
  CURSOR_AUTOMATION_TOOL_ID,
  type CursorAutomationPrSummary,
  type CursorAutomationRuleCandidate,
} from './cursorAutomation'
import type { CursorAutomationExpectedResult } from './cursorAutomationTypes'
import type { CursorAutomationSubmitRun } from './cursorAutomationSubmitRun'
import {
  mapPrToRuntimeReportPatch,
  mapResultToCursorRulesCandidates,
  mapResultToMemoryEvolutionHints,
} from './cursorAutomationServiceAdapterMappers'

export type CursorResultIntegrationSource = 'mock_v1' | 'adapter_v1'

export type CursorResultIntegrationInput = {
  loop: MaxWorkerLoopRecord
  run: RuntimeRun
  report: Report
  expectedResult: CursorAutomationExpectedResult
  memoryEvolutionDraft: MemoryEvolutionDraft
  baseKnowledgeCandidates: KnowledgeCandidateDraft[]
  submitRun: CursorAutomationSubmitRun | null
  ingestedAt?: string
  source: CursorResultIntegrationSource
}

export type CursorResultRuntimeReportPatch = {
  section: 'tool_execution'
  summary: string
  toolRegistryV1Id: typeof CURSOR_AUTOMATION_TOOL_ID
  reportSummary: string
  buildStatus: CursorAutomationExpectedResult['report']['buildStatus']
  checksRun: string[]
  pullRequestTitle: string | null
  pullRequestUrl: string | null
  changedFiles: string[]
  sections: string[]
  status: 'draft_patch'
  note: string
}

export type CursorResultMaxReview = {
  status: 'pending' | 'accepted' | 'rejected'
  summary: string
  acceptedAt: string | null
  reviewedByEmployeeId: string
  prUrl: string | null
  buildStatus: CursorAutomationExpectedResult['report']['buildStatus']
  checksReviewed: string[]
  notes: string[]
}

export type CursorResultMemoryHint = {
  id: string
  category: 'finding' | 'improvement' | 'knowledge' | 'mistake'
  title: string
  content: string
  status: 'draft_hint'
  source: 'cursor-automation-result'
  runId: string
  reportId: string
}

export type CursorResultKnowledgeCandidate = KnowledgeCandidateDraft & {
  proposedRulePath: string | null
  publishStatus: 'draft'
}

export type CursorResultHistoryEventDraft = HistoryEventPersistencePayload & {
  draftId: string
  subjectEntity: 'worker_loop' | 'runtime_run' | 'report'
  subjectId: string
}

export type CursorResultIntegrationBundle = {
  source: CursorResultIntegrationSource
  ingestedAt: string
  submitRunId: string | null
  runtimeReportPatch: CursorResultRuntimeReportPatch
  maxReview: CursorResultMaxReview
  memoryHints: CursorResultMemoryHint[]
  knowledgeCandidates: CursorResultKnowledgeCandidate[]
  ruleCandidates: CursorAutomationRuleCandidate[]
  historyEvents: CursorResultHistoryEventDraft[]
}

function toPrSummary(result: CursorAutomationExpectedResult): CursorAutomationPrSummary {
  return {
    number: null,
    url: result.pullRequest.url,
    title: result.pullRequest.title,
    changedFiles: result.artifacts.changedFiles.length,
    checksStatus:
      result.report.buildStatus === 'passed'
        ? 'passing'
        : result.report.buildStatus === 'failed'
          ? 'failing'
          : 'pending',
    reviewRequested: true,
  }
}

function buildMirrorTask(input: CursorResultIntegrationInput): {
  id: string
  title: string
  requestedByEmployeeId: string
} {
  return {
    id: input.submitRun?.runId ?? input.loop.id,
    title: input.expectedResult.pullRequest.title,
    requestedByEmployeeId: input.loop.employeeId,
  }
}

/** Patch для секции Runtime Report — draft, не мержится автоматически. */
export function buildCursorResultRuntimeReportPatch(
  input: CursorResultIntegrationInput,
): CursorResultRuntimeReportPatch {
  const task = buildMirrorTask(input)
  const pr = toPrSummary(input.expectedResult)
  const base = mapPrToRuntimeReportPatch(
    {
      id: task.id,
      title: task.title,
      instructions: input.expectedResult.report.summary,
      trigger: { kind: 'runtime-handoff', runtimeRunId: input.run.id, employeeId: input.loop.employeeId },
      requestedByEmployeeId: task.requestedByEmployeeId,
      runtimeRunId: input.run.id,
      maxWorkerLoopId: input.loop.id,
      projectId: input.loop.input.projectId,
      workspaceId: input.loop.input.workspaceId,
      repository: {
        owner: 'igor',
        repo: input.expectedResult.pullRequest.baseBranch.includes('/')
          ? input.expectedResult.pullRequest.baseBranch
          : 'servicemanager-ai-2.0',
        branch: input.expectedResult.pullRequest.branch,
      },
      enabledTools: [],
      status: 'completed',
      requiresOwnerApproval: false,
      toolRegistryV1Id: CURSOR_AUTOMATION_TOOL_ID,
      createdAt: input.ingestedAt ?? new Date().toISOString(),
      updatedAt: input.ingestedAt ?? new Date().toISOString(),
    },
    pr,
  )

  const { expectedResult } = input

  return {
    ...base,
    reportSummary: expectedResult.report.summary,
    buildStatus: expectedResult.report.buildStatus,
    checksRun: expectedResult.report.checksRun,
    pullRequestTitle: expectedResult.pullRequest.title,
    pullRequestUrl: expectedResult.pullRequest.url,
    changedFiles: expectedResult.artifacts.changedFiles,
    sections: expectedResult.report.sections,
    status: 'draft_patch',
    note: 'Draft patch V1 — не записывается в Report автоматически; Owner review обязателен.',
  }
}

/** MAX review результата Cursor — acceptance gate перед Memory/Knowledge. */
export function buildCursorResultMaxReview(input: CursorResultIntegrationInput): CursorResultMaxReview {
  const { expectedResult } = input
  const buildOk = expectedResult.report.buildStatus === 'passed'

  return {
    status: buildOk ? 'accepted' : 'pending',
    summary: buildOk
      ? `MAX принял результат Cursor Automation: ${expectedResult.report.summary.slice(0, 200)}`
      : `MAX ожидает проверки Cursor Automation — build status: ${expectedResult.report.buildStatus}`,
    acceptedAt: buildOk ? (input.ingestedAt ?? new Date().toISOString()) : null,
    reviewedByEmployeeId: input.loop.employeeId,
    prUrl: expectedResult.pullRequest.url,
    buildStatus: expectedResult.report.buildStatus,
    checksReviewed: expectedResult.report.checksRun,
    notes: [
      'V1: MAX review на основе mock/adapter результата — без merge PR.',
      `Runtime Report ${input.report.id} остаётся primary артефактом reasoning.`,
      buildOk
        ? 'Checks green (mock) — можно формировать Memory/Knowledge drafts.'
        : 'Checks не green — Memory hints помечены как improvement.',
    ],
  }
}

/** Memory Evolution hints — draft only, без permanent publish. */
export function buildCursorResultMemoryHints(
  input: CursorResultIntegrationInput,
): CursorResultMemoryHint[] {
  const task = buildMirrorTask(input)
  const pr = toPrSummary(input.expectedResult)
  const stringHints = mapResultToMemoryEvolutionHints(
    {
      id: task.id,
      title: task.title,
      instructions: '',
      trigger: { kind: 'runtime-handoff', runtimeRunId: input.run.id, employeeId: input.loop.employeeId },
      requestedByEmployeeId: task.requestedByEmployeeId,
      runtimeRunId: input.run.id,
      maxWorkerLoopId: input.loop.id,
      projectId: input.loop.input.projectId,
      workspaceId: input.loop.input.workspaceId,
      repository: { owner: 'igor', repo: 'servicemanager-ai-2.0', branch: 'ai-company-flow' },
      enabledTools: [],
      status: 'completed',
      requiresOwnerApproval: false,
      toolRegistryV1Id: CURSOR_AUTOMATION_TOOL_ID,
      createdAt: input.ingestedAt ?? new Date().toISOString(),
      updatedAt: input.ingestedAt ?? new Date().toISOString(),
    },
    pr,
  )

  const hints: CursorResultMemoryHint[] = stringHints.map((content, index) => ({
    id: `cursor-mem-hint-${input.loop.id}-${index}`,
    category:
      input.expectedResult.report.buildStatus === 'failed'
        ? 'improvement'
        : index === 0
          ? 'finding'
          : 'knowledge',
    title: `Cursor result hint ${index + 1}`,
    content,
    status: 'draft_hint',
    source: 'cursor-automation-result',
    runId: input.run.id,
    reportId: input.report.id,
  }))

  if (input.memoryEvolutionDraft.lessons.length > 0) {
    hints.push({
      id: `cursor-mem-bridge-${input.loop.id}`,
      category: 'finding',
      title: 'Связь с Memory Evolution draft',
      content: `${input.memoryEvolutionDraft.lessons.length} уроков из Runtime Report + ${stringHints.length} hint(s) от Cursor.`,
      status: 'draft_hint',
      source: 'cursor-automation-result',
      runId: input.run.id,
      reportId: input.report.id,
    })
  }

  return hints
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'ai-company-rule'
}

/** Knowledge Candidate drafts + rule paths — draft only. */
export function buildCursorResultKnowledgeCandidates(
  input: CursorResultIntegrationInput,
): CursorResultKnowledgeCandidate[] {
  const cursorSpecific: CursorResultKnowledgeCandidate[] = [
    {
      id: `kc-cursor-${input.loop.id}-pr`,
      title: `Cursor PR: ${input.expectedResult.pullRequest.title.slice(0, 80)}`,
      summary: input.expectedResult.report.summary.slice(0, 320),
      content: [
        `PR: ${input.expectedResult.pullRequest.url}`,
        `Build: ${input.expectedResult.report.buildStatus}`,
        `Files: ${input.expectedResult.artifacts.changedFiles.join(', ')}`,
        input.expectedResult.report.summary,
      ].join('\n\n'),
      type: 'documentation',
      source: 'max-worker-loop',
      status: 'draft',
      tags: [
        'cursor-automation',
        'knowledge-candidate',
        'draft-only',
        `run-${input.run.id}`,
        `loop-${input.loop.id}`,
      ],
      ownerEmployeeId: input.loop.employeeId,
      workspaceId: input.run.workspaceId,
      runId: input.run.id,
      lessonCategory: 'knowledge',
      proposedRulePath: null,
      publishStatus: 'draft',
    },
  ]

  const fromLessons = input.baseKnowledgeCandidates.map((candidate) => ({
    ...candidate,
    tags: [...candidate.tags, 'cursor-automation-result'],
    proposedRulePath: `.cursor/rules/${slugify(candidate.title)}.mdc`,
    publishStatus: 'draft' as const,
  }))

  return [...cursorSpecific, ...fromLessons]
}

/** Append-only HistoryEvent drafts (Runtime Persistence V1 shape). */
export function buildCursorResultHistoryEvents(
  input: CursorResultIntegrationInput,
): CursorResultHistoryEventDraft[] {
  const at = input.ingestedAt ?? new Date().toISOString()
  const loopId = input.loop.id
  const runId = input.run.id
  const reportId = input.report.id

  const events: CursorResultHistoryEventDraft[] = [
    {
      draftId: `he-cursor-submit-${loopId}`,
      kind: 'cursor_automation_submitted',
      label: 'Cursor Automation handoff submitted',
      detail: input.submitRun
        ? `Submit run ${input.submitRun.runId} · ${input.source}`
        : null,
      severity: 'info',
      employeeId: input.loop.employeeId,
      metadata: {
        maxWorkerLoopId: loopId,
        runtimeRunId: runId,
        submitRunId: input.submitRun?.runId ?? null,
        source: input.source,
      },
      idempotencyKey: `cursor-submit-${input.submitRun?.runId ?? loopId}`,
      subjectEntity: 'worker_loop',
      subjectId: loopId,
    },
    {
      draftId: `he-cursor-completed-${loopId}`,
      kind: 'cursor_automation_completed',
      label: 'Cursor Automation result ingested (mock)',
      detail: input.expectedResult.pullRequest.url,
      severity: input.expectedResult.report.buildStatus === 'passed' ? 'success' : 'warn',
      employeeId: input.loop.employeeId,
      metadata: {
        prUrl: input.expectedResult.pullRequest.url,
        buildStatus: input.expectedResult.report.buildStatus,
        changedFiles: input.expectedResult.artifacts.changedFiles.length,
      },
      idempotencyKey: `cursor-result-${input.submitRun?.runId ?? loopId}-${at.slice(0, 10)}`,
      subjectEntity: 'worker_loop',
      subjectId: loopId,
    },
    {
      draftId: `he-report-patch-${loopId}`,
      kind: 'report_created',
      label: 'Runtime Report patch prepared (Cursor tool_execution)',
      detail: input.expectedResult.report.summary.slice(0, 240),
      severity: 'info',
      employeeId: input.loop.employeeId,
      metadata: { reportId, patchStatus: 'draft_patch' },
      idempotencyKey: `report-patch-${reportId}-cursor`,
      subjectEntity: 'report',
      subjectId: reportId,
    },
    {
      draftId: `he-memory-draft-${loopId}`,
      kind: 'memory_draft_created',
      label: 'Memory Evolution hints from Cursor result',
      detail: `${input.memoryEvolutionDraft.lessons.length} base lessons + cursor hints (draft)`,
      severity: 'info',
      employeeId: input.loop.employeeId,
      metadata: { publishBlocked: true, status: 'draft_hint' },
      idempotencyKey: `memory-draft-cursor-${loopId}`,
      subjectEntity: 'runtime_run',
      subjectId: runId,
    },
    {
      draftId: `he-knowledge-draft-${loopId}`,
      kind: 'knowledge_draft_created',
      label: 'Knowledge candidates from Cursor result',
      detail: 'Draft only — Owner must approve before publish',
      severity: 'info',
      employeeId: input.loop.employeeId,
      metadata: { publishBlocked: true, status: 'draft' },
      idempotencyKey: `knowledge-draft-cursor-${loopId}`,
      subjectEntity: 'runtime_run',
      subjectId: runId,
    },
  ]

  return events
}

export function buildCursorResultIntegrationBundle(
  input: CursorResultIntegrationInput,
): CursorResultIntegrationBundle {
  const knowledgeCandidates = buildCursorResultKnowledgeCandidates(input)
  const ruleCandidates = mapResultToCursorRulesCandidates(
    knowledgeCandidates.map(({ proposedRulePath: _p, publishStatus: _s, ...rest }) => rest),
  )

  return {
    source: input.source,
    ingestedAt: input.ingestedAt ?? new Date().toISOString(),
    submitRunId: input.submitRun?.runId ?? null,
    runtimeReportPatch: buildCursorResultRuntimeReportPatch(input),
    maxReview: buildCursorResultMaxReview(input),
    memoryHints: buildCursorResultMemoryHints(input),
    knowledgeCandidates,
    ruleCandidates,
    historyEvents: buildCursorResultHistoryEvents(input),
  }
}

export function buildCursorResultIntegrationIfReady(input: {
  loop: MaxWorkerLoopRecord
  run: RuntimeRun | null
  report: Report | null
  submitRun: CursorAutomationSubmitRun | null
  memoryEvolutionDraft: MemoryEvolutionDraft
  baseKnowledgeCandidates: KnowledgeCandidateDraft[]
}): CursorResultIntegrationBundle | null {
  if (!input.run || !input.report || !input.submitRun) return null
  if (
    input.submitRun.status !== 'submitted_mock' &&
    input.submitRun.status !== 'submitted_pending_real_adapter' &&
    input.submitRun.status !== 'waiting_for_result' &&
    input.submitRun.status !== 'completed'
  ) {
    return null
  }

  return buildCursorResultIntegrationBundle({
    loop: input.loop,
    run: input.run,
    report: input.report,
    expectedResult: input.submitRun.handoffPayload.expectedResult,
    memoryEvolutionDraft: input.memoryEvolutionDraft,
    baseKnowledgeCandidates: input.baseKnowledgeCandidates,
    submitRun: input.submitRun,
    ingestedAt: input.submitRun.submittedAt,
    source: input.submitRun.deliveryMode === 'mock_v1_stub' ? 'mock_v1' : 'adapter_v1',
  })
}
