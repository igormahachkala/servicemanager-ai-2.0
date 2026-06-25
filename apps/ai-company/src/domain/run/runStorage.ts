import { loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { RunArtifact } from './runArtifact'
import { RUN_ARTIFACT_KINDS } from './runArtifact'
import type {
  RunHistory,
  RunHistoryFilter,
  RunHistoryStats,
  RunHistoryStatus,
  RunContextLayer,
  RunTimelineEntry,
  RunWarning,
} from './runHistory'
import { RUN_HISTORY_STATUSES } from './runHistory'
import { computeDurationMs, emptyRunMetrics, type RunMetrics } from './runMetrics'
import type { RunStep, RunStepKind, RunStepStatus } from './runStep'
import { RUN_STEP_KINDS, RUN_STEP_STATUSES, createPendingRunSteps } from './runStep'

const STORAGE_KEY = 'ai-company-run-history'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): RunHistoryStatus | null {
  return typeof value === 'string' && (RUN_HISTORY_STATUSES as readonly string[]).includes(value)
    ? (value as RunHistoryStatus)
    : null
}

function parseStepStatus(value: unknown): RunStepStatus | null {
  return typeof value === 'string' && (RUN_STEP_STATUSES as readonly string[]).includes(value)
    ? (value as RunStepStatus)
    : null
}

function parseStepKind(value: unknown): RunStepKind | null {
  return typeof value === 'string' && (RUN_STEP_KINDS as readonly string[]).includes(value)
    ? (value as RunStepKind)
    : null
}

function parseStep(value: unknown): RunStep | null {
  if (!isRecord(value)) return null
  const kind = parseStepKind(value.kind)
  const status = parseStepStatus(value.status)
  if (!kind || !status || typeof value.id !== 'string' || typeof value.order !== 'number') {
    return null
  }
  return {
    id: value.id,
    kind,
    order: value.order,
    status,
    detail: typeof value.detail === 'string' ? value.detail : undefined,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
  }
}

function parseMetrics(value: unknown): RunMetrics {
  if (!isRecord(value)) return emptyRunMetrics()
  return {
    durationMs: typeof value.durationMs === 'number' ? value.durationMs : null,
    estimatedCost: typeof value.estimatedCost === 'number' ? value.estimatedCost : 0,
    estimatedTokens: typeof value.estimatedTokens === 'number' ? value.estimatedTokens : 0,
    memoryRecords: typeof value.memoryRecords === 'number' ? value.memoryRecords : 0,
    knowledgeRecords: typeof value.knowledgeRecords === 'number' ? value.knowledgeRecords : 0,
    toolCalls: typeof value.toolCalls === 'number' ? value.toolCalls : 0,
    warnings: typeof value.warnings === 'number' ? value.warnings : 0,
  }
}

function parseArtifactKind(value: unknown): RunArtifact['kind'] | null {
  return typeof value === 'string' && (RUN_ARTIFACT_KINDS as readonly string[]).includes(value)
    ? (value as RunArtifact['kind'])
    : null
}

function parseArtifact(value: unknown): RunArtifact | null {
  if (!isRecord(value)) return null
  const kind = parseArtifactKind(value.kind)
  if (!kind || typeof value.id !== 'string' || typeof value.label !== 'string') return null
  return {
    id: value.id,
    kind,
    label: value.label,
    refId: typeof value.refId === 'string' ? value.refId : null,
    placeholder: value.placeholder !== false,
  }
}

function parseWarning(value: unknown): RunWarning | null {
  if (!isRecord(value)) return null
  const severity = value.severity
  if (
    typeof value.id !== 'string' ||
    typeof value.code !== 'string' ||
    typeof value.message !== 'string' ||
    !['info', 'warn', 'error'].includes(String(severity))
  ) {
    return null
  }
  return {
    id: value.id,
    code: value.code,
    message: value.message,
    severity: severity as RunWarning['severity'],
  }
}

function parseContextLayer(value: unknown): RunContextLayer | null {
  if (!isRecord(value)) return null
  if (typeof value.key !== 'string' || typeof value.label !== 'string' || typeof value.summary !== 'string') {
    return null
  }
  return {
    key: value.key,
    label: value.label,
    loaded: value.loaded === true,
    itemCount: typeof value.itemCount === 'number' ? value.itemCount : 0,
    summary: value.summary,
  }
}

