/**
 * AI Employees registry (mock).
 *
 * Single source for the IT Company "staff list" — the current and planned
 * digital roles. Data is mock for now; later this can be backed by an API.
 * Mirrors the roles documented in docs/ai-company/.
 */

export type AIEmployeeStatus = 'Active' | 'Planned'

export interface AIEmployee {
  id: string
  /** Codename, if the role has one (e.g. MAX). */
  codename?: string
  /** Role title. */
  role: string
  status: AIEmployeeStatus
  /** One-line mission. */
  mission: string
}

export const AI_EMPLOYEES: AIEmployee[] = [
  {
    id: 'ai-developer',
    codename: 'MAX',
    role: 'AI Developer',
    status: 'Active',
    mission: 'Берёт задачи AgentTask, делает code-aware аудит/план через локальную модель.',
  },
  { id: 'ai-qa', role: 'AI QA', status: 'Planned', mission: 'Проверяет изменения: тесты и smoke до ревью человеком.' },
  { id: 'ai-architect', role: 'AI Architect', status: 'Planned', mission: 'Декомпозиция задач и безопасные планы изменений.' },
  { id: 'ai-devops', role: 'AI DevOps', status: 'Planned', mission: 'Готовит деплой-планы и smoke; деплой только после approval.' },
  { id: 'ai-pm', role: 'AI Product Manager', status: 'Planned', mission: 'Превращает запросы в задачи, отслеживает статусы и отчёты.' },
  { id: 'ai-designer', role: 'AI Designer', status: 'Planned', mission: 'Синхронизация дизайна и кода, поддержка дизайн-системы.' },
  { id: 'ai-support', role: 'AI Support Engineer', status: 'Planned', mission: 'Ответы по runbook и операционным вопросам из документации.' },
]

export function countByStatus(status: AIEmployeeStatus): number {
  return AI_EMPLOYEES.filter((e) => e.status === status).length
}
