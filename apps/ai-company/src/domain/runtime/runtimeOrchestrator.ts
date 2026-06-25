import { emitEvent } from '../events/eventStorage'
import { getEmployeeCompetencySnapshot } from '../competencies/competencyStorage'
import { recordRuntimeLearning } from '../learning/learningStorage'
import { getChatById } from '../chats/chatStorage'
import { ensureSeedMemories, getMemoriesByEmployee } from '../memory/memory'
import { queryKnowledgeForRuntime } from '../knowledge/knowledgeStorage'
import { loadReports, saveReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { DEFAULT_COMPANY_ID } from '../projects/project'
import { getWorkspaceById } from '../workspaces/workspace'
import { resolveEmployee } from '../../mission-control/data/conversation'
import {
  loadCustomEmployees,
  type CustomEmployee,
} from '../../mission-control/data/customEmployees'
import { agents, tasks } from '../../mission-control/data/mock'
import type { RuntimeContext, RuntimeContextLayer } from './runtimeContext'
import { RUNTIME_CONTEXT_LAYER_ORDER } from './runtimeContext'
import type { RuntimeResult, RuntimeArtifact, RuntimeWarning } from './runtimeResult'
import type { RuntimeRun } from './runtimeRun'
import {
  getModelById,
  getOrCreateRuntimeProfile,
  getProviderForModel,
  selectModelForTask,
  type TaskContext,
  type TaskType,
} from './runtimeStorage'
import type { RuntimePipelineStep, RuntimeRunState } from './runtimeState'
import { mapRuntimeRunToRunHistory, recordRunHistory } from '../run/runStorage'

const STORAGE_KEY = 'ai-company-runtime-runs'

const PIPELINE_STEP_IDS = [
  'receive_request',
  'load_employee',
  'load_workspace',
  'load_memory',
  'load_knowledge',
  'load_competencies',
  'load_runtime_profile',
  'run_model_router',
  'approval_check',
  'create_run',
  'emit_event',
  'create_report',
  'complete',
] as const

export type RuntimeRunRequest = {
  employeeId: string
  workspaceId?: string | null
  taskId?: string | null
  chatId?: string | null
  taskType?: TaskType
  hasSensitiveData?: boolean
  requiresExternalTools?: boolean
  forceApproval?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRuntimeRunState(value: unknown): RuntimeRunState | null {
  const states: RuntimeRunState[] = [
    'queued',
    'preparing_context',
    'waiting_approval',
    'running',
    'completed',
    'cancelled',
    'failed',
  ]
  return typeof value === 'string' && states.includes(value as RuntimeRunState)
    ? (value as RuntimeRunState)
    : null
}

function parsePipelineStep(value: unknown): RuntimePipelineStep | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.order !== 'number') return null
  const status = value.status
  if (!['pending', 'active', 'done', 'skipped', 'failed'].includes(String(status))) return null
  return {
    id: value.id,
    order: value.order,
    status: status as RuntimePipelineStep['status'],
    detail: typeof value.detail === 'string' ? value.detail : undefined,
  }
}

function parseRuntimeContext(value: unknown): RuntimeContext | null {
  if (!isRecord(value)) return null
  if (typeof value.employeeId !== 'string' || typeof value.builtAt !== 'string') return null
  const layers = Array.isArray(value.layers)
    ? value.layers
        .map((layer): RuntimeContextLayer | null => {
          if (!isRecord(layer)) return null
          if (typeof layer.key !== 'string' || typeof layer.summary !== 'string') return null
          return {
            key: layer.key as RuntimeContextLayer['key'],
            loaded: layer.loaded === true,
            itemCount: typeof layer.itemCount === 'number' ? layer.itemCount : 0,
            summary: layer.summary,
          }
        })
        .filter((item): item is RuntimeContextLayer => item !== null)
    : []
  return {
    employeeId: value.employeeId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    chatId: typeof value.chatId === 'string' ? value.chatId : null,
    layers,
    builtAt: value.builtAt,
  }
}

