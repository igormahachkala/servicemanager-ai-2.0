import { getProfileBySlug } from '../employees/profiles'

export type EmployeeActivityType =
  | 'TASK_CREATED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'BUILD_STARTED'
  | 'BUILD_SUCCESS'
  | 'BUILD_FAILED'
  | 'PR_OPENED'
  | 'PR_MERGED'
  | 'MCP_CONNECTED'

export interface EmployeeActivityItem {
  id: string
  employeeId: string
  type: EmployeeActivityType
  timestamp: string
  title: string
  description: string
}

export const EMPLOYEE_ACTIVITY: EmployeeActivityItem[] = [
  {
    id: 'act-010',
    employeeId: 'devops',
    type: 'MCP_CONNECTED',
    timestamp: '2026-06-19T10:05:00+05:00',
    title: 'MCP connected',
    description: 'Docker MCP подключён для проверки stage-контейнеров и логов.',
  },
  {
    id: 'act-009',
    employeeId: 'developer',
    type: 'PR_MERGED',
    timestamp: '2026-06-19T09:42:00+05:00',
    title: 'PR merged',
    description: 'Слит hotfix для мобильного чата и acceptance flow в основную ветку.',
  },
  {
    id: 'act-008',
    employeeId: 'qa',
    type: 'BUILD_SUCCESS',
    timestamp: '2026-06-19T09:18:00+05:00',
    title: 'Build passed',
    description: 'Smoke-прогон мобильного сценария завершён без регрессий.',
  },
  {
    id: 'act-007',
    employeeId: 'architect',
    type: 'TASK_COMPLETED',
    timestamp: '2026-06-19T08:54:00+05:00',
    title: 'Design review completed',
    description: 'Подготовлен план расширения Mission Control под activity timeline.',
  },
  {
    id: 'act-006',
    employeeId: 'pm',
    type: 'TASK_CREATED',
    timestamp: '2026-06-19T08:31:00+05:00',
    title: 'New task created',
    description: 'Сформирована задача на аудит provider visibility для stage.',
  },
  {
    id: 'act-005',
    employeeId: 'support',
    type: 'TASK_STARTED',
    timestamp: '2026-06-19T08:12:00+05:00',
    title: 'Investigation started',
    description: 'Собран контекст по инциденту с login_failed в stage-воркфлоу.',
  },
  {
    id: 'act-004',
    employeeId: 'devops',
    type: 'BUILD_FAILED',
    timestamp: '2026-06-18T18:24:00+05:00',
    title: 'Build failed',
    description: 'Проверка Docker deploy упала на несогласованной конфигурации env.',
  },
  {
    id: 'act-003',
    employeeId: 'designer',
    type: 'PR_OPENED',
    timestamp: '2026-06-18T17:58:00+05:00',
    title: 'Draft PR opened',
    description: 'Открыт draft PR с обновлённым mobile top bar для review.',
  },
  {
    id: 'act-002',
    employeeId: 'developer',
    type: 'TASK_FAILED',
    timestamp: '2026-06-18T17:26:00+05:00',
    title: 'Task failed',
    description: 'Проверка ownership flow выявила конфликт между provider и client scope.',
  },
  {
    id: 'act-001',
    employeeId: 'qa',
    type: 'TASK_STARTED',
    timestamp: '2026-06-18T16:47:00+05:00',
    title: 'QA smoke started',
    description: 'Начат smoke-check ticket lifecycle после acceptance fix.',
  },
]

export function getEmployeeActivityEmployeeName(employeeId: string): string {
  const profile = getProfileBySlug(employeeId)
  return profile?.name ?? employeeId
}
