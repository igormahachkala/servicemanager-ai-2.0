import { emitEvent } from '../events/eventStorage'
import { getEmployeeCompetencySnapshot } from '../competencies/competencyStorage'
import { recordRuntimeLearning } from '../learning/learningStorage'
import { getChatById } from '../chats/chatStorage'
import { ensureSeedMemories, getMemoriesByEmployee } from '../memory/memory'
import { queryKnowledgeForRuntime } from '../knowledge/knowledgeStorage'
import { loadReports, saveReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { createTaskResultFromRuntimeRun } from '../taskResults/taskResultStorage'
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
  getOrCreateRuntimeProfile,
  getProviderForModel,
  selectModelForTask,
  type TaskContext,
  type TaskType,
} from './runtimeStorage'
import type { RuntimePipelineStep, RuntimeRunState } from './runtimeState'
import { mapRuntimeRunToRunHistory, recordRunHistory } from '../run/runStorage'
import {
  createToolRequestApproval,
  submitToolRequestFromRuntime,
  type ToolExecutionProvider,
} from '../toolExecution'
import { registryTools } from '../../mission-control/data/tools'
import {
  executeViaRuntimeAdapter,
  getActiveRuntimeProviderId,
} from './providers/runtimeAdapter'
import { OLLAMA_LIGHTWEIGHT_CONTEXT_LAYER_KEYS } from './providers/runtimeCapabilities'
import {
  appendRuntimeLog,
  RuntimeExecutionError,
} from './providers/runtimeHealth'

const STORAGE_KEY = 'ai-company-runtime-runs'
let activeRuntimeRunId: string | null = null

export function getActiveRuntimeRunId(): string | null {
  return activeRuntimeRunId
}

function isFirstRealOllamaRun(): boolean {
  if (getActiveRuntimeProviderId() !== 'ollama') return false
  return !loadRuntimeRuns().some(
    (run) => run.status === 'completed' && Boolean(run.result?.responseText),
  )
}

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
  'tool_gateway',
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
  prompt?: string
  ollamaModelTag?: string | null
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
    promptTokens: typeof value.promptTokens === 'number' ? value.promptTokens : undefined,
    completionTokens: typeof value.completionTokens === 'number' ? value.completionTokens : undefined,
    executionDurationMs:
      typeof value.executionDurationMs === 'number' ? value.executionDurationMs : undefined,
    responseText: typeof value.responseText === 'string' ? value.responseText : undefined,
    ollamaModelTag: typeof value.ollamaModelTag === 'string' ? value.ollamaModelTag : undefined,
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

function resolveRegistryToolRef(toolRef: string): (typeof registryTools)[number] | null {
  return (
    registryTools.find((item) => item.id === toolRef) ??
    registryTools.find((item) => item.name.toLowerCase() === toolRef.toLowerCase()) ??
    null
  )
}

function mapRegistryToolProvider(toolId: string): ToolExecutionProvider {
  switch (toolId) {
    case 'tool-github':
      return 'github'
    case 'tool-docker':
      return 'docker'
    case 'tool-filesystem':
      return 'filesystem'
    case 'tool-browser':
      return 'browser'
    case 'tool-postgresql':
      return 'postgresql'
    case 'tool-telegram':
      return 'telegram'
    case 'tool-openrouter':
      return 'openrouter'
    case 'tool-ollama':
      return 'ollama'
    case 'tool-google-drive':
      return 'google'
    case 'tool-rest':
      return 'rest'
    case 'tool-ssh':
      return 'ssh'
    default:
      return 'mock'
  }
}

function resolveEmployeePermissionsSummary(employeeId: string): string {
  const custom = resolveCustomEmployee(employeeId)
  if (!custom) return 'Builtin agent — platform defaults'
  const enabled = Object.entries(custom.permissions)
    .filter(([, value]) => value === true || (typeof value === 'object' && value.read))
    .map(([key]) => key)
  return enabled.length > 0 ? enabled.join(', ') : 'No integrations enabled'
}