function parseRuntimeResult(value: unknown): RuntimeResult | null {
  if (!isRecord(value)) return null
  if (typeof value.selectedModel !== 'string' || typeof value.selectedProvider !== 'string') {
    return null
  }
  return {
    selectedModel: value.selectedModel,
    selectedProvider: value.selectedProvider,
    contextSize: typeof value.contextSize === 'number' ? value.contextSize : 0,
    knowledgeUsed: typeof value.knowledgeUsed === 'number' ? value.knowledgeUsed : 0,
    memoryUsed: typeof value.memoryUsed === 'number' ? value.memoryUsed : 0,
    estimatedCost: typeof value.estimatedCost === 'number' ? value.estimatedCost : 0,
    estimatedTokens: typeof value.estimatedTokens === 'number' ? value.estimatedTokens : 0,
    warnings: Array.isArray(value.warnings)
      ? value.warnings
          .map((item): RuntimeWarning | null => {
            if (!isRecord(item)) return null
            if (typeof item.code !== 'string' || typeof item.message !== 'string') return null
            const severity = item.severity
            if (!['info', 'warn', 'error'].includes(String(severity))) return null
            return {
              code: item.code,
              message: item.message,
              severity: severity as RuntimeWarning['severity'],
            }
          })
          .filter((item): item is RuntimeWarning => item !== null)
      : [],
    artifacts: Array.isArray(value.artifacts)
      ? value.artifacts
          .map((item): RuntimeArtifact | null => {
            if (!isRecord(item)) return null
            if (
              typeof item.id !== 'string' ||
              typeof item.label !== 'string' ||
              typeof item.refId !== 'string'
            ) {
              return null
            }
            const kind = item.kind
            if (!['report', 'event', 'context_snapshot'].includes(String(kind))) return null
            return {
              id: item.id,
              kind: kind as RuntimeArtifact['kind'],
              label: item.label,
              refId: item.refId,
            }
          })
          .filter((item): item is RuntimeArtifact => item !== null)
      : [],
  }
}

function parseRuntimeRun(value: unknown): RuntimeRun | null {
  if (!isRecord(value)) return null
  const status = parseRuntimeRunState(value.status)
  const context = parseRuntimeContext(value.context)
  if (
    !status ||
    !context ||
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.runtimeProfileId !== 'string' ||
    typeof value.modelId !== 'string' ||
    typeof value.providerId !== 'string' ||
    typeof value.startedAt !== 'string'
  ) {
    return null
  }

  const pipeline = Array.isArray(value.pipeline)
    ? value.pipeline
        .map(parsePipelineStep)
        .filter((item): item is RuntimePipelineStep => item !== null)
    : []

  return {
    id: value.id,
    employeeId: value.employeeId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    runtimeProfileId: value.runtimeProfileId,
    modelId: value.modelId,
    providerId: value.providerId,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    chatId: typeof value.chatId === 'string' ? value.chatId : null,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    status,
    startedAt: value.startedAt,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    context,
    pipeline,
    result: value.result ? parseRuntimeResult(value.result) : null,
  }
}

export function loadRuntimeRuns(): RuntimeRun[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseRuntimeRun)
      .filter((item): item is RuntimeRun => item !== null)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  } catch {
    return []
  }
}

export function saveRuntimeRuns(runs: RuntimeRun[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
  } catch {
    /* noop */
  }
}

export function getRuntimeRunById(id: string): RuntimeRun | null {
  return loadRuntimeRuns().find((item) => item.id === id) ?? null
}

function upsertRuntimeRun(run: RuntimeRun): RuntimeRun {
  saveRuntimeRuns([run, ...loadRuntimeRuns().filter((item) => item.id !== run.id)])
  recordRunHistory(mapRuntimeRunToRunHistory(run))
  return run
}

function createInitialPipeline(): RuntimePipelineStep[] {
  return PIPELINE_STEP_IDS.map((id, index) => ({
    id,
    order: index + 1,
    status: 'pending' as const,
  }))
}

function updatePipelineStep(
  pipeline: RuntimePipelineStep[],
  stepId: string,
  status: RuntimePipelineStep['status'],
  detail?: string,
): RuntimePipelineStep[] {
  return pipeline.map((step) =>
    step.id === stepId ? { ...step, status, detail: detail ?? step.detail } : step,
  )
}

function resolveCustomEmployee(employeeId: string): CustomEmployee | null {
  return loadCustomEmployees().find((item) => item.id === employeeId) ?? null
}