function parseTimelineEntry(value: unknown): RunTimelineEntry | null {
  if (!isRecord(value)) return null
  const kind = value.kind
  if (
    typeof value.id !== 'string' ||
    typeof value.timestamp !== 'string' ||
    typeof value.label !== 'string' ||
    !['step', 'warning', 'artifact', 'event'].includes(String(kind))
  ) {
    return null
  }
  return {
    id: value.id,
    timestamp: value.timestamp,
    label: value.label,
    kind: kind as RunTimelineEntry['kind'],
    detail: typeof value.detail === 'string' ? value.detail : undefined,
  }
}

function parseRunHistory(value: unknown): RunHistory | null {
  if (!isRecord(value)) return null
  const status = parseStatus(value.status)
  if (
    !status ||
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.startedAt !== 'string'
  ) {
    return null
  }

  const steps = Array.isArray(value.steps)
    ? value.steps.map(parseStep).filter((item): item is RunStep => item !== null)
    : []
  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.map(parseArtifact).filter((item): item is RunArtifact => item !== null)
    : []
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.map(parseWarning).filter((item): item is RunWarning => item !== null)
    : []
  const context = Array.isArray(value.context)
    ? value.context.map(parseContextLayer).filter((item): item is RunContextLayer => item !== null)
    : []
  const timeline = Array.isArray(value.timeline)
    ? value.timeline.map(parseTimelineEntry).filter((item): item is RunTimelineEntry => item !== null)
    : []

  return {
    id: value.id,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    employeeId: value.employeeId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    status,
    startedAt: value.startedAt,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    chatId: typeof value.chatId === 'string' ? value.chatId : null,
    modelId: typeof value.modelId === 'string' ? value.modelId : null,
    steps,
    metrics: parseMetrics(value.metrics),
    artifacts,
    warnings,
    context,
    timeline,
  }
}

export function loadRunHistory(): RunHistory[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseRunHistory)
      .filter((item): item is RunHistory => item !== null)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  } catch {
    return []
  }
}

export function saveRunHistory(runs: RunHistory[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
  } catch {
    /* noop */
  }
}

export function getRunHistoryById(id: string, runs?: RunHistory[]): RunHistory | null {
  const list = runs ?? loadRunHistory()
  return list.find((item) => item.id === id) ?? null
}

export function getRunHistoryByRuntimeRunId(
  runtimeRunId: string,
  runs?: RunHistory[],
): RunHistory | null {
  const list = runs ?? loadRunHistory()
  return list.find((item) => item.runtimeRunId === runtimeRunId) ?? null
}

export function getRunHistoryByReportId(reportId: string, runs?: RunHistory[]): RunHistory | null {
  const list = runs ?? loadRunHistory()
  return list.find((item) => item.reportId === reportId) ?? null
}

export function getRunHistoryForEmployee(employeeId: string, runs?: RunHistory[]): RunHistory[] {
  const list = runs ?? loadRunHistory()
  return list.filter((item) => item.employeeId === employeeId)
}

export function filterRunHistory(runs: RunHistory[], filter: RunHistoryFilter): RunHistory[] {
  return runs.filter((run) => {
    if (filter.status !== 'all' && run.status !== filter.status) return false
    if (filter.employeeId !== 'all' && run.employeeId !== filter.employeeId) return false
    if (filter.workspaceId === 'none' && run.workspaceId !== null) return false
    if (
      filter.workspaceId !== 'all' &&
      filter.workspaceId !== 'none' &&
      run.workspaceId !== filter.workspaceId
    ) {
      return false
    }
    return true
  })
}

