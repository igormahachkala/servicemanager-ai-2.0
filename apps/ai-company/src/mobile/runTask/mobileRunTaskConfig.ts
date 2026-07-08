import type { WorkPriority } from '../../domain/employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'

export type MobileRunTaskEmployeeId = string

export type MobileRunTaskEmployeeOption = {
  id: MobileRunTaskEmployeeId
  codename: string
  role: string
  enabled: boolean
}

export type MobileTaskTemplateId =
  | 'review_ui'
  | 'review_architecture'
  | 'find_bugs'
  | 'cursor_handoff'
  | 'prepare_report'

export type MobileTaskTemplate = {
  id: MobileTaskTemplateId
  title: string
  taskText: string
  expectedOutput: string
  priority: WorkPriority
}

/** V1 roster — extensible; not MAX-only. */
export const MOBILE_RUN_TASK_EMPLOYEES: MobileRunTaskEmployeeOption[] = [
  {
    id: MAX_WORKER_EMPLOYEE_ID,
    codename: 'MAX',
    role: 'Senior Engineer',
    enabled: true,
  },
  {
    id: 'ag-cto',
    codename: 'Atlas',
    role: 'CTO / Architect',
    enabled: false,
  },
  {
    id: 'ag-qa',
    codename: 'Sentinel',
    role: 'QA Engineer',
    enabled: false,
  },
]

export const MOBILE_TASK_TEMPLATES: MobileTaskTemplate[] = [
  {
    id: 'review_ui',
    title: 'Проверить интерфейс',
    taskText:
      'Проверить пользовательский интерфейс продукта: ключевые экраны, состояния empty/loading/error, mobile vs desktop, соответствие design system.',
    expectedOutput:
      'Список UX/UI замечаний с приоритетами и конкретными экранами. Рекомендации Owner по следующему шагу.',
    priority: 'medium',
  },
  {
    id: 'review_architecture',
    title: 'Проверить архитектуру',
    taskText:
      'Провести архитектурный обзор: границы модулей, multi-tenant invariants, зависимости между слоями, риски для Owner flow.',
    expectedOutput:
      'Краткий architecture brief: что хорошо, что рискованно, что исправить в первую очередь.',
    priority: 'high',
  },
  {
    id: 'find_bugs',
    title: 'Найти ошибки',
    taskText:
      'Найти ошибки и регрессии в текущем scope: воспроизводимые шаги, severity, затронутые flow Owner и сотрудников.',
    expectedOutput:
      'Bug list с шагами воспроизведения, severity и предложением fix или follow-up задачи.',
    priority: 'high',
  },
  {
    id: 'cursor_handoff',
    title: 'Подготовить задачу для Cursor',
    taskText:
      'Подготовить чёткое техническое задание для Cursor Automation: scope, файлы, acceptance criteria, ограничения и expected diff.',
    expectedOutput:
      'Handoff-ready brief для Cursor: цель, шаги, файлы, критерии готовности, риски.',
    priority: 'medium',
  },
  {
    id: 'prepare_report',
    title: 'Сформировать отчёт',
    taskText:
      'Сформировать отчёт для Owner по выполненной работе: что сделано, риски, блокеры, что требует решения Owner.',
    expectedOutput:
      'Structured report: summary, findings, decisions needed, recommended next actions.',
    priority: 'medium',
  },
]

export function isMobileTaskTemplateId(value: string): value is MobileTaskTemplateId {
  return MOBILE_TASK_TEMPLATES.some((item) => item.id === value)
}

export function findMobileRunTaskEmployee(id: string): MobileRunTaskEmployeeOption | undefined {
  return MOBILE_RUN_TASK_EMPLOYEES.find((item) => item.id === id)
}

export function findMobileTaskTemplate(id: MobileTaskTemplateId): MobileTaskTemplate | undefined {
  return MOBILE_TASK_TEMPLATES.find((item) => item.id === id)
}

export function deriveTaskTitle(taskText: string, explicitTitle?: string): string {
  const trimmed = explicitTitle?.trim()
  if (trimmed) return trimmed
  const firstLine = taskText.trim().split('\n')[0]?.trim() ?? ''
  if (firstLine.length <= 100) return firstLine
  return `${firstLine.slice(0, 97)}…`
}

export function isEnabledMobileRunTaskEmployee(id: string): boolean {
  return findMobileRunTaskEmployee(id)?.enabled === true
}

export function isMobileRunTaskFormValid(title: string, taskText: string): boolean {
  return taskText.trim().length > 0 && deriveTaskTitle(taskText, title).trim().length > 0
}