function resolveBuiltinModel(employeeId: string): string {
  return agents.find((item) => item.id === employeeId)?.model ?? 'Mock Local Model'
}

function resolveEmployeeTools(employeeId: string): string[] {
  const custom = resolveCustomEmployee(employeeId)
  if (custom) return custom.tools
  return agents.find((item) => item.id === employeeId)?.tools ?? []
}

function resolveEmployeePermissionsSummary(employeeId: string): string {
  const custom = resolveCustomEmployee(employeeId)
  if (!custom) return 'Builtin agent — platform defaults'
  const enabled = Object.entries(custom.permissions)
    .filter(([, value]) => value === true || (typeof value === 'object' && value.read))
    .map(([key]) => key)
  return enabled.length > 0 ? enabled.join(', ') : 'No integrations enabled'
}

function buildRuntimeContext(input: RuntimeRunRequest): RuntimeContext {
  const employee = resolveEmployee(input.employeeId)
  const custom = resolveCustomEmployee(input.employeeId)
  const workspace = input.workspaceId ? getWorkspaceById(input.workspaceId) : null
  ensureSeedMemories(input.employeeId)
  const memories = getMemoriesByEmployee(input.employeeId)
  const knowledge = queryKnowledgeForRuntime({ workspaceId: input.workspaceId ?? null })
  const competencies = getEmployeeCompetencySnapshot(input.employeeId)
  const chat = input.chatId ? getChatById(input.chatId) : null
  const task = input.taskId ? tasks.find((item) => item.id === input.taskId) ?? null : null
  const profile = getOrCreateRuntimeProfile(
    input.employeeId,
    custom?.primaryModel ?? resolveBuiltinModel(input.employeeId),
  )

  const layers: RuntimeContextLayer[] = [
    {
      key: 'employee_profile',
      loaded: employee !== null,
      itemCount: 1,
      summary: employee ? `${employee.codename} · ${employee.role}` : 'Employee not found',
    },
    {
      key: 'memory',
      loaded: memories.length > 0,
      itemCount: memories.length,
      summary: `${memories.length} memory entries (read-only)`,
    },
    {
      key: 'knowledge',
      loaded: knowledge.length > 0,
      itemCount: knowledge.length,
      summary: `${knowledge.length} published knowledge items`,
    },
    {
      key: 'competencies',
      loaded: competencies.skills.length > 0,
      itemCount: competencies.skills.length,
      summary: `${competencies.skills.length} skills · trust ${competencies.reputation.trustScore}`,
    },
    {
      key: 'workspace',
      loaded: workspace !== null,
      itemCount: workspace ? 1 : 0,
      summary: workspace ? workspace.name : 'No workspace scope',
    },
    {
      key: 'permissions',
      loaded: true,
      itemCount: 1,
      summary: resolveEmployeePermissionsSummary(input.employeeId),
    },
    {
      key: 'tools',
      loaded: true,
      itemCount: resolveEmployeeTools(input.employeeId).length,
      summary: resolveEmployeeTools(input.employeeId).join(', ') || 'No tools',
    },
    {
      key: 'conversation',
      loaded: chat !== null,
      itemCount: chat?.messages.length ?? 0,
      summary: chat ? `${chat.type} · ${chat.messages.length} messages` : 'No chat context',
    },
    {
      key: 'current_task',
      loaded: task !== null,
      itemCount: task ? 1 : 0,
      summary: task ? `${task.id} · ${task.title}` : 'No task linked',
    },
    {
      key: 'runtime_profile',
      loaded: true,
      itemCount: 1,
      summary: `${profile.primaryModelId} · ${profile.routingRules.length} routes`,
    },
  ]

  return {
    employeeId: input.employeeId,
    workspaceId: input.workspaceId ?? null,
    taskId: input.taskId ?? null,
    chatId: input.chatId ?? null,
    layers: RUNTIME_CONTEXT_LAYER_ORDER.map(
      (key) => layers.find((layer) => layer.key === key) ?? {
        key,
        loaded: false,
        itemCount: 0,
        summary: 'Not loaded',
      },
    ),
    builtAt: new Date().toISOString(),
  }
}