function buildRuntimeContext(input: RuntimeRunRequest, lightweight = false): RuntimeContext {
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

  const lightweightSkipSummary = 'Skipped (first real run — lightweight context)'

  const layers: RuntimeContextLayer[] = [
    {
      key: 'employee_profile',
      loaded: employee !== null,
      itemCount: 1,
      summary: employee ? `${employee.codename} · ${employee.role}` : 'Employee not found',
    },
    {
      key: 'memory',
      loaded: !lightweight && memories.length > 0,
      itemCount: lightweight ? 0 : memories.length,
      summary: lightweight
        ? lightweightSkipSummary
        : `${memories.length} memory entries (read-only)`,
    },
    {
      key: 'knowledge',
      loaded: !lightweight && knowledge.length > 0,
      itemCount: lightweight ? 0 : knowledge.length,
      summary: lightweight
        ? lightweightSkipSummary
        : `${knowledge.length} published knowledge items`,
    },
    {
      key: 'competencies',
      loaded: !lightweight && competencies.skills.length > 0,
      itemCount: lightweight ? 0 : competencies.skills.length,
      summary: lightweight
        ? lightweightSkipSummary
        : `${competencies.skills.length} skills · trust ${competencies.reputation.trustScore}`,
    },
    {
      key: 'workspace',
      loaded: !lightweight && workspace !== null,
      itemCount: lightweight ? 0 : workspace ? 1 : 0,
      summary: lightweight
        ? lightweightSkipSummary
        : workspace
          ? workspace.name
          : 'No workspace scope',
    },
    {
      key: 'permissions',
      loaded: !lightweight,
      itemCount: lightweight ? 0 : 1,
      summary: lightweight
        ? lightweightSkipSummary
        : resolveEmployeePermissionsSummary(input.employeeId),
    },
    {
      key: 'tools',
      loaded: !lightweight,
      itemCount: lightweight ? 0 : resolveEmployeeTools(input.employeeId).length,
      summary: lightweight
        ? lightweightSkipSummary
        : resolveEmployeeTools(input.employeeId).join(', ') || 'No tools',
    },
    {
      key: 'conversation',
      loaded: !lightweight && chat !== null,
      itemCount: lightweight ? 0 : chat?.messages.length ?? 0,
      summary: lightweight
        ? lightweightSkipSummary
        : chat
          ? `${chat.type} · ${chat.messages.length} messages`
          : 'No chat context',
    },
    {
      key: 'current_task',
      loaded: !lightweight && task !== null,
      itemCount: lightweight ? 0 : task ? 1 : 0,
      summary: lightweight
        ? lightweightSkipSummary
        : task
          ? `${task.id} · ${task.title}`
          : 'No task linked',
    },
    {
      key: 'runtime_profile',
      loaded: true,
      itemCount: 1,
      summary: `${profile.primaryModelId} · ${profile.routingRules.length} routes`,
    },
  ]

  const orderedLayers = RUNTIME_CONTEXT_LAYER_ORDER.map(
    (key) => layers.find((layer) => layer.key === key) ?? {
      key,
      loaded: false,
      itemCount: 0,
      summary: 'Not loaded',
    },
  )

  if (lightweight) {
    return {
      employeeId: input.employeeId,
      workspaceId: input.workspaceId ?? null,
      taskId: input.taskId ?? null,
      chatId: input.chatId ?? null,
      layers: orderedLayers.filter((layer) =>
        (OLLAMA_LIGHTWEIGHT_CONTEXT_LAYER_KEYS as readonly string[]).includes(layer.key),
      ),
      builtAt: new Date().toISOString(),
    }
  }

  return {
    employeeId: input.employeeId,
    workspaceId: input.workspaceId ?? null,
    taskId: input.taskId ?? null,
    chatId: input.chatId ?? null,
    layers: orderedLayers,
    builtAt: new Date().toISOString(),
  }
}

function estimateTokens(context: RuntimeContext, profileMaxTokens: number): number {
  const layerTokens = context.layers.reduce((sum, layer) => sum + layer.itemCount * 120, 0)
  return Math.min(profileMaxTokens, Math.max(512, layerTokens))
}

