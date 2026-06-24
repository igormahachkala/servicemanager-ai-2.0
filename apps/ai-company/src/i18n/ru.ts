import type { Messages } from './en'

export const ru: Messages = {
  nav: {
    flow: 'Flow',
    missionControl: 'Mission Control',
    organization: 'Организация',
    employees: 'Сотрудники',
    tasks: 'Задачи',
    feed: 'Лента',
    tools: 'Инструменты',
  },
  labels: {
    active: 'Активные',
    planned: 'Планируемые',
    models: 'Модели',
    codingAgents: 'Coding Agents',
    integrations: 'Интеграции',
    currentTask: 'Текущая задача',
    availableTools: 'Доступные инструменты',
    lastActivity: 'Последняя активность',
    status: 'Статус',
    model: 'Модель',
    role: 'Роль',
    agent: 'Агент',
    load: 'Нагрузка',
  },
  pages: {
    missionControl: 'Mission Control',
    missionFeed: 'Лента событий',
    toolsRegistry: 'Реестр AI-инструментов',
    employees: 'Сотрудники',
    organization: 'Организация',
    tasks: 'Задачи',
  },
  inspector: {
    title: 'Инспектор сотрудника',
    collapse: 'Свернуть инспектор',
    activityTimeline: 'Хронология активности',
    lastRun: 'последний запуск',
    noEventsYet: 'событий пока нет',
    ago: 'назад',
    noRecentActivity: 'Нет недавней активности',
  },
  employees: {
    description:
      'V1 — активные агенты работают сейчас; планируемые видны для проектирования оргструктуры.',
    agents: 'агентов',
  },
  tools: {
    pageDescription: 'Модели, coding agents и интеграции — локальный реестр V1.',
    modelsDescription: 'LLM-рантаймы, доступные агентам',
    codingAgentsDescription: 'Автономные coding- и IDE-агенты',
    integrationsDescription: 'MCP и инфраструктурные коннекторы',
    items: 'записей',
  },
  status: {
    online: 'Online',
    working: 'Working',
    building: 'Building',
    reviewing: 'Reviewing',
    idle: 'Idle',
  },
  brand: {
    title: 'AI Company',
    subtitle: 'local V1',
    env: 'mock · localhost',
  },
}