function estimateTokens(context: RuntimeContext, profileMaxTokens: number): number {
  const layerTokens = context.layers.reduce((sum, layer) => sum + layer.itemCount * 120, 0)
  return Math.min(profileMaxTokens, Math.max(512, layerTokens))
}

function estimateCost(modelId: string, tokens: number): number {
  const model = getModelById(modelId)
  if (!model || model.costPer1kTokens === null) return 0
  return (tokens / 1000) * model.costPer1kTokens
}

function createRuntimeReport(
  run: RuntimeRun,
  result: RuntimeResult,
  employeeName: string,
): Report {
  const now = new Date().toISOString()
  const report: Report = {
    id: `report-run-${run.id}`,
    companyId: DEFAULT_COMPANY_ID,
    title: `Runtime run · ${employeeName}`,
    type: 'system',
    employeeId: run.employeeId,
    workspaceId: run.workspaceId,
    summary: `Mock orchestrator run completed via Model Router (${result.selectedModel}). No LLM inference in V1.`,
    findings: [
      `Model ${result.selectedModel} selected through Model Router`,
      `Context assembled from ${result.contextSize} layers`,
      `${result.knowledgeUsed} knowledge items referenced`,
      `${result.memoryUsed} memory entries referenced`,
    ],
    risks: result.warnings.filter((item) => item.severity === 'warn' || item.severity === 'error').map(
      (item) => item.message,
    ),
    recommendations: ['Review generated report before promoting to published status.'],
    evidence: [
      {
        id: `ev-run-${run.id}`,
        label: 'Runtime run',
        kind: 'artifact',
        value: run.id,
      },
    ],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  saveReports([report, ...loadReports()])
  return report
}

/** Single entry point — all future model execution must go through this orchestrator. */
export function orchestrateRuntimeRun(request: RuntimeRunRequest): RuntimeRun {
  const startedAt = new Date().toISOString()
  let pipeline = createInitialPipeline()
  const warnings: RuntimeWarning[] = []

  pipeline = updatePipelineStep(pipeline, 'receive_request', 'done', 'Request accepted')

  const employee = resolveEmployee(request.employeeId)
  if (!employee) {
    const failedRun: RuntimeRun = {
      id: `run-${Date.now()}`,
      employeeId: request.employeeId,
      workspaceId: request.workspaceId ?? null,
      runtimeProfileId: 'missing',
      modelId: 'missing',
      providerId: 'missing',
      taskId: request.taskId ?? null,
      chatId: request.chatId ?? null,
      reportId: null,
      status: 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      context: {
        employeeId: request.employeeId,
        workspaceId: request.workspaceId ?? null,
        taskId: request.taskId ?? null,
        chatId: request.chatId ?? null,
        layers: [],
        builtAt: startedAt,
      },
      pipeline: updatePipelineStep(pipeline, 'load_employee', 'failed', 'Employee not found'),
      result: null,
    }
    return upsertRuntimeRun(failedRun)
  }

  pipeline = updatePipelineStep(pipeline, 'load_employee', 'done', employee.codename)

  const workspace = request.workspaceId ? getWorkspaceById(request.workspaceId) : null
  pipeline = updatePipelineStep(
    pipeline,
    'load_workspace',
    workspace || !request.workspaceId ? 'done' : 'skipped',
    workspace?.name ?? 'No workspace',
  )

  ensureSeedMemories(request.employeeId)
  const memories = getMemoriesByEmployee(request.employeeId)
  pipeline = updatePipelineStep(
    pipeline,
    'load_memory',
    'done',
    `${memories.length} entries (read-only)`,
  )

  const knowledge = queryKnowledgeForRuntime({ workspaceId: request.workspaceId ?? null })
  pipeline = updatePipelineStep(
    pipeline,
    'load_knowledge',
    'done',
    `${knowledge.length} published items`,
  )

  const competencies = getEmployeeCompetencySnapshot(request.employeeId)
  pipeline = updatePipelineStep(
    pipeline,
    'load_competencies',
    'done',
    `${competencies.skills.length} skills`,
  )

  const custom = resolveCustomEmployee(request.employeeId)
  const profile = getOrCreateRuntimeProfile(
    request.employeeId,
    custom?.primaryModel ?? resolveBuiltinModel(request.employeeId),
  )
  pipeline = updatePipelineStep(
    pipeline,
    'load_runtime_profile',
    'done',
    profile.id,
  )

  const context = buildRuntimeContext(request)
  const estimatedTokens = estimateTokens(context, profile.maxTokens)
  const taskContext: TaskContext = {
    taskType: request.taskType ?? (request.taskId ? 'general' : 'conversation'),
    hasSensitiveData: request.hasSensitiveData ?? false,
    estimatedTokens,
    requiresTools: true,
    requiresExternalTools: request.requiresExternalTools ?? false,
  }

  const selection = selectModelForTask(profile, taskContext)
  if (!selection) {
    warnings.push({
      code: 'NO_MODEL',
      message: 'Model Router could not select a model for this run.',
      severity: 'error',
    })
    const failedRun: RuntimeRun = {
      id: `run-${Date.now()}`,
      employeeId: request.employeeId,
      workspaceId: request.workspaceId ?? null,
      runtimeProfileId: profile.id,
      modelId: profile.primaryModelId,
      providerId: getProviderForModel(profile.primaryModelId)?.id ?? 'unknown',
      taskId: request.taskId ?? null,
      chatId: request.chatId ?? null,
      reportId: null,
      status: 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      context,
      pipeline: updatePipelineStep(pipeline, 'run_model_router', 'failed', 'No model selected'),
      result: null,
    }
    return upsertRuntimeRun(failedRun)
  }

  pipeline = updatePipelineStep(
    pipeline,
    'run_model_router',
    'done',
    `${selection.selectedModelId} · ${selection.reason}`,
  )

  const requiresApproval = request.forceApproval === true || selection.requiresApproval
  pipeline = updatePipelineStep(
    pipeline,
    'approval_check',
    requiresApproval ? 'active' : 'done',
    requiresApproval ? 'Owner approval required' : 'No approval gate',
  )

  if (requiresApproval) {
    warnings.push({
      code: 'APPROVAL_REQUIRED',
      message: 'Run paused — Owner approval required before mock execution.',
      severity: 'warn',
    })
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  let status: RuntimeRunState = requiresApproval ? 'waiting_approval' : 'running'
  pipeline = updatePipelineStep(pipeline, 'create_run', 'done', runId)

  emitEvent({
    type: 'runtime.started',
    sourceType: 'runtime',
    sourceId: runId,
    employeeId: request.employeeId,
    workspaceId: request.workspaceId ?? null,
    reportId: null,
    metadata: {
      modelId: selection.selectedModelId,
      providerId: selection.selectedProviderId,
      mock: true,
    },
    severity: 'info',
  })
  pipeline = updatePipelineStep(pipeline, 'emit_event', 'done', 'runtime.started emitted')

  let reportId: string | null = null
  let result: RuntimeResult | null = null
  let finishedAt: string | null = null

  if (!requiresApproval) {
    status = 'running'
    const artifacts: RuntimeArtifact[] = [
      {
        id: `artifact-ctx-${runId}`,
        kind: 'context_snapshot',
        label: 'Context snapshot',
        refId: runId,
      },
    ]

    result = {
      selectedModel: selection.selectedModelId,
      selectedProvider: selection.selectedProviderId,
      contextSize: context.layers.filter((layer) => layer.loaded).length,
      knowledgeUsed: knowledge.length,
      memoryUsed: memories.length,
      estimatedCost: estimateCost(selection.selectedModelId, estimatedTokens),
      estimatedTokens,
      warnings,
      artifacts,
    }

    const report = createRuntimeReport(
      {
        id: runId,
        employeeId: request.employeeId,
        workspaceId: request.workspaceId ?? null,
        runtimeProfileId: profile.id,
        modelId: selection.selectedModelId,
        providerId: selection.selectedProviderId,
        taskId: request.taskId ?? null,
        chatId: request.chatId ?? null,
        reportId: null,
        status: 'running',
        startedAt,
        finishedAt: null,
        context,
        pipeline,
        result,
      },
      result,
      employee.codename,
    )
    reportId = report.id
    result.artifacts.push({
      id: `artifact-report-${report.id}`,
      kind: 'report',
      label: report.title,
      refId: report.id,
    })

    emitEvent({
      type: 'run.completed',
      sourceType: 'run',
      sourceId: runId,
      employeeId: request.employeeId,
      workspaceId: request.workspaceId ?? null,
      reportId: report.id,
      metadata: { mock: true, status: 'completed' },
      severity: 'success',
    })
    recordRuntimeLearning(request.employeeId, runId, report.id)

    pipeline = updatePipelineStep(pipeline, 'create_report', 'done', report.id)
    pipeline = updatePipelineStep(pipeline, 'complete', 'done', 'Mock execution complete')
    status = 'completed'
    finishedAt = new Date().toISOString()
  } else {
    pipeline = updatePipelineStep(pipeline, 'create_report', 'skipped', 'Awaiting approval')
    pipeline = updatePipelineStep(pipeline, 'complete', 'skipped', 'Paused at approval gate')
  }

  const run: RuntimeRun = {
    id: runId,
    employeeId: request.employeeId,
    workspaceId: request.workspaceId ?? null,
    runtimeProfileId: profile.id,
    modelId: selection.selectedModelId,
    providerId: selection.selectedProviderId,
    taskId: request.taskId ?? null,
    chatId: request.chatId ?? null,
    reportId,
    status,
    startedAt,
    finishedAt,
    context,
    pipeline,
    result,
  }

  return upsertRuntimeRun(run)
}

/** Resume a run that was waiting for approval — still mock-only, no LLM calls. */
export function completeRuntimeRunAfterApproval(runId: string): RuntimeRun | null {
  const existing = getRuntimeRunById(runId)
  if (!existing || existing.status !== 'waiting_approval') return null

  const employee = resolveEmployee(existing.employeeId)
  if (!employee) return null

  let pipeline = existing.pipeline
  pipeline = updatePipelineStep(pipeline, 'approval_check', 'done', 'Approval granted (mock)')
  pipeline = updatePipelineStep(pipeline, 'create_report', 'active')

  const knowledgeCount =
    existing.context.layers.find((layer: RuntimeContextLayer) => layer.key === 'knowledge')
      ?.itemCount ?? 0
  const memoryCount =
    existing.context.layers.find((layer: RuntimeContextLayer) => layer.key === 'memory')?.itemCount ??
    0

  const result: RuntimeResult = {
    selectedModel: existing.modelId,
    selectedProvider: existing.providerId,
    contextSize: existing.context.layers.filter((layer: RuntimeContextLayer) => layer.loaded)
      .length,
    knowledgeUsed: knowledgeCount,
    memoryUsed: memoryCount,
    estimatedCost: estimateCost(existing.modelId, 4096),
    estimatedTokens: 4096,
    warnings: [
      {
        code: 'MOCK_EXECUTION',
        message: 'Mock orchestrator completion — no provider inference.',
        severity: 'info',
      },
    ],
    artifacts: [
      {
        id: `artifact-ctx-${existing.id}`,
        kind: 'context_snapshot',
        label: 'Context snapshot',
        refId: existing.id,
      },
    ],
  }

  const report = createRuntimeReport(existing, result, employee.codename)
  result.artifacts.push({
    id: `artifact-report-${report.id}`,
    kind: 'report',
    label: report.title,
    refId: report.id,
  })

  emitEvent({
    type: 'run.completed',
    sourceType: 'run',
    sourceId: existing.id,
    employeeId: existing.employeeId,
    workspaceId: existing.workspaceId,
    reportId: report.id,
    metadata: { mock: true, status: 'completed', afterApproval: true },
    severity: 'success',
  })
  recordRuntimeLearning(existing.employeeId, existing.id, report.id)

  pipeline = updatePipelineStep(pipeline, 'create_report', 'done', report.id)
  pipeline = updatePipelineStep(pipeline, 'complete', 'done', 'Mock execution complete')

  const completed: RuntimeRun = {
    ...existing,
    status: 'completed',
    reportId: report.id,
    finishedAt: new Date().toISOString(),
    pipeline,
    result,
  }

  return upsertRuntimeRun(completed)
}

export type { RuntimeRun } from './runtimeRun'
export type { RuntimeContext, RuntimeContextLayer } from './runtimeContext'
export type { RuntimeResult, RuntimeArtifact, RuntimeWarning } from './runtimeResult'
export type { RuntimeRunState, RuntimePipelineStep } from './runtimeState'
