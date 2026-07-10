import type { WorkPriority } from '../../domain/employeeWorkQueue'
import { getEmployee } from '../../domain/employeeRegistry'
import {
  hasMobileEmployeeCapability,
  listMobileEmployeeRegistry,
} from '../../domain/mobileEmployee'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'

export type MobileRunTaskEmployeeId = string

export type MobileRunTaskEmployeeOption = {
  id: MobileRunTaskEmployeeId
  codename: string
  role: string
  enabled: boolean
}

export type MobileTaskTemplateId =
  | 'standard_health_check'
  | 'review_ui'
  | 'review_architecture'
  | 'find_bugs'
  | 'cursor_handoff'
  | 'prepare_report'

export type MobileTaskTemplate = {
  id: MobileTaskTemplateId
  /** Card label in template picker; falls back to title. */
  label?: string
  title: string
  taskText: string
  expectedOutput: string
  priority: WorkPriority
}

/** Default Owner quick-start template — first in mobile Run Task list. */
export const MOBILE_STANDARD_TASK_TEMPLATE_ID: MobileTaskTemplateId = 'standard_health_check'

const MOBILE_RUN_TASK_PLACEHOLDER_EMPLOYEES: MobileRunTaskEmployeeOption[] = [
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

/** V1 roster — enabled employees from mobile registry + disabled placeholders. */
export function buildMobileRunTaskEmployees(): MobileRunTaskEmployeeOption[] {
  const active = listMobileEmployeeRegistry()
    .filter((entry) => hasMobileEmployeeCapability(entry.employeeId, 'work_queue'))
    .map((entry) => {
      const registry = getEmployee(entry.employeeId)
      const conversation = resolveEmployee(entry.employeeId)
      return {
        id: entry.employeeId,
        codename: registry?.displayName ?? conversation?.codename ?? entry.employeeId,
        role: registry?.role.title ?? conversation?.role ?? '',
        enabled: true,
      }
    })

  const activeIds = new Set(active.map((item) => item.id))
  const placeholders = MOBILE_RUN_TASK_PLACEHOLDER_EMPLOYEES.filter(
    (item) => !activeIds.has(item.id),
  )

  return [...active, ...placeholders]
}

/** @deprecated prefer buildMobileRunTaskEmployees() for fresh roster */
export const MOBILE_RUN_TASK_EMPLOYEES: MobileRunTaskEmployeeOption[] =
  buildMobileRunTaskEmployees()

export const MOBILE_TASK_TEMPLATES: MobileTaskTemplate[] = [
  {
    id: 'standard_health_check',
    label: 'Стандартная проверка AI Company',
    title: 'Проверить состояние AI Company',
    taskText:
      'Проверь текущее состояние AI Company: рабочий день MAX, очередь задач, последние отчёты, решения Owner и возможные проблемы. Сформируй краткий отчёт, что работает, что требует внимания и какой следующий шаг.',
    expectedOutput:
      'Краткий отчёт о состоянии AI Company и список следующих действий.',
    priority: 'medium',
  },
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
  return buildMobileRunTaskEmployees().find(
    (item) => item.id === resolveCanonicalEmployeeId(id),
  )
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

export { MAX_WORKER_EMPLOYEE_ID }
