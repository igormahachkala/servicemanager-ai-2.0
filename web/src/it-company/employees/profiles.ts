/**
 * AI Employee profiles (mock) — canonical source for the IT Company staff.
 *
 * Mirrors the roles in docs/ai-company/. The summary registry (registry.ts) is
 * derived from these profiles, so there is a single source of truth. Mock data;
 * no API.
 */

export type AIEmployeeStatus = 'Active' | 'Planned'

/**
 * Подписи статуса для интерфейса.
 *
 * Сами значения статуса — идентификаторы: по ним считает countByStatus и
 * выбирает цвет statusStyle, поэтому переводить их нельзя. Прежде страницы
 * печатали идентификатор прямо на экран, из-за чего в русском интерфейсе
 * висели «Active» и «Planned».
 */
export const AI_EMPLOYEE_STATUS_LABELS_RU: Record<AIEmployeeStatus, string> = {
  Active: 'Активен',
  Planned: 'Запланирован',
}

export interface AIEmployeeProfile {
  id: string
  slug: string
  name: string
  codename?: string
  status: AIEmployeeStatus
  mission: string
  model: string
  workspace: string
  mcpAccess: string[]
  capabilities: string[]
  plannedFeatures: string[]
}

export const AI_EMPLOYEE_PROFILES: AIEmployeeProfile[] = [
  {
    id: 'ai-developer',
    slug: 'developer',
    name: 'ИИ-разработчик',
    codename: 'MAX',
    status: 'Active',
    mission: 'Берёт задачи AgentTask и делает code-aware аудит/план изменений по реальному коду.',
    model: 'Qwen 27B (local Ollama)',
    workspace: 'ИИ-разработчик',
    mcpAccess: ['GitHub', 'Docker', 'PostgreSQL', 'Playwright'],
    capabilities: [
      'Чтение кода в пределах CODE_ROOT (allowlist, redact секретов)',
      'AUDIT и PLAN режимы (автоопределение)',
      'Fast Context Mode: профили модулей + project index + summary cache',
      'Запись результата обратно в AgentTask (read-only исполнение)',
    ],
    plannedFeatures: [
      'Patch Preview (предлагать diff без применения)',
      'PR-only режим (ветка + PR, без merge)',
    ],
  },
  {
    id: 'ai-qa',
    slug: 'qa',
    name: 'ИИ-тестировщик',
    status: 'Planned',
    mission: 'Проверяет изменения до ревью человеком: тесты и smoke, предотвращает регрессии.',
    model: 'TBD',
    workspace: 'ИИ-тестировщик',
    mcpAccess: ['Playwright', 'PostgreSQL (RO)', 'GitHub (read)'],
    capabilities: [],
    plannedFeatures: ['Прогон тест-сьюта', 'Playwright smoke', 'Вердикт pass/fail по PR'],
  },
  {
    id: 'ai-architect',
    slug: 'architect',
    name: 'ИИ-архитектор',
    status: 'Planned',
    mission: 'Декомпозирует задачи и готовит безопасные планы изменений, следит за архитектурной согласованностью.',
    model: 'TBD',
    workspace: 'ИИ-архитектор',
    mcpAccess: ['GitHub (read)', 'PostgreSQL (RO)', 'Figma (read)'],
    capabilities: [],
    plannedFeatures: ['Change plan (Task/Files/Changes/...)', 'Разбивка задач', 'Ревью вывода Developer'],
  },
  {
    id: 'ai-devops',
    slug: 'devops',
    name: 'ИИ-DevOps',
    status: 'Planned',
    mission: 'Готовит и документирует деплои; безопасно оперирует Stage.',
    model: 'TBD',
    workspace: 'ИИ-DevOps',
    mcpAccess: ['Docker', 'PostgreSQL (RO)'],
    capabilities: [],
    plannedFeatures: ['Runbook backup→deploy→migrate-status→smoke', 'Деплой только после approval', 'Никогда Production'],
  },
  {
    id: 'ai-pm',
    slug: 'pm',
    name: 'ИИ-продакт-менеджер',
    status: 'Planned',
    mission: 'Превращает запросы в задачи AgentTask, отслеживает статусы и готовит отчёты.',
    model: 'TBD',
    workspace: 'ИИ-продакт-менеджер',
    mcpAccess: ['GitHub (read)', 'PostgreSQL (RO)'],
    capabilities: [],
    plannedFeatures: ['Триаж запросов → AgentTask', 'Сводки статусов', 'Отчёты'],
  },
  {
    id: 'ai-designer',
    slug: 'designer',
    name: 'ИИ-дизайнер',
    status: 'Planned',
    mission: 'Синхронизирует дизайн и код, поддерживает дизайн-систему.',
    model: 'TBD',
    workspace: 'ИИ-дизайнер',
    mcpAccess: ['Figma', 'GitHub (read)'],
    capabilities: [],
    plannedFeatures: ['Code Connect маппинги', 'Дизайн-спеки', 'UI-предложения (без merge)'],
  },
  {
    id: 'ai-support',
    slug: 'support',
    name: 'ИИ-инженер поддержки',
    status: 'Planned',
    mission: 'Отвечает на операционные/runbook вопросы из документации и read-only данных.',
    model: 'TBD',
    workspace: 'ИИ-поддержка',
    mcpAccess: ['PostgreSQL (RO)'],
    capabilities: [],
    plannedFeatures: ['Ответы по runbook', 'Указатели на документацию', 'Черновики инцидент-нот'],
  },
]

export function getProfileBySlug(slug: string): AIEmployeeProfile | undefined {
  return AI_EMPLOYEE_PROFILES.find((p) => p.slug === slug)
}
