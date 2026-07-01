import type { DeliveryTaskPriority } from '../tasks/task'
import type { TaskRunnerInput } from './taskRunner'

export const TASK_RUNNER_MODES = [
  'planning',
  'architecture',
  'technical_audit',
  'qa_review',
  'devops_plan',
  'handoff_preparation',
  'documentation',
  'product_review',
] as const

export type TaskRunnerMode = (typeof TASK_RUNNER_MODES)[number]

export type TaskRunnerEmployeeOption = {
  id: string
  codename: string
  role: string
  defaultModes: TaskRunnerMode[]
}

export const TASK_RUNNER_EMPLOYEES: TaskRunnerEmployeeOption[] = [
  {
    id: 'ag-cto',
    codename: 'Atlas',
    role: 'AI CTO',
    defaultModes: ['planning', 'architecture'],
  },
  {
    id: 'ag-max',
    codename: 'MAX',
    role: 'Senior Developer',
    defaultModes: ['technical_audit', 'handoff_preparation'],
  },
  {
    id: 'ag-qa',
    codename: 'Sentinel',
    role: 'AI QA',
    defaultModes: ['qa_review'],
  },
  {
    id: 'ag-devops',
    codename: 'Helm',
    role: 'AI DevOps',
    defaultModes: ['devops_plan'],
  },
  {
    id: 'ag-coo',
    codename: 'Ops',
    role: 'AI Product Analyst',
    defaultModes: ['product_review'],
  },
]

export const TASK_RUNNER_PRIORITIES: DeliveryTaskPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
]

const MODE_RUNTIME_MAP: Record<TaskRunnerMode, string> = {
  planning: 'planning',
  architecture: 'planning',
  technical_audit: 'analysis',
  qa_review: 'review',
  devops_plan: 'planning',
  handoff_preparation: 'coding',
  documentation: 'general',
  product_review: 'review',
}

export function extractTitleFromTaskText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return 'Untitled task'
  const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim())?.trim() ?? trimmed
  const withoutPrefix = firstLine.replace(/^#+\s*/, '').replace(/^\*\s*/, '').trim()
  if (withoutPrefix.length <= 120) return withoutPrefix
  return `${withoutPrefix.slice(0, 117).trimEnd()}…`
}

export function mapModeToRuntimeTaskType(mode: TaskRunnerMode): string {
  return MODE_RUNTIME_MAP[mode] ?? 'general'
}

export function suggestEmployeeForMode(mode: TaskRunnerMode): string {
  const match = TASK_RUNNER_EMPLOYEES.find((item) => item.defaultModes.includes(mode))
  return match?.id ?? 'ag-cto'
}

export function suggestModeForEmployee(employeeId: string): TaskRunnerMode {
  const employee = TASK_RUNNER_EMPLOYEES.find((item) => item.id === employeeId)
  return employee?.defaultModes[0] ?? 'planning'
}

export function isModeSuggestedForEmployee(employeeId: string, mode: TaskRunnerMode): boolean {
  const employee = TASK_RUNNER_EMPLOYEES.find((item) => item.id === employeeId)
  return employee?.defaultModes.includes(mode) ?? false
}

const MODE_LABELS_RU: Record<TaskRunnerMode, string> = {
  planning: 'планирование',
  architecture: 'архитектура',
  technical_audit: 'технический аудит',
  qa_review: 'QA review',
  devops_plan: 'DevOps plan',
  handoff_preparation: 'подготовка handoff',
  documentation: 'документация',
  product_review: 'product review',
}

export function buildTaskRunnerPrompt(input: TaskRunnerInput): string {
  const title = (input.title?.trim() || extractTitleFromTaskText(input.taskText)).slice(0, 160)
  const constraints = input.constraints.trim()
  const expectedOutput = input.expectedOutput.trim()
  const modeLabel = MODE_LABELS_RU[input.mode] ?? input.mode.replace(/_/g, ' ')

  return [
    `Задача Owner (режим: ${modeLabel})`,
    '',
    `Проект: ${input.projectId}`,
    `Workspace: ${input.workspaceId}`,
    '',
    `Название: ${title}`,
    '',
    'Текст задачи:',
    input.taskText.trim(),
    '',
    expectedOutput ? `Ожидаемый результат:\n${expectedOutput}` : null,
    '',
    constraints
      ? `Ограничения:\n${constraints}`
      : 'Ограничения: оставаться в scope проекта; без внешних tool execution.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function defaultExpectedOutput(mode: TaskRunnerMode): string {
  switch (mode) {
    case 'planning':
      return 'План стабилизации с owners, milestones и зависимостями — на русском языке.'
    case 'architecture':
      return 'Архитектурные заметки с рисками, инвариантами и рекомендуемыми изменениями — на русском языке.'
    case 'technical_audit':
      return 'Список findings аудита с severity и рекомендациями по исправлению — на русском языке.'
    case 'qa_review':
      return 'Результаты QA checklist с pass/fail gates и blockers — на русском языке.'
    case 'devops_plan':
      return 'План deployment/readiness с rollback и verification steps — на русском языке.'
    case 'handoff_preparation':
      return 'Handoff-пакет для Codex со scope, files и acceptance criteria — на русском языке.'
    case 'documentation':
      return 'Черновик report или documentation section для review Owner — на русском языке.'
    case 'product_review':
      return 'Product review с demo readiness и решениями Owner — на русском языке.'
    default:
      return 'Прикладной deliverable для review Owner — на русском языке.'
  }
}
