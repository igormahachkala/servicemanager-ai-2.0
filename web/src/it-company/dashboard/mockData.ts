import type { DashboardTone } from './components/DashboardMetricCard'

/**
 * MOCK data for the IT Company dashboard (IT-004).
 *
 * Intentionally static — NO backend, NO AgentTask API, NO real queries. This is
 * the visual foundation; real data wiring is a later task. Everything here is a
 * placeholder and should be treated as demo content.
 */

export interface DashboardStat {
  id: string
  label: string
  value: number
  tone: DashboardTone
  hint?: string
}

export interface TodayItem {
  id: string
  label: string
  value: string
}

export interface ActivityItem {
  id: string
  time: string
  text: string
  tone?: DashboardTone
}

export interface EmployeeRow {
  id: string
  name: string
  role: string
  done: number
  active: number
  comingSoon?: boolean
}

/** Top metric cards: Employees / Active Tasks / Waiting Review / Failed Tasks / Open PRs. */
export const DASHBOARD_STATS: DashboardStat[] = [
  { id: 'employees', label: 'Сотрудники', value: 1, tone: 'violet', hint: 'AI Developer' },
  { id: 'activeTasks', label: 'Активные задачи', value: 3, tone: 'amber' },
  { id: 'waitingReview', label: 'Ждут ревью', value: 2, tone: 'blue', hint: 'Draft PR' },
  { id: 'failedTasks', label: 'Ошибки', value: 1, tone: 'red' },
  { id: 'openPrs', label: 'Открытые PR', value: 2, tone: 'green' },
]

/** "Today" snapshot. */
export const TODAY_ITEMS: TodayItem[] = [
  { id: 'created', label: 'Создано задач', value: '4' },
  { id: 'prOpened', label: 'Открыто draft PR', value: '1' },
  { id: 'checks', label: 'Проверок пройдено', value: '6' },
  { id: 'done', label: 'Завершено', value: '2' },
]

/** Recent activity feed. */
export const RECENT_ACTIVITY: ActivityItem[] = [
  { id: 'a1', time: '10:24', text: 'AI Developer открыл draft PR agent/SMA-ENG-015-architecture-memory', tone: 'green' },
  { id: 'a2', time: '09:50', text: 'Задача «Экспорт акта в PDF» → В работе', tone: 'amber' },
  { id: 'a3', time: '09:12', text: 'Создана задача «Рефактор модуля tickets»', tone: 'blue' },
  { id: 'a4', time: 'Вчера', text: 'Задача «Аудит permissions» завершена', tone: 'green' },
  { id: 'a5', time: 'Вчера', text: 'Задача «Миграция отчётов» завершилась с ошибкой', tone: 'red' },
]

/** Top employees (digital workers). Future agents shown as "coming soon". */
export const TOP_EMPLOYEES: EmployeeRow[] = [
  { id: 'ai-developer', name: 'AI Developer', role: 'Цифровой разработчик', done: 12, active: 3 },
  { id: 'qa-agent', name: 'QA Agent', role: 'Скоро', done: 0, active: 0, comingSoon: true },
  { id: 'devops-agent', name: 'DevOps Agent', role: 'Скоро', done: 0, active: 0, comingSoon: true },
]
