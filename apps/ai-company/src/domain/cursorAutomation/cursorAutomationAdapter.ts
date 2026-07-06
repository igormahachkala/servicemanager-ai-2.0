import type { KnowledgeCandidateDraft } from '../maxWorkerLoop/maxWorkerLoopDrafts'
import {
  CURSOR_AUTOMATION_TOOL_ID,
  type CursorAutomationIngestInput,
  type CursorAutomationPlanInput,
  type CursorAutomationPromptContext,
  type CursorAutomationResult,
  type CursorAutomationRuleCandidate,
  type CursorAutomationTask,
} from './cursorAutomation'
import { upsertCursorAutomationRun } from './cursorAutomationStorage'

const DEFAULT_REPOSITORY = {
  owner: 'igor',
  repo: 'servicemanager-ai-2.0',
  branch: 'ai-company-flow',
}

const DEFAULT_ENABLED_TOOLS = ['github', 'filesystem']

function nowIso(): string {
  return new Date().toISOString()
}

function createTaskId(): string {
  return `cursor-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Build a safe automation plan — no API call, no shell/git/docker.
 * Employee (MAX/Atlas/…) proposes; Owner approves before V2 execution.
 */
export function createCursorAutomationPlan(input: CursorAutomationPlanInput): CursorAutomationTask {
  const now = nowIso()
  const requiresOwnerApproval = input.requiresOwnerApproval ?? true

  const task: CursorAutomationTask = {
    id: createTaskId(),
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    trigger:
      input.trigger ??
      (input.runtimeRunId
        ? {
            kind: 'runtime-handoff',
            runtimeRunId: input.runtimeRunId,
            maxWorkerLoopId: input.maxWorkerLoopId ?? null,
            employeeId: input.requestedByEmployeeId,
          }
        : { kind: 'manual', requestedBy: 'employee' }),
    requestedByEmployeeId: input.requestedByEmployeeId,
    runtimeRunId: input.runtimeRunId ?? null,
    maxWorkerLoopId: input.maxWorkerLoopId ?? null,
    projectId: input.projectId ?? null,
    workspaceId: input.workspaceId ?? null,
    repository: {
      owner: input.repository?.owner ?? DEFAULT_REPOSITORY.owner,
      repo: input.repository?.repo ?? DEFAULT_REPOSITORY.repo,
      branch: input.repository?.branch ?? DEFAULT_REPOSITORY.branch,
    },
    enabledTools: input.enabledTools ?? DEFAULT_ENABLED_TOOLS,
    status: requiresOwnerApproval ? 'approval_pending' : 'planned',
    requiresOwnerApproval,
    toolRegistryV1Id: CURSOR_AUTOMATION_TOOL_ID,
    createdAt: now,
    updatedAt: now,
  }

  return upsertCursorAutomationRun(task)
}

/**
 * Structured prompt for Cursor Automation instructions field.
 * Local Ollama reasoning stays upstream — this is execution handoff text only.
 */
export function buildCursorAutomationPrompt(
  task: CursorAutomationTask,
  context: CursorAutomationPromptContext,
): string {
  const lines = [
    `# ${context.taskTitle}`,
    '',
    `Requested by digital employee: ${context.employeeCodename}`,
    `Owner goal: ${context.ownerGoal}`,
    '',
    '## Instructions',
    task.instructions,
    '',
    '## Expected outcome',
    context.expectedOutcome,
    '',
    '## Constraints',
    ...context.constraints.map((item) => `- ${item}`),
  ]

  if (context.priorReportSummary?.trim()) {
    lines.push('', '## Prior Runtime Report summary', context.priorReportSummary.trim())
  }

  lines.push(
    '',
    '## Repository scope',
    `${task.repository.owner}/${task.repository.repo} @ ${task.repository.branch}`,
    '',
    '## AI Company policy',
    '- Cursor Automation is an external executor; local Ollama remains the reasoning brain.',
    '- Do not modify DNS, servers, or production deploy without explicit Owner approval.',
    '- Return a PR summary suitable for MAX review and Runtime Report ingestion.',
  )

  return lines.join('\n')
}

