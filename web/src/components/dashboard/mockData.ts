export type DashboardKpiItem = {
  id: string
  label: string
  value: string
  hint: string
  tone: 'blue' | 'green' | 'amber' | 'red'
}

export type DashboardActionItem = {
  id: string
  title: string
  description: string
  to: string
  cta: string
}

export type DashboardEventItem = {
  id: string
  time: string
  title: string
  description: string
  tone: 'blue' | 'green' | 'amber' | 'red'
}

export type DashboardTeamLoadItem = {
  id: string
  name: string
  role: string
  load: number
  note: string
}

export type DashboardAcceptanceQueueItem = {
  id: string
  ticket: string
  title: string
  owner: string
  status: 'awaiting_acceptance' | 'blocked' | 'needs_review'
  hint: string
}

export const DASHBOARD_KPIS: DashboardKpiItem[] = [
  {
    id: 'active-projects',
    label: 'Активные проекты',
    value: '4',
    hint: '1 демо · 3 направления сдачи',
    tone: 'blue',
  },
  {
    id: 'employees-working',
    label: 'Сотрудников в работе',
    value: '7',
    hint: '2 в работе · 1 на передаче',
    tone: 'green',
  },
  {
    id: 'acceptance-queue',
    label: 'Очередь приёмки',
    value: '3',
    hint: '2 waiting client review',
    tone: 'amber',
  },
  {
    id: 'open-alerts',
    label: 'Открытые предупреждения',
    value: '1',
    hint: 'Риск таймаута среды',
    tone: 'red',
  },
]

export const DASHBOARD_ACTIONS: DashboardActionItem[] = [
  {
    id: 'canvas',
    title: 'Карта компании',
    description: 'Посмотреть живой граф компании по активному проекту.',
    to: '/ops/canvas?projectId=project-ai-photo-lab',
    cta: 'Открыть карту',
  },
  {
    id: 'control-room',
    title: 'Центр проекта',
    description: 'Состояние проекта, работа в движении и сигналы по сдаче.',
    to: '/ops/projects/project-ai-photo-lab/control-room',
    cta: 'Открыть центр проекта',
  },
  {
    id: 'runtime',
    title: 'Среда выполнения',
    description: 'Состояние провайдера, запуски и статус конвейера выполнения.',
    to: '/ops/runtime/live',
    cta: 'Открыть среду',
  },
  {
    id: 'timeline',
    title: 'Хроника компании',
    description: 'Последние рабочие события, согласования и отчёты.',
    to: '/ops/timeline',
    cta: 'Открыть хронику',
  },
]

export const DASHBOARD_EVENTS: DashboardEventItem[] = [
  {
    id: 'event-1',
    time: '09:42',
    title: 'ИИ-техдиректор завершил проверку среды',
    description: 'Журналы среды проверены, провайдер Ollama остался исправен.',
    tone: 'green',
  },
  {
    id: 'event-2',
    time: '09:28',
    title: 'MAX открыл задачу в очереди приёмки',
    description: 'Заявка №248 ждёт приёмки клиентом.',
    tone: 'amber',
  },
  {
    id: 'event-3',
    time: '09:14',
    title: 'Контроль качества собрал черновик отчёта',
    description: 'Доказательства выполнения готовы к проверке в потоке отчётов.',
    tone: 'blue',
  },
  {
    id: 'event-4',
    time: '08:56',
    title: 'DevOps отметил предупреждение среды',
    description: 'Последний запуск завершился с частичным предупреждением, а не критическим сбоем.',
    tone: 'red',
  },
]

export const DASHBOARD_TEAM_LOAD: DashboardTeamLoadItem[] = [
  {
    id: 'employee-ai-cto',
    name: 'AI CTO',
    role: 'Архитектурный надзор',
    load: 82,
    note: 'Сосредоточен на среде выполнения и границах платформы',
  },
  {
    id: 'employee-max',
    name: 'MAX',
    role: 'Поддержка ассистента',
    load: 64,
    note: 'Поддерживает приёмку и экраны чата',
  },
  {
    id: 'employee-qa',
    name: 'QA',
    role: 'Проверка',
    load: 48,
    note: 'Готовит дымовые проверки к сдаче',
  },
]

export const DASHBOARD_ACCEPTANCE_QUEUE: DashboardAcceptanceQueueItem[] = [
  {
    id: 'acceptance-1',
    ticket: '#251',
    title: 'Доработка после осмотра конвейера',
    owner: 'Ждёт приёмки клиентом',
    status: 'awaiting_acceptance',
    hint: 'Нужно итоговое решение клиента',
  },
  {
    id: 'acceptance-2',
    ticket: '#248',
    title: 'Проблема с освещением в зале',
    owner: 'Нужны фотодоказательства',
    status: 'needs_review',
    hint: 'Ожидается более чёткое фото с места',
  },
  {
    id: 'acceptance-3',
    ticket: '#243',
    title: 'Настройка воздушной завесы',
    owner: 'Заблокировано без комментария',
    status: 'blocked',
    hint: 'Перед закрытием нужен комментарий приёмки',
  },
]
