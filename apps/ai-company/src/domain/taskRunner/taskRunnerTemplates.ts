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

export function buildTaskRunnerPrompt(input: TaskRunnerInput): string {
  const title = (input.title?.trim() || extractTitleFromTaskText(input.taskText)).slice(0, 160)
  const constraints = input.constraints.trim()
  const expectedOutput = input.expectedOutput.trim()

  return [
    `You are executing an Owner-assigned task in AI Company.`,
    '',
    `Mode: ${input.mode.replace(/_/g, ' ')}`,
    `Project: ${input.projectId}`,
    `Workspace: ${input.workspaceId}`,
    '',
    `Task title: ${title}`,
    '',
    'Owner task (paste from chat or briefing):',
    input.taskText.trim(),
    '',
    expectedOutput ? `Expected output:\n${expectedOutput}` : 'Expected output: concise actionable deliverable.',
    '',
    constraints ? `Constraints:\n${constraints}` : 'Constraints: stay within project scope; no external tool execution.',
    '',
    'Respond with a structured deliverable: summary, findings, recommended next steps, and risks if any.',
  ].join('\n')
}

export function defaultExpectedOutput(mode: TaskRunnerMode): string {
  switch (mode) {
    case 'planning':
      return 'Stabilization plan with owners, milestones, and dependencies.'
    case 'architecture':
      return 'Architecture notes with risks, invariants, and recommended changes.'
    case 'technical_audit':
      return 'Audit findings list with severity and fix recommendations.'
    case 'qa_review':
      return 'QA checklist results with pass/fail gates and blockers.'
    case 'devops_plan':
      return 'Deployment/readiness plan with rollback and verification steps.'
    case 'handoff_preparation':
      return 'Codex-ready handoff package with scope, files, and acceptance criteria.'
    case 'documentation':
      return 'Draft report or documentation section ready for Owner review.'
    case 'product_review':
      return 'Product review with demo readiness and owner decisions.'
    default:
      return 'Actionable deliverable for Owner review.'
  }
}
