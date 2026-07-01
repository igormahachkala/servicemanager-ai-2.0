import type { RuntimeContext } from './runtimeContext'
import type { RuntimeRun } from './runtimeRun'
import type { RuntimePromptBuildInput, RuntimePromptPreview, RuntimePromptSections } from './runtimePromptTypes'
import type { RuntimeRunRequest } from './runtimeOrchestrator'
import {
  buildEmployeeIdentity,
  buildLanguagePolicy,
  defaultInstructions,
  defaultSystemPrompt,
  resolveOutputLanguage,
} from './runtimeOutputPolicy'
import { buildEmployeePersonaSection } from './runtimeEmployeePersona'
import { buildRuntimeReportOutputInstructions } from '../runtimeReport'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import { getProjectById } from '../projects/project'
import { getDeliveryTaskById } from '../tasks/taskStorage'
import { getWorkspaceById } from '../workspaces/workspace'

export type { RuntimePromptBuildInput, RuntimePromptPreview, RuntimePromptSections } from './runtimePromptTypes'
export type { OutputLanguage } from './runtimeOutputPolicy'
export { DEFAULT_OUTPUT_LANGUAGE, RUSSIAN_OUTPUT_POLICY_CORE } from './runtimeOutputPolicy'

function resolveSystemPrompt(employeeId: string, language: ReturnType<typeof resolveOutputLanguage>): string {
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  const trimmed = custom?.systemPrompt?.trim()
  return trimmed || defaultSystemPrompt(language)
}

function buildContextSection(context: RuntimeContext, language: ReturnType<typeof resolveOutputLanguage>): string {
  const layers = context.layers
    .filter((layer) => layer.loaded)
    .map((layer) => `- ${layer.key}: ${layer.summary}`)
    .join('\n')
  if (layers) return layers
  return language === 'en' ? '- no additional context' : '- дополнительный контекст отсутствует'
}

function resolveTaskSection(
  request: RuntimeRunRequest,
  language: ReturnType<typeof resolveOutputLanguage>,
): {
  task: string
  projectLabel: string | null
  projectId: string | null
  workspaceLabel: string | null
} {
  const workspace = request.workspaceId ? getWorkspaceById(request.workspaceId) : null
  const workspaceLabel = workspace ? `${workspace.name} (${workspace.id})` : null
  const deliveryTask = request.taskId ? getDeliveryTaskById(request.taskId) : null
  const project = deliveryTask ? getProjectById(deliveryTask.projectId) : null
  const projectLabel = project ? `${project.title} (${project.id})` : null
  const projectId = deliveryTask?.projectId ?? null

  if (request.prompt?.trim()) {
    return {
      task: request.prompt.trim(),
      projectLabel,
      projectId,
      workspaceLabel: workspaceLabel ?? (deliveryTask?.workspaceId ? deliveryTask.workspaceId : null),
    }
  }

  if (deliveryTask) {
    return {
      task: [
        `${language === 'en' ? 'Linked task' : 'Связанная задача'}: ${deliveryTask.id}`,
        `${language === 'en' ? 'Title' : 'Название'}: ${deliveryTask.title}`,
        deliveryTask.description
          ? `${language === 'en' ? 'Description' : 'Описание'}: ${deliveryTask.description}`
          : null,
        deliveryTask.expectedOutput
          ? `${language === 'en' ? 'Expected output' : 'Ожидаемый результат'}: ${deliveryTask.expectedOutput}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
      projectLabel,
      projectId,
      workspaceLabel: workspaceLabel ?? (deliveryTask.workspaceId ? deliveryTask.workspaceId : null),
    }
  }

  return {
    task:
      language === 'en'
        ? request.taskId
          ? `Linked task: ${request.taskId}`
          : 'General runtime execution request.'
        : request.taskId
          ? `Связанная задача: ${request.taskId}`
          : 'Общий запрос на runtime execution.',
    projectLabel,
    projectId,
    workspaceLabel,
  }
}

function assembleImplicitPrompt(sections: RuntimePromptSections, language: ReturnType<typeof resolveOutputLanguage>): string {
  return [
    sections.systemPrompt,
    '',
    '## Employee Persona',
    sections.employeePersona,
    '',
    sections.languagePolicy,
    '',
    sections.employeeIdentity,
    '',
    language === 'en' ? 'Assembled runtime context:' : 'Собранный runtime context:',
    sections.context,
    '',
    sections.task,
    '',
    sections.instructions,
  ].join('\n')
}

function assembleExplicitPrompt(sections: RuntimePromptSections, userPrompt: string): string {
  return [
    sections.systemPrompt,
    '',
    '## Employee Persona',
    sections.employeePersona,
    '',
    sections.languagePolicy,
    '',
    sections.employeeIdentity,
    '',
    '---',
    '',
    userPrompt,
    '',
    '---',
    '',
    sections.instructions,
  ].join('\n')
}

/** Builds structured prompt sections and the final prompt sent to the runtime provider. */
export function buildRuntimePromptPreview(input: RuntimePromptBuildInput): RuntimePromptPreview {
  const { request, employee, context } = input
  const outputLanguage = resolveOutputLanguage(request.outputLanguage)
  const explicitOverride = Boolean(request.prompt?.trim())
  const { task, projectLabel, projectId, workspaceLabel } = resolveTaskSection(request, outputLanguage)

  const sections: RuntimePromptSections = {
    systemPrompt: resolveSystemPrompt(employee.employeeId, outputLanguage),
    employeeIdentity: buildEmployeeIdentity(outputLanguage, employee.codename, employee.role),
    employeePersona: buildEmployeePersonaSection({
      employeeId: employee.employeeId,
      codename: employee.codename,
      role: employee.role,
      language: outputLanguage,
      projectLabel,
      projectId,
    }),
    languagePolicy: buildLanguagePolicy(outputLanguage, employee.codename),
    task,
    context: buildContextSection(context, outputLanguage),
    instructions: [
      defaultInstructions(outputLanguage, explicitOverride),
      '',
      buildRuntimeReportOutputInstructions(outputLanguage),
    ].join('\n'),
  }

  const finalPrompt = explicitOverride
    ? assembleExplicitPrompt(sections, request.prompt!.trim())
    : assembleImplicitPrompt(sections, outputLanguage)

  return {
    ...sections,
    finalPrompt,
    explicitOverride,
    outputLanguage,
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
      outputLanguage: 'ru',
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
    `## Output Language (${preview.outputLanguage})`,
    preview.languagePolicy,
    '',
    '## System Prompt',
    preview.systemPrompt,
    '',
    '## Employee Identity',
    preview.employeeIdentity,
    '',
    '## Employee Persona',
    preview.employeePersona,
    '',
    '## Language Policy',
    preview.languagePolicy,
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