function buildPartialFailureResult(
  modelId: string,
  providerId: string,
  context: RuntimeContext,
  knowledgeCount: number,
  memoryCount: number,
  estimatedTokens: number,
  warnings: RuntimeWarning[],
  error: unknown,
): RuntimeResult {
  const execError = error instanceof RuntimeExecutionError ? error : null
  const message =
    execError?.message ?? (error instanceof Error ? error.message : 'Runtime execution failed')
  const warningCode =
    execError?.reason === 'timeout'
      ? 'EXECUTION_TIMEOUT'
      : execError?.reason === 'cancelled'
        ? 'EXECUTION_CANCELLED'
        : 'EXECUTION_FAILED'

  return {
    selectedModel: modelId,
    selectedProvider: providerId,
    contextSize: context.layers.filter((layer) => layer.loaded).length,
    knowledgeUsed: knowledgeCount,
    memoryUsed: memoryCount,
    estimatedCost: 0,
    estimatedTokens,
    executionDurationMs: execError?.elapsedMs,
    warnings: [
      ...warnings,
      {
        code: warningCode,
        message,
        severity: execError?.reason === 'cancelled' ? 'warn' : 'error',
      },
    ],
    artifacts: [],
  }
}

function buildExecutionPrompt(
  request: RuntimeRunRequest,
  employee: { codename: string; role: string },
  context: RuntimeContext,
): string {
  if (request.prompt?.trim()) return request.prompt.trim()
  const layers = context.layers
    .filter((layer) => layer.loaded)
    .map((layer) => `- ${layer.key}: ${layer.summary}`)
    .join('\n')
  return [
    `You are ${employee.codename}, ${employee.role} in AI Company.`,
    '',
    'Assembled runtime context:',
    layers || '- no additional context',
    '',
    request.taskId ? `Linked task: ${request.taskId}` : 'General runtime execution request.',
    '',
    'Respond clearly and concisely in plain language.',
  ].join('\n')
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
    summary: `Runtime run completed via provider adapter (${getActiveRuntimeProviderId()}) and Model Router (${result.selectedModel}).`,
    findings: [
      `Model ${result.selectedModel} selected through Model Router`,
      `Context assembled from ${result.contextSize} layers`,
      `${result.knowledgeUsed} knowledge items referenced`,
      `${result.memoryUsed} memory entries referenced`,
      result.responseText
        ? `Response preview: ${result.responseText.slice(0, 180)}${result.responseText.length > 180 ? '…' : ''}`
        : 'No model response text captured',
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
export async function orchestrateRuntimeRun(request: RuntimeRunRequest): Promise<RuntimeRun> {
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

  const lightweightContext = isFirstRealOllamaRun()
  const context = buildRuntimeContext(request, lightweightContext)
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

  const primaryToolRef = resolveEmployeeTools(request.employeeId)[0]
  const registryTool = primaryToolRef ? resolveRegistryToolRef(primaryToolRef) : null
  if (request.requiresExternalTools && registryTool) {
    try {
      const toolExecution = submitToolRequestFromRuntime({
        employeeId: request.employeeId,
        toolId: registryTool.id,
        provider: mapRegistryToolProvider(registryTool.id),
        action: 'invoke',
        arguments: {
          runId,
          taskId: request.taskId ?? null,
          chatId: request.chatId ?? null,
        },
        approval: createToolRequestApproval(
          requiresApproval || registryTool.requiresApproval,
          null,
        ),
      })
      pipeline = updatePipelineStep(
        pipeline,
        'tool_gateway',
        'done',
        `${toolExecution.status} · ${registryTool.id}`,
      )
    } catch (error) {
      pipeline = updatePipelineStep(
        pipeline,
        'tool_gateway',
        'failed',
        error instanceof Error ? error.message : 'Tool gateway error',
      )
    }
  } else {
    pipeline = updatePipelineStep(
      pipeline,
      'tool_gateway',
      'skipped',
      request.requiresExternalTools ? 'No registered tool' : 'External tools not required',
    )
  }

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
      providerAdapter: getActiveRuntimeProviderId(),
      mock: getActiveRuntimeProviderId() === 'mock',
    },
    severity: 'info',
  })
  pipeline = updatePipelineStep(pipeline, 'emit_event', 'done', 'runtime.started emitted')

  let reportId: string | null = null
  let result: RuntimeResult | null = null
  let finishedAt: string | null = null

  if (lightweightContext) {
    appendRuntimeLog({
      level: 'info',
      message: 'First real Ollama run — lightweight context applied',
      runId,
      providerId: 'ollama',
    })
  }

  const runningRun: RuntimeRun = {
    id: runId,
    employeeId: request.employeeId,
    workspaceId: request.workspaceId ?? null,
    runtimeProfileId: profile.id,
    modelId: selection.selectedModelId,
    providerId: selection.selectedProviderId,
    taskId: request.taskId ?? null,
    chatId: request.chatId ?? null,
    reportId: null,
    status: requiresApproval ? 'waiting_approval' : 'running',
    startedAt,
    finishedAt: null,
    context,
    pipeline,
    result: null,
  }
  upsertRuntimeRun(runningRun)

  if (!requiresApproval) {
    status = 'running'
    const executionPrompt = buildExecutionPrompt(request, employee, context)

    appendRuntimeLog({
      level: 'info',
      message: `Orchestrator executing via ${getActiveRuntimeProviderId()}`,
      runId,
      providerId: getActiveRuntimeProviderId(),
    })

    activeRuntimeRunId = runId
    try {
      const execution = await executeViaRuntimeAdapter({
        runId,
        employeeId: request.employeeId,
        modelId: selection.selectedModelId,
        catalogProviderId: selection.selectedProviderId,
        estimatedTokens,
        contextSize: context.layers.filter((layer) => layer.loaded).length,
        knowledgeUsed: knowledge.length,
        memoryUsed: memories.length,
        warnings,
        prompt: executionPrompt,
        ollamaModelTag: request.ollamaModelTag ?? null,
      })
      result = execution.result

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
      createTaskResultFromRuntimeRun(
        {
          id: runId,
          employeeId: request.employeeId,
          workspaceId: request.workspaceId ?? null,
          runtimeProfileId: profile.id,
          modelId: selection.selectedModelId,
          providerId: selection.selectedProviderId,
          taskId: request.taskId ?? null,
          chatId: request.chatId ?? null,
          reportId: report.id,
          status: 'running',
          startedAt,
          finishedAt: null,
          context,
          pipeline,
          result,
        },
        report,
      )

      emitEvent({
        type: 'run.completed',
        sourceType: 'run',
        sourceId: runId,
        employeeId: request.employeeId,
        workspaceId: request.workspaceId ?? null,
        reportId: report.id,
        metadata: {
          mock: execution.mock,
          providerAdapter: execution.providerId,
          status: 'completed',
          durationMs: result.executionDurationMs ?? null,
        },
        severity: 'success',
      })
      recordRuntimeLearning(request.employeeId, runId, report.id)

      pipeline = updatePipelineStep(pipeline, 'create_report', 'done', report.id)
      pipeline = updatePipelineStep(
        pipeline,
        'complete',
        'done',
        execution.mock ? 'Mock execution complete' : `${execution.providerId} execution complete`,
      )
      status = 'completed'
      finishedAt = new Date().toISOString()
    } catch (error) {
      const partialResult = buildPartialFailureResult(
        selection.selectedModelId,
        selection.selectedProviderId,
        context,
        knowledge.length,
        memories.length,
        estimatedTokens,
        warnings,
        error,
      )
      result = partialResult
      const message =
        error instanceof RuntimeExecutionError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Runtime execution failed'
      emitEvent({
        type: 'runtime.failed',
        sourceType: 'runtime',
        sourceId: runId,
        employeeId: request.employeeId,
        workspaceId: request.workspaceId ?? null,
        reportId: null,
        metadata: {
          providerAdapter: getActiveRuntimeProviderId(),
          error: message,
          elapsedMs: partialResult.executionDurationMs ?? null,
          reason: error instanceof RuntimeExecutionError ? error.reason : 'unknown',
        },
        severity: partialResult.warnings.some((item) => item.severity === 'error') ? 'error' : 'warn',
      })
      pipeline = updatePipelineStep(pipeline, 'create_report', 'skipped', message)
      pipeline = updatePipelineStep(pipeline, 'complete', 'failed', message)
      status = error instanceof RuntimeExecutionError && error.reason === 'cancelled' ? 'cancelled' : 'failed'
      finishedAt = new Date().toISOString()
    } finally {
      activeRuntimeRunId = null
    }
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

/** Resume a run that was waiting for approval. */
export async function completeRuntimeRunAfterApproval(runId: string): Promise<RuntimeRun | null> {
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

  const executionPrompt = buildExecutionPrompt(
    {
      employeeId: existing.employeeId,
      workspaceId: existing.workspaceId,
      taskId: existing.taskId,
      chatId: existing.chatId,
    },
    employee,
    existing.context,
  )

  activeRuntimeRunId = existing.id
  try {
    const execution = await executeViaRuntimeAdapter({
      runId: existing.id,
      employeeId: existing.employeeId,
      modelId: existing.modelId,
      catalogProviderId: existing.providerId,
      estimatedTokens: 4096,
      contextSize: existing.context.layers.filter((layer: RuntimeContextLayer) => layer.loaded)
        .length,
      knowledgeUsed: knowledgeCount,
      memoryUsed: memoryCount,
      warnings: existing.result?.warnings ?? [],
      prompt: executionPrompt,
    })
    const result: RuntimeResult = execution.result

    const report = createRuntimeReport(existing, result, employee.codename)
    result.artifacts.push({
      id: `artifact-report-${report.id}`,
      kind: 'report',
      label: report.title,
      refId: report.id,
    })
    createTaskResultFromRuntimeRun(
      { ...existing, reportId: report.id, result, status: 'running' },
      report,
    )

    emitEvent({
      type: 'run.completed',
      sourceType: 'run',
      sourceId: existing.id,
      employeeId: existing.employeeId,
      workspaceId: existing.workspaceId,
      reportId: report.id,
      metadata: {
        mock: execution.mock,
        providerAdapter: execution.providerId,
        status: 'completed',
        afterApproval: true,
      },
      severity: 'success',
    })
    recordRuntimeLearning(existing.employeeId, existing.id, report.id)

    pipeline = updatePipelineStep(pipeline, 'create_report', 'done', report.id)
    pipeline = updatePipelineStep(
      pipeline,
      'complete',
      'done',
      execution.mock ? 'Mock execution complete' : `${execution.providerId} execution complete`,
    )

    const completed: RuntimeRun = {
      ...existing,
      status: 'completed',
      reportId: report.id,
      finishedAt: new Date().toISOString(),
      pipeline,
      result,
    }

    return upsertRuntimeRun(completed)
  } catch (error) {
    const partialResult = buildPartialFailureResult(
      existing.modelId,
      existing.providerId,
      existing.context,
      knowledgeCount,
      memoryCount,
      4096,
      existing.result?.warnings ?? [],
      error,
    )
    const message =
      error instanceof RuntimeExecutionError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Runtime execution failed'
    pipeline = updatePipelineStep(pipeline, 'create_report', 'skipped', message)
    pipeline = updatePipelineStep(pipeline, 'complete', 'failed', message)
    return upsertRuntimeRun({
      ...existing,
      status: error instanceof RuntimeExecutionError && error.reason === 'cancelled' ? 'cancelled' : 'failed',
      finishedAt: new Date().toISOString(),
      pipeline,
      result: partialResult,
    })
  } finally {
    activeRuntimeRunId = null
  }
}

export type { RuntimeRun } from './runtimeRun'
export type { RuntimeContext, RuntimeContextLayer } from './runtimeContext'
export type { RuntimeResult, RuntimeArtifact, RuntimeWarning } from './runtimeResult'
export type { RuntimeRunState, RuntimePipelineStep } from './runtimeState'
