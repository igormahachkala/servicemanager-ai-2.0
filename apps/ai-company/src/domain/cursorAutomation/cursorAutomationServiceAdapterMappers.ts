/**
 * Cursor Automation Service Adapter — pure mappers (AI-COMPANY-099B).
 */

import type { KnowledgeCandidateDraft } from '../maxWorkerLoop/maxWorkerLoopDrafts'
import {
  CURSOR_AUTOMATION_TOOL_ID,
  type CursorAutomationPrSummary,
  type CursorAutomationResult,
  type CursorAutomationRuleCandidate,
  type CursorAutomationTask,
} from './cursorAutomation'
import type {
  CursorAutomationRawPrPayload,
  CursorAutomationRawResultPayload,
  CursorAutomationRuntimeReportPatch,
} from './cursorAutomationServiceAdapterTypes'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'ai-company-rule'
}

function buildRuleFileContent(candidate: KnowledgeCandidateDraft): string {
  return [
    '---',
    `description: ${candidate.summary.replace(/\n/g, ' ').slice(0, 200)}`,
    '---',
    '',
    `# ${candidate.title}`,
    '',
    candidate.content,
    '',
    `Source: knowledge-candidate ${candidate.id} · run ${candidate.runId}`,
  ].join('\n')
}

export function normalizeRawPrPayload(raw: CursorAutomationRawPrPayload | null | undefined): CursorAutomationPrSummary | null {
  if (!raw) return null
  return {
    number: typeof raw.number === 'number' ? raw.number : null,
    url: typeof raw.url === 'string' ? raw.url : null,
    title: typeof raw.title === 'string' ? raw.title : 'Cursor Automation PR',
    changedFiles: typeof raw.changedFiles === 'number' ? raw.changedFiles : 0,
    checksStatus:
      raw.checksStatus === 'passing' ||
      raw.checksStatus === 'failing' ||
      raw.checksStatus === 'pending'
        ? raw.checksStatus
        : 'unknown',
    reviewRequested: Boolean(raw.reviewRequested),
  }
}

export function extractPrFromRawPayload(raw: unknown): CursorAutomationPrSummary | null {
  if (raw == null || typeof raw !== 'object') return null
  const payload = raw as CursorAutomationRawResultPayload
  const prRaw = payload.prSummary ?? payload.pullRequest
  return normalizeRawPrPayload(prRaw ?? null)
}

export function mapPrToRuntimeReportPatch(
  task: CursorAutomationTask,
  pr: CursorAutomationPrSummary | null,
): CursorAutomationRuntimeReportPatch {
  if (!pr?.url) {
    return {
      section: 'tool_execution',
      summary: `Cursor Automation "${task.title}" finished without PR metadata.`,
      toolRegistryV1Id: CURSOR_AUTOMATION_TOOL_ID,
    }
  }

  return {
    section: 'tool_execution',
    summary: `Cursor Automation "${task.title}" opened PR (${pr.changedFiles} files). Review: ${pr.url}`,
    toolRegistryV1Id: CURSOR_AUTOMATION_TOOL_ID,
  }
}

export function mapResultToMemoryEvolutionHints(
  task: CursorAutomationTask,
  pr: CursorAutomationPrSummary | null,
): string[] {
  const hints = [
    `Handoff from ${task.requestedByEmployeeId} via Cursor Automation — validate PR before XP publish.`,
  ]

  if (pr?.checksStatus === 'failing' || pr?.checksStatus === 'pending') {
    hints.push('CI/checks not green — capture as improvement lesson after MAX review.')
  }

  if (pr?.url) {
    hints.push(`PR for review: ${pr.url}`)
  }

  return hints
}

export function mapResultToCursorRulesCandidates(
  knowledgeCandidates: KnowledgeCandidateDraft[],
): CursorAutomationRuleCandidate[] {
  return knowledgeCandidates.map((candidate, index) => ({
    id: `cursor-rule-${candidate.id}-${index}`,
    title: candidate.title,
    summary: candidate.summary,
    proposedPath: `.cursor/rules/${slugify(candidate.title)}.mdc`,
    content: buildRuleFileContent(candidate),
    sourceKnowledgeCandidateId: candidate.id,
    status: 'draft' as const,
  }))
}

export function buildNormalizedAutomationResult(input: {
  task: CursorAutomationTask
  pr: CursorAutomationPrSummary | null
  raw: unknown
  knowledgeCandidates?: KnowledgeCandidateDraft[]
  finishedAt: string
  errorMessage: string | null
}): CursorAutomationResult {
  const payload = (input.raw ?? {}) as CursorAutomationRawResultPayload
  const artifacts = Array.isArray(payload.artifacts)
    ? payload.artifacts.filter((item): item is string => typeof item === 'string')
    : []

  return {
    taskId: input.task.id,
    status: input.errorMessage ? 'failed' : 'completed',
    prSummary: input.pr,
    transcriptRef: typeof payload.transcriptRef === 'string' ? payload.transcriptRef : null,
    artifacts,
    ruleCandidates: mapResultToCursorRulesCandidates(input.knowledgeCandidates ?? []),
    runtimeReportPatch: mapPrToRuntimeReportPatch(input.task, input.pr),
    memoryEvolutionHints: mapResultToMemoryEvolutionHints(input.task, input.pr),
    finishedAt: input.finishedAt,
    errorMessage: input.errorMessage,
  }
}
