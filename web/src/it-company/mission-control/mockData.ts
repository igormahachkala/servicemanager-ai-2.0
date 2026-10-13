export interface MissionControlNavItem {
  id: string
  label: string
  hint: string
}

export interface MissionControlWorkspaceCard {
  id: string
  title: string
  value: string
  note: string
}

export interface MissionControlInspectorItem {
  id: string
  title: string
  value: string
  status: 'ok' | 'warn' | 'danger'
}

export interface MissionControlActivityItem {
  id: string
  time: string
  employee: string
  title: string
  description: string
}

export const MISSION_CONTROL_NAV: MissionControlNavItem[] = [
  { id: 'overview', label: 'Обзор', hint: 'Состояние миссии' },
  { id: 'employees', label: 'Сотрудники', hint: 'Цифровой персонал' },
  { id: 'tasks', label: 'Задачи', hint: 'Работа в очереди' },
  { id: 'builds', label: 'Сборки', hint: 'Поток CI и развёртывания' },
  { id: 'prs', label: 'PR', hint: 'Очередь ревью' },
  { id: 'mcp', label: 'MCP', hint: 'Состояние коннекторов' },
]

export const MISSION_CONTROL_WORKSPACE: MissionControlWorkspaceCard[] = [
  { id: 'board', title: 'Рабочая доска', value: '12 дорожек', note: 'Поток задач, очередь ревью и прогресс сдачи' },
  { id: 'focus', title: 'Текущий фокус', value: '3 блокера', note: 'Ожидание ревью, сбой сборки, процесс приёмки' },
  { id: 'throughput', title: 'Пропускная способность', value: '18 задач', note: 'Демо-тренд для каркаса центра управления' },
  { id: 'stability', title: 'Стабильность', value: '96%', note: 'Заготовка метрики для будущей телеметрии' },
]

export const MISSION_CONTROL_INSPECTOR: MissionControlInspectorItem[] = [
  { id: 'owner', title: 'Ответственный', value: 'Команда платформы', status: 'ok' },
  { id: 'sprint', title: 'Спринт', value: 'Основа центра управления', status: 'ok' },
  { id: 'risk', title: 'Риск', value: 'Контракт приёмки не согласован', status: 'warn' },
  { id: 'deploy', title: 'Развёртывание', value: 'Готово к Stage', status: 'ok' },
  { id: 'review', title: 'Ревью', value: '2 PR ждут ревью', status: 'warn' },
]

export const MISSION_CONTROL_ACTIVITY: MissionControlActivityItem[] = [
  {
    id: 'mc-a1',
    time: '10:42',
    employee: 'developer',
    title: 'TASK_COMPLETED',
    description: 'Завершил связку жизненного цикла заявки в сервисном слое и подготовил следующий набор правок.',
  },
  {
    id: 'mc-a2',
    time: '10:18',
    employee: 'devops',
    title: 'BUILD_SUCCESS',
    description: 'Сборка Stage прошла после чистки неиспользуемых мобильных символов.',
  },
  {
    id: 'mc-a3',
    time: '09:51',
    employee: 'qa',
    title: 'TASK_STARTED',
    description: 'Начал проверку нового центра управления и состояний жизненного цикла приёмки.',
  },
  {
    id: 'mc-a4',
    time: '09:22',
    employee: 'pm',
    title: 'PR_OPENED',
    description: 'Открыл планирование основы центра управления и будущих виджетов телеметрии.',
  },
]
