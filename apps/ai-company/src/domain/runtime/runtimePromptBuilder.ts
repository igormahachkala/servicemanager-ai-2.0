import type { RuntimeContext } from './runtimeContext'
import type { RuntimeRun } from './runtimeRun'
import type { RuntimePromptBuildInput, RuntimePromptPreview, RuntimePromptSections } from './runtimePromptTypes'
import type { RuntimeRunRequest } from './runtimeOrchestrator'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import { getProjectById } from '../projects/project'
import { getDeliveryTaskById } from '../tasks/taskStorage'
import { getWorkspaceById } from '../workspaces/workspace'

export type { RuntimePromptBuildInput, RuntimePromptPreview, RuntimePromptSections } from './runtimePromptTypes'

const DEFAULT_SYSTEM_PROMPT =
  'You are a digital employee in AI Company. Follow Owner policies, stay within assigned scope, and produce actionable output.'

const DEFAULT_INSTRUCTIONS = 'Respond clearly and concisely in plain language.'

function resolveSystemPrompt(employeeId: string): string {
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  const trimmed = custom?.systemPrompt?.trim()
  return trimmed || DEFAULT_SYSTEM_PROMPT
}

function buildContextSection(context: RuntimeContext): string {
  const layers = context.layers
    .filter((layer) => layer.loaded)
    .map((layer) => `- ${layer.key}: ${layer.summary}`)
    .join('\n')
  return layers || '- no additional context'
}

function resolveTaskSection(request: RuntimeRunRequest): {
  task: string
  projectLabel: string | null
  workspaceLabel: string | null
} {
  const workspace = request.workspaceId ? getWorkspaceById(request.workspaceId) : null
  const workspaceLabel = workspace ? `${workspace.name} (${workspace.id})` : null

  if (request.prompt?.trim()) {
    return {
      task: request.prompt.trim(),
      projectLabel: null,
      workspaceLabel,
    }
  }

  const deliveryTask = request.taskId ? getDeliveryTaskById(request.taskId) : null
  const project = deliveryTask ? getProjectById(deliveryTask.projectId) : null
  const projectLabel = project ? `${project.title} (${project.id})` : null

  if (deliveryTask) {
    return {
      task: [
        `Linked task: ${deliveryTask.id}`,
        `Title: ${deliveryTask.title}`,
        deliveryTask.description ? `Description: ${deliveryTask.description}` : null,
        deliveryTask.expectedOutput ? `Expected output: ${deliveryTask.expectedOutput}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      projectLabel,
      workspaceLabel: workspaceLabel ?? (deliveryTask.workspaceId ? deliveryTask.workspaceId : null),
    }
  }

  return {
    task: request.taskId
      ? `Linked task: ${request.taskId}`
      : 'General runtime execution request.',
    projectLabel,
    workspaceLabel,
  }
}

function assembleImplicitPrompt(sections: RuntimePromptSections): string {
  return [
    sections.employeeIdentity,
    '',
    'Assembled runtime context:',
    sections.context,
    '',
    sections.task,
    '',
    sections.instructions,
  ].join('\n')
}

/** Builds structured prompt sections and the final prompt sent to the runtime provider. */
export function buildRuntimePromptPreview(input: RuntimePromptBuildInput): RuntimePromptPreview {
  const { request, employee, context } = input
  const explicitOverride = Boolean(request.prompt?.trim())
  const { task, projectLabel, workspaceLabel } = resolveTaskSection(request)

  const sections: RuntimePromptSections = {
    systemPrompt: resolveSystemPrompt(employee.employeeId),
    employeeIdentity: `You are ${employee.codename}, ${employee.role} in AI Company.`,
    task,
    context: buildContextSection(context),
    instructions: explicitOverride
      ? 'Explicit prompt mode — final prompt is sent as provided below without implicit assembly.'
      : DEFAULT_INSTRUCTIONS,
  }

  const finalPrompt = explicitOverride ? request.prompt!.trim() : assembleImplicitPrompt(sections)

  return {
    ...sections,
    finalPrompt,
    explicitOverride,
    projectLabel,
    workspaceLabel,
  }
}

/** Returns only the provider-facing prompt string (backward-compatible helper). */
export function buildExecutionPrompt(
  request: RuntimePromptBuildInput['request'],
  employee: { codename: string; role: string },
  context: RuntimeContext,
): string {
  return buildRuntimePromptPreview({
    request,
    employee: { ...employee, employeeId: request.employeeId },
    context,
  }).finalPrompt
}

export function buildRuntimePromptPreviewFromRun(run: RuntimeRun): RuntimePromptPreview {
  const employee = resolveEmployee(run.employeeId)
  const stored = run.promptPreview
  if (stored) return stored

  return buildRuntimePromptPreview({
    request: {
      employeeId: run.employeeId,
      workspaceId: run.workspaceId,
      taskId: run.taskId,
      chatId: run.chatId,
    },
    employee: {
      employeeId: run.employeeId,
      codename: employee?.codename ?? run.employeeId,
      role: employee?.role ?? 'Digital employee',
    },
    context: run.context,
  })
}

export function exportRuntimePromptMarkdown(preview: RuntimePromptPreview): string {
  return [
    '# Runtime Prompt Export',
    '',
    '## System Prompt',
    preview.systemPrompt,
    '',
    '## Employee Identity',
    preview.employeeIdentity,
    '',
    '## Task',
    preview.task,
    '',
    '## Context',
    preview.context,
    '',
    '## Instructions',
    preview.instructions,
    '',
    '## Final Prompt',
    preview.finalPrompt,
  ].join('\n')
}