export function searchRunHistory(runs: RunHistory[], query: string): RunHistory[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return runs
  return runs.filter((run) => {
    const haystack = [
      run.id,
      run.runtimeRunId ?? '',
      run.employeeId,
      run.workspaceId ?? '',
      run.reportId ?? '',
      run.modelId ?? '',
      run.status,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

export function computeRunHistoryStats(runs: RunHistory[]): RunHistoryStats {
  return {
    total: runs.length,
    completed: runs.filter((item) => item.status === 'completed').length,
    running: runs.filter((item) => item.status === 'running' || item.status === 'queued').length,
    waitingApproval: runs.filter((item) => item.status === 'waiting_approval').length,
    failed: runs.filter((item) => item.status === 'failed').length,
    cancelled: runs.filter((item) => item.status === 'cancelled').length,
  }
}

function mapRuntimeStatus(status: RuntimeRun['status']): RunHistoryStatus {
  if (status === 'preparing_context') return 'running'
  return status
}

function mapRuntimeStepToKind(stepId: string): RunStepKind | null {
  const map: Record<string, RunStepKind> = {
    load_employee: 'context_loaded',
    load_workspace: 'context_loaded',
    load_memory: 'memory_loaded',
    load_knowledge: 'knowledge_loaded',
    load_runtime_profile: 'context_loaded',
    run_model_router: 'model_selected',
    approval_check: 'approval_requested',
    create_run: 'execution_started',
    create_report: 'report_generated',
    emit_event: 'events_created',
    complete: 'execution_finished',
  }
  return map[stepId] ?? null
}

function buildStepsFromRuntimeRun(run: RuntimeRun): RunStep[] {
  const steps = createPendingRunSteps()
  const completedAt = run.finishedAt ?? run.startedAt

  for (const pipelineStep of run.pipeline) {
    const kind = mapRuntimeStepToKind(pipelineStep.id)
    if (!kind) continue
    const index = steps.findIndex((item) => item.kind === kind)
    if (index === -1) continue
    steps[index] = {
      ...steps[index],
      status: pipelineStep.status === 'failed' ? 'failed' : pipelineStep.status,
      detail: pipelineStep.detail,
      completedAt: pipelineStep.status === 'done' ? completedAt : null,
    }
  }

  return steps
}

function buildContextFromRuntimeRun(run: RuntimeRun): RunContextLayer[] {
  return run.context.layers.map((layer) => ({
    key: layer.key,
    label: layer.key.replace(/_/g, ' '),
    loaded: layer.loaded,
    itemCount: layer.itemCount,
    summary: layer.summary,
  }))
}

function buildTimelineFromRun(run: RunHistory): RunTimelineEntry[] {
  const entries: RunTimelineEntry[] = [
    {
      id: `${run.id}-started`,
      timestamp: run.startedAt,
      label: 'Run started',
      kind: 'event',
      detail: run.status,
    },
  ]

  for (const step of run.steps.filter((item) => item.status === 'done' || item.status === 'failed')) {
    entries.push({
      id: `${run.id}-${step.kind}`,
      timestamp: step.completedAt ?? run.startedAt,
      label: step.kind,
      kind: 'step',
      detail: step.detail,
    })
  }

  for (const warning of run.warnings) {
    entries.push({
      id: warning.id,
      timestamp: run.startedAt,
      label: warning.message,
      kind: 'warning',
      detail: warning.code,
    })
  }

  if (run.finishedAt) {
    entries.push({
      id: `${run.id}-finished`,
      timestamp: run.finishedAt,
      label: 'Run finished',
      kind: 'event',
      detail: run.status,
    })
  }

  return entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
}

/** Future Runtime entry point — append or update a run history record. */
export function recordRunHistory(entry: RunHistory): RunHistory {
  const runs = loadRunHistory().filter((item) => item.id !== entry.id)
  const withTimeline =
    entry.timeline.length > 0 ? entry : { ...entry, timeline: buildTimelineFromRun(entry) }
  saveRunHistory([withTimeline, ...runs])
  return withTimeline
}

export function mapRuntimeRunToRunHistory(run: RuntimeRun): RunHistory {
  const warnings: RunWarning[] =
    run.result?.warnings.map((item, index) => ({
      id: `warn-${run.id}-${index}`,
      code: item.code,
      message: item.message,
      severity: item.severity,
    })) ?? []

  const artifacts: RunArtifact[] =
    run.result?.artifacts.map((item, index) => ({
      id: item.id || `artifact-${run.id}-${index}`,
      kind: item.kind === 'report' ? 'generated_report' : 'generated_document',
      label: item.label,
      refId: item.refId,
      placeholder: item.kind !== 'report',
    })) ?? []

  const steps = buildStepsFromRuntimeRun(run)
  const finishedAt = run.finishedAt
  const metrics: RunMetrics = {
    durationMs: computeDurationMs(run.startedAt, finishedAt),
    estimatedCost: run.result?.estimatedCost ?? 0,
    estimatedTokens: run.result?.estimatedTokens ?? 0,
    memoryRecords: run.result?.memoryUsed ?? 0,
    knowledgeRecords: run.result?.knowledgeUsed ?? 0,
    toolCalls: 0,
    warnings: warnings.length,
  }

  const history: RunHistory = {
    id: `rh-${run.id}`,
    runtimeRunId: run.id,
    employeeId: run.employeeId,
    workspaceId: run.workspaceId,
    status: mapRuntimeStatus(run.status),
    startedAt: run.startedAt,
    finishedAt,
    reportId: run.reportId,
    taskId: run.taskId,
    chatId: run.chatId,
    modelId: run.modelId,
    steps,
    metrics,
    artifacts,
    warnings,
    context: buildContextFromRuntimeRun(run),
    timeline: [],
  }

  history.timeline = buildTimelineFromRun(history)
  return history
}

export function syncRunHistoryFromRuntime(): void {
  const runtimeRuns = loadRuntimeRuns()
  if (runtimeRuns.length === 0) return

  const existing = loadRunHistory()
  const byRuntimeId = new Map(
    existing
      .filter((item) => item.runtimeRunId)
      .map((item) => [item.runtimeRunId as string, item]),
  )

  let changed = false
  const merged = [...existing]

  for (const runtimeRun of runtimeRuns) {
    if (byRuntimeId.has(runtimeRun.id)) {
      const index = merged.findIndex((item) => item.runtimeRunId === runtimeRun.id)
      if (index >= 0) {
        merged[index] = mapRuntimeRunToRunHistory(runtimeRun)
        changed = true
      }
      continue
    }
    merged.push(mapRuntimeRunToRunHistory(runtimeRun))
    changed = true
  }

  if (changed) {
    saveRunHistory(
      merged.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    )
  }
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString()
}

function minutesAfter(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString()
}

function buildSeedSteps(
  startedAt: string,
  finishedAt: string | null,
  pattern: 'full' | 'approval' | 'failed',
): RunStep[] {
  const steps = createPendingRunSteps()
  const mark = (kind: RunStepKind, status: RunStepStatus, detail?: string) => {
    const index = steps.findIndex((item) => item.kind === kind)
    if (index === -1) return
    steps[index] = {
      ...steps[index],
      status,
      detail,
      completedAt: status === 'done' || status === 'failed' ? finishedAt ?? startedAt : null,
    }
  }

  mark('context_loaded', 'done', 'Employee profile + workspace scope')
  mark('knowledge_loaded', 'done', '6 published knowledge items')
  mark('memory_loaded', 'done', '12 memory entries (read-only)')

  if (pattern === 'failed') {
    mark('model_selected', 'failed', 'Model Router — no eligible model')
    mark('approval_requested', 'skipped')
    mark('execution_started', 'skipped')
    mark('execution_finished', 'skipped')
    mark('report_generated', 'skipped')
    mark('events_created', 'skipped')
    return steps
  }

  mark('model_selected', 'done', 'qwen2.5-coder-32b · cost-optimized route')

  if (pattern === 'approval') {
    mark('approval_requested', 'active', 'Owner approval required')
    mark('execution_started', 'pending')
    mark('execution_finished', 'pending')
    mark('report_generated', 'pending')
    mark('events_created', 'pending')
    return steps
  }

  mark('approval_requested', 'done', 'No approval gate')
  mark('execution_started', 'done', 'Mock orchestrator — no LLM inference')
  mark('execution_finished', 'done', 'Pipeline complete')
  mark('report_generated', 'done', 'report-arch-v1')
  mark('events_created', 'done', 'runtime.started + run.completed')
  return steps
}

function buildSeedContext(): RunContextLayer[] {
  return [
    { key: 'employee_profile', label: 'Employee profile', loaded: true, itemCount: 1, summary: 'Atlas · Solution Architect' },
    { key: 'memory', label: 'Memory', loaded: true, itemCount: 12, summary: '12 entries (read-only)' },
    { key: 'knowledge', label: 'Knowledge', loaded: true, itemCount: 6, summary: '6 published items' },
    { key: 'workspace', label: 'Workspace', loaded: true, itemCount: 1, summary: 'ws-sma · ServiceManager' },
    { key: 'tools', label: 'Tools', loaded: true, itemCount: 4, summary: 'GitHub, Linear, Docs, CI' },
  ]
}

function buildSeedArtifacts(reportId: string | null, placeholderOnly = false): RunArtifact[] {
  const items: RunArtifact[] = [
    {
      id: 'art-summary',
      kind: 'generated_summary',
      label: 'Executive summary (placeholder)',
      refId: null,
      placeholder: true,
    },
    {
      id: 'art-adr',
      kind: 'generated_adr',
      label: 'ADR draft (placeholder)',
      refId: null,
      placeholder: true,
    },
  ]
  if (reportId && !placeholderOnly) {
    items.unshift({
      id: 'art-report',
      kind: 'generated_report',
      label: 'Runtime run report',
      refId: reportId,
      placeholder: false,
    })
  }
  return items
}

export function ensureSeedRunHistory(): RunHistory[] {
  syncRunHistoryFromRuntime()
  if (loadRunHistory().length > 0) return loadRunHistory()

  const started1 = hoursAgo(48)
  const finished1 = minutesAfter(started1, 4)
  const started2 = hoursAgo(24)
  const finished2 = minutesAfter(started2, 3)
  const started3 = hoursAgo(6)
  const started4 = hoursAgo(2)
  const finished4 = minutesAfter(started4, 1)

  const seeds: RunHistory[] = [
    {
      id: 'run-hist-001',
      runtimeRunId: 'run-seed-arch-001',
      employeeId: 'ag-arch',
      workspaceId: 'ws-sma',
      status: 'completed',
      startedAt: started1,
      finishedAt: finished1,
      reportId: 'report-arch-v1',
      taskId: 'task-arch-review',
      chatId: null,
      modelId: 'qwen2.5-coder-32b',
      steps: buildSeedSteps(started1, finished1, 'full'),
      metrics: {
        durationMs: computeDurationMs(started1, finished1),
        estimatedCost: 0.012,
        estimatedTokens: 4096,
        memoryRecords: 12,
        knowledgeRecords: 6,
        toolCalls: 2,
        warnings: 1,
      },
      artifacts: buildSeedArtifacts('report-arch-v1'),
      warnings: [
        {
          id: 'warn-001',
          code: 'MOCK_EXECUTION',
          message: 'Mock orchestrator — no provider inference in V1.',
          severity: 'info',
        },
      ],
      context: buildSeedContext(),
      timeline: [],
    },
    {
      id: 'run-hist-002',
      runtimeRunId: 'run-seed-cto-002',
      employeeId: 'ag-cto',
      workspaceId: null,
      status: 'completed',
      startedAt: started2,
      finishedAt: finished2,
      reportId: 'report-system-foundation',
      taskId: null,
      chatId: null,
      modelId: 'claude-sonnet',
      steps: buildSeedSteps(started2, finished2, 'full'),
      metrics: {
        durationMs: computeDurationMs(started2, finished2),
        estimatedCost: 0.028,
        estimatedTokens: 6144,
        memoryRecords: 8,
        knowledgeRecords: 4,
        toolCalls: 0,
        warnings: 0,
      },
      artifacts: buildSeedArtifacts('report-system-foundation'),
      warnings: [],
      context: buildSeedContext(),
      timeline: [],
    },
    {
      id: 'run-hist-003',
      runtimeRunId: 'run-seed-devops-003',
      employeeId: 'ag-devops',
      workspaceId: 'ws-sma',
      status: 'waiting_approval',
      startedAt: started3,
      finishedAt: null,
      reportId: null,
      taskId: 'task-deploy-staging',
      chatId: null,
      modelId: 'gpt-4o-mini',
      steps: buildSeedSteps(started3, null, 'approval'),
      metrics: {
        durationMs: null,
        estimatedCost: 0.006,
        estimatedTokens: 2048,
        memoryRecords: 5,
        knowledgeRecords: 3,
        toolCalls: 1,
        warnings: 1,
      },
      artifacts: buildSeedArtifacts(null, true),
      warnings: [
        {
          id: 'warn-003',
          code: 'APPROVAL_REQUIRED',
          message: 'Run paused — Owner approval required before execution.',
          severity: 'warn',
        },
      ],
      context: buildSeedContext(),
      timeline: [],
    },
    {
      id: 'run-hist-004',
      runtimeRunId: 'run-seed-max-004',
      employeeId: 'ag-max',
      workspaceId: 'ws-sma',
      status: 'failed',
      startedAt: started4,
      finishedAt: finished4,
      reportId: null,
      taskId: null,
      chatId: 'chat-seed-001',
      modelId: null,
      steps: buildSeedSteps(started4, finished4, 'failed'),
      metrics: {
        durationMs: computeDurationMs(started4, finished4),
        estimatedCost: 0,
        estimatedTokens: 512,
        memoryRecords: 3,
        knowledgeRecords: 2,
        toolCalls: 0,
        warnings: 1,
      },
      artifacts: buildSeedArtifacts(null, true),
      warnings: [
        {
          id: 'warn-004',
          code: 'NO_MODEL',
          message: 'Model Router could not select a model for this run.',
          severity: 'error',
        },
      ],
      context: buildSeedContext(),
      timeline: [],
    },
  ]

  const withTimelines = seeds.map((run) => ({ ...run, timeline: buildTimelineFromRun(run) }))
  saveRunHistory(withTimelines)
  return withTimelines
}

export type {
  RunHistory,
  RunHistoryFilter,
  RunHistoryStats,
  RunHistoryStatus,
  RunContextLayer,
  RunTimelineEntry,
  RunWarning,
} from './runHistory'
export type { RunStep, RunStepKind, RunStepStatus } from './runStep'
export type { RunArtifact, RunArtifactKind } from './runArtifact'
export type { RunMetrics } from './runMetrics'