function buildRuleCandidatesFromKnowledge(
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

/**
 * Normalize future Cursor API payload into AI Company shapes.
 * V1: returns scaffold result when raw is null/undefined.
 */
export function ingestCursorAutomationResult(
  params: CursorAutomationIngestInput,
  options?: {
    knowledgeCandidates?: KnowledgeCandidateDraft[]
  },
): CursorAutomationResult {
  const { task, raw } = params
  const finishedAt = nowIso()

  if (raw == null) {
    return {
      taskId: task.id,
      status: 'planned',
      prSummary: null,
      transcriptRef: null,
      artifacts: [],
      ruleCandidates: buildRuleCandidatesFromKnowledge(options?.knowledgeCandidates ?? []),
      runtimeReportPatch: {
        section: 'tool_execution',
        summary:
          'Cursor Automation planned (V1 scaffold) — execution adapter not connected; awaiting Owner approval.',
        toolRegistryV1Id: CURSOR_AUTOMATION_TOOL_ID,
      },
      memoryEvolutionHints: [
        'External executor handoff prepared — review PR outcome before Memory Evolution publish.',
      ],
      finishedAt: null,
      errorMessage: null,
    }
  }

  const payload = raw as Record<string, unknown>
  const pr = (payload.prSummary ?? payload.pullRequest) as Record<string, unknown> | undefined

  const result: CursorAutomationResult = {
    taskId: task.id,
    status: 'completed',
    prSummary: pr
      ? {
          number: typeof pr.number === 'number' ? pr.number : null,
          url: typeof pr.url === 'string' ? pr.url : null,
          title: typeof pr.title === 'string' ? pr.title : task.title,
          changedFiles: typeof pr.changedFiles === 'number' ? pr.changedFiles : 0,
          checksStatus:
            pr.checksStatus === 'passing' ||
            pr.checksStatus === 'failing' ||
            pr.checksStatus === 'pending'
              ? pr.checksStatus
              : 'unknown',
          reviewRequested: Boolean(pr.reviewRequested),
        }
      : null,
    transcriptRef: typeof payload.transcriptRef === 'string' ? payload.transcriptRef : null,
    artifacts: Array.isArray(payload.artifacts)
      ? payload.artifacts.filter((item): item is string => typeof item === 'string')
      : [],
    ruleCandidates: buildRuleCandidatesFromKnowledge(options?.knowledgeCandidates ?? []),
    runtimeReportPatch: {
      section: 'tool_execution',
      summary: buildRuntimeReportSummary(task, pr),
      toolRegistryV1Id: CURSOR_AUTOMATION_TOOL_ID,
    },
    memoryEvolutionHints: buildMemoryEvolutionHints(task, pr),
    finishedAt,
    errorMessage: typeof payload.error === 'string' ? payload.error : null,
  }

  upsertCursorAutomationRun({
    ...task,
    status: result.errorMessage ? 'failed' : 'completed',
    updatedAt: finishedAt,
  })

  return result
}

function buildRuntimeReportSummary(
  task: CursorAutomationTask,
  pr: Record<string, unknown> | undefined,
): string {
  if (!pr) {
    return `Cursor Automation "${task.title}" finished without PR metadata.`
  }
  const url = typeof pr.url === 'string' ? pr.url : '—'
  const files = typeof pr.changedFiles === 'number' ? pr.changedFiles : 0
  return `Cursor Automation "${task.title}" opened PR (${files} files). Review: ${url}`
}

function buildMemoryEvolutionHints(
  task: CursorAutomationTask,
  pr: Record<string, unknown> | undefined,
): string[] {
  const hints = [
    `Handoff from ${task.requestedByEmployeeId} via Cursor Automation — validate PR before XP publish.`,
  ]
  if (pr && typeof pr.checksStatus === 'string' && pr.checksStatus !== 'passing') {
    hints.push('CI/checks not green — capture as improvement lesson after MAX review.')
  }
  return hints
}
