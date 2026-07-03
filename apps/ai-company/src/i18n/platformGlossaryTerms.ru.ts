import type { GlossaryTermMessages } from '../domain/guided/platformGlossary'

export const platformGlossaryTermsRu: Record<string, GlossaryTermMessages> = {
  runtime: {
    label: 'Runtime',
    summary:
      'Локальный движок выполнения для цифровых сотрудников — собирает контекст, вызывает модели и создаёт отчёты.',
    tooltip:
      'Локальный движок выполнения для цифровых сотрудников — собирает контекст, вызывает модели и создаёт отчёты.',
    description:
      'Runtime — on-device pipeline AI Company. Загружает профиль, память, знания и текст задачи; через Model Router вызывает провайдера; пишет логи; по завершении сохраняет отчёты, результаты задач и обновления памяти.',
    whereUsed:
      'Run Task, Live Runtime, настройки Runtime, runtime-страницы сотрудников, Control Room и фазы runtime в операционном дне.',
    related: [
      { label: 'Настройки Runtime', path: '/ops/runtime' },
      { label: 'Live-монитор Runtime', path: '/ops/runtime/live' },
      { label: 'Запуск задачи', path: '/ops/run-task' },
    ],
  },
  workspace: {
    label: 'Рабочее пространство',
    summary:
      'Рабочая среда одного цифрового сотрудника — задачи, запуски, чаты и уведомления в одном месте.',
    tooltip:
      'Рабочая среда одного цифрового сотрудника — задачи, запуски, чаты и уведомления в одном месте.',
    description:
      'Workspace — ежедневный стол одного сотрудника: текущие назначения, рекомендации, недавние отчёты и знания в scope workspace. Owner управляет одним агентом без потери контекста всей компании.',
    whereUsed:
      'Workspace сотрудника, переключатель workspace в header, секции сотрудников в операционном дне и панели команды Control Room.',
    related: [
      { label: 'Рабочие пространства', path: '/ops/workspaces' },
      { label: 'Workspace сотрудника', path: '/ops/employees/ag-max/workspace' },
      { label: 'Присутствие', path: '/ops/presence' },
    ],
  },
  sprint: {
    label: 'Спринт',
    summary: 'Ограниченный по времени цикл delivery с целями, задачами и отслеживанием прогресса.',
    tooltip: 'Ограниченный по времени цикл delivery с целями, задачами и отслеживанием прогресса.',
    description:
      'Спринт организует работу короткими циклами: заявленная цель, взятые задачи и видимость прогресса. Связывает пресеты Kickoff, очередь Control Room и check-in операционного дня.',
    whereUsed: 'Страница спринта, фаза спринта в операционном дне, цель в Kickoff и tracking delivery в Control Room.',
    related: [
      { label: 'Спринт', path: '/ops/sprint' },
      { label: 'Операционный день', path: '/ops/day' },
      { label: 'Control Room AI Photo Lab', path: '/ops/projects/project-ai-photo-lab/control-room' },
    ],
  },
  controlRoom: {
    label: 'Control Room AI Photo Lab',
    summary: 'Командный пункт проекта — очередь, риски, runtime, согласования и handoffs на одном экране.',
    tooltip: 'Командный пункт проекта — очередь, риски, runtime, согласования и handoffs на одном экране.',
    description:
      'Control Room — delivery cockpit проекта (например AI Photo Lab): очередь задач, активные запуски, реестр рисков, готовность к демо, ожидающие согласования и внешние handoffs без переключения экранов.',
    whereUsed: 'Control Room AI Photo Lab, ссылки из Kickoff и project-секции операционного дня.',
    related: [
      { label: 'Control Room AI Photo Lab', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Kickoff AI Photo Lab', path: '/ops/projects/project-ai-photo-lab/kickoff' },
      { label: 'Передачи работы', path: '/ops/handoffs' },
    ],
  },
  kickoff: {
    label: 'Kickoff AI Photo Lab',
    summary: 'Структурированный старт проекта — цель спринта, пресеты команды, QA-чеклист и задачи в один клик.',
    tooltip: 'Структурированный старт проекта — цель спринта, пресеты команды, QA-чеклист и задачи в один клик.',
    description:
      'Kickoff переводит проект в исполнимое состояние: цель спринта, preset-задачи для цифровых сотрудников, QA gates и переход в Control Room для ongoing delivery.',
    whereUsed: 'Kickoff AI Photo Lab и onboarding flows из Projects.',
    related: [
      { label: 'Kickoff AI Photo Lab', path: '/ops/projects/project-ai-photo-lab/kickoff' },
      { label: 'Control Room AI Photo Lab', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Запуск задачи', path: '/ops/run-task' },
    ],
  },
  approval: {
    label: 'Согласование',
    summary: 'Gate Owner перед чувствительными действиями — cloud runtime, инструменты, production или handoffs.',
    tooltip: 'Gate Owner перед чувствительными действиями — cloud runtime, инструменты, production или handoffs.',
    description:
      'Согласования защищают от необратимых или дорогих действий. Runtime может ждать approval cloud execution, использования инструмента, публикации или отправки handoff внешнему исполнителю.',
    whereUsed:
      'Inbox согласований, алерты Command Center, проверка Task Results, gates Control Room и рекомендации Work Scheduler.',
    related: [
      { label: 'Согласования', path: '/ops/approvals' },
      { label: 'Командный центр', path: '/ops' },
      { label: 'Итоги задач', path: '/ops/task-results' },
    ],
  },
  taskResult: {
    label: 'Результат задачи',
    summary: 'Deliverable после runtime-запуска — вывод, статус проверки и follow-up действия.',
    tooltip: 'Deliverable после runtime-запуска — вывод, статус проверки и follow-up действия.',
    description:
      'Task Results фиксируют результат цифрового сотрудника: артефакты, сводку, заметки review, статус согласования и ссылки на отчёт. Точка перехода между execution и следующей planned work.',
    whereUsed: 'Список/детали Task Results, outcomes workspace и inputs Work Scheduler.',
    related: [
      { label: 'Итоги задач', path: '/ops/task-results' },
      { label: 'Отчёты', path: '/ops/reports' },
      { label: 'Запуск задачи', path: '/ops/run-task' },
    ],
  },
  memory: {
    label: 'Память',
    summary: 'Долговременные знания сотрудника — уроки и факты из завершённых запусков и проверок.',
    tooltip: 'Долговременные знания сотрудника — уроки и факты из завершённых запусков и проверок.',
    description:
      'Память хранит то, что сотрудник должен помнить между сессиями: решения, предпочтения, факты проекта и уроки после run. Обновляется после review Task Results и отчётов, а не через переполнение live prompt.',
    whereUsed: 'Память сотрудника, сборка контекста Runtime, эволюция памяти в Task Results и профиле.',
    related: [
      { label: 'Память сотрудника', path: '/ops/employees/ag-max/memory' },
      { label: 'Итоги задач', path: '/ops/task-results' },
      { label: 'Сотрудники', path: '/ops/employees' },
    ],
  },
  knowledge: {
    label: 'База знаний',
    summary: 'Curated библиотека компании — документы, коллекции и reference material для контекста Runtime.',
    tooltip: 'Curated библиотека компании — документы, коллекции и reference material для контекста Runtime.',
    description:
      'База знаний — shared reference material в scope компании/workspace. Runtime подтягивает проверенные фрагменты в prompts для согласованности с approved sources.',
    whereUsed: 'Страницы Knowledge, вкладки knowledge workspace и сборка prompt Runtime.',
    related: [
      { label: 'База знаний', path: '/ops/knowledge' },
      { label: 'Коллекции', path: '/ops/knowledge/collections' },
      { label: 'Рабочие пространства', path: '/ops/workspaces' },
    ],
  },
  canvas: {
    label: 'Canvas',
    summary: 'Визуальная карта компании — структура, потоки и live-статус на одной интерактивной surface.',
    tooltip: 'Визуальная карта компании — структура, потоки и live-статус на одной интерактивной surface.',
    description:
      'Company Canvas показывает organization, projects и execution health в spatial overview. Помогает Owner видеть связи сотрудников, workstreams и активность runtime.',
    whereUsed: 'Страница Company Canvas и preview widgets Command Center.',
    related: [
      { label: 'Canvas компании', path: '/ops/canvas' },
      { label: 'Командный центр', path: '/ops' },
      { label: 'Хронология', path: '/ops/timeline' },
    ],
  },
  employee: {
    label: 'Сотрудник',
    summary: 'Persona цифрового работника — профиль, компетенции, workspace, память и binding Runtime.',
    tooltip: 'Persona цифрового работника — профиль, компетенции, workspace, память и binding Runtime.',
    description:
      'Сотрудник — настроенный AI-агент с идентичностью, ролью, инструментами, routing preferences и career-long компетенциями. Задачи назначаются сотруднику; Runtime выполняет от его имени под oversight Owner.',
    whereUsed: 'Roster сотрудников, профили, workspaces, picker Run Task и staffing операционного дня.',
    related: [
      { label: 'Сотрудники', path: '/ops/employees' },
      { label: 'Запуск задачи', path: '/ops/run-task' },
      { label: 'Профиль сотрудника', path: '/ops/employees/ag-max' },
    ],
  },
  runtimeProvider: {
    label: 'Провайдер Runtime',
    summary: 'Backend вызовов модели — local, cloud или hybrid по профилю запуска.',
    tooltip: 'Backend вызовов модели — local, cloud или hybrid по профилю запуска.',
    description:
      'Провайдер Runtime — execution backend запуска: какой API или local engine выполняет решение Model Router. Влияет на latency, cost, privacy и необходимость согласования перед cloud.',
    whereUsed: 'Настройки Runtime, логи Live Runtime, панели провайдеров и Cost Monitor.',
    related: [
      { label: 'Настройки Runtime', path: '/ops/runtime' },
      { label: 'Live-монитор Runtime', path: '/ops/runtime/live' },
      { label: 'История запусков', path: '/ops/runs' },
    ],
  },
  modelRouter: {
    label: 'Model Router',
    summary: 'Выбирает модель и провайдера из профиля, типа задачи, режима и лимитов стоимости.',
    tooltip: 'Выбирает модель и провайдера из профиля, типа задачи, режима и лимитов стоимости.',
    description:
      'Model Router мапит run на catalog model и provider: runtime profile, классификация задачи, режим fast/deep/coding/qa и budget guards — без ручного выбора модели каждый раз.',
    whereUsed: 'Превью маршрутизации Run Task, настройки Runtime, боковая панель Live Runtime и runtime сотрудника.',
    related: [
      { label: 'Настройки Runtime', path: '/ops/runtime' },
      { label: 'Запуск задачи', path: '/ops/run-task' },
      { label: 'Live-монитор Runtime', path: '/ops/runtime/live' },
    ],
  },
  promptBuilder: {
    label: 'Prompt Builder',
    summary: 'Собирает structured instructions — system role, задача, контекст, инструменты и политика вывода.',
    tooltip: 'Собирает structured instructions — system role, задача, контекст, инструменты и политика вывода.',
    description:
      'Prompt Builder формирует финальный prompt: persona, фрагменты памяти, ссылки на knowledge, определения инструментов и ограничения вывода. Run Task и Live Runtime показывают preview перед execution.',
    whereUsed: 'Run Task, превью prompt в Live Runtime, панели execution Runtime и Visual Lab.',
    related: [
      { label: 'Запуск задачи', path: '/ops/run-task' },
      { label: 'Live-монитор Runtime', path: '/ops/runtime/live' },
      { label: 'Visual Execution Lab', path: '/ops/visual-lab' },
    ],
  },
  operatingDay: {
    label: 'Операционный день',
    summary: 'Ежедневный flow Owner — бриф, сотрудники, спринт, согласования, runtime и вечерняя сводка.',
    tooltip: 'Ежедневный flow Owner — бриф, сотрудники, спринт, согласования, runtime и вечерняя сводка.',
    description:
      'Операционный день задаёт последовательность управления компанией за день: утренний бриф, кто работает, статус спринта, backlog согласований, здоровье runtime и closing summary со ссылками на нужные экраны.',
    whereUsed: 'Страница операционного дня, next steps Command Center и быстрая навигация.',
    related: [
      { label: 'Операционный день', path: '/ops/day' },
      { label: 'Командный центр', path: '/ops' },
      { label: 'Согласования', path: '/ops/approvals' },
    ],
  },
  handoff: {
    label: 'Handoff',
    summary: 'Одобренный пакет контекста и инструкций для внешнего исполнителя после sign-off Owner.',
    tooltip: 'Одобренный пакет контекста и инструкций для внешнего исполнителя после sign-off Owner.',
    description:
      'Handoffs связывают AI Company с Codex, Cursor или людьми. Runtime готовит контекст и артефакты; Owner одобряет; пакет экспортируется для execution вне local Runtime loop.',
    whereUsed: 'Inbox handoffs, external work Control Room, follow-up Kickoff и approval workflows.',
    related: [
      { label: 'Передачи работы', path: '/ops/handoffs' },
      { label: 'Control Room AI Photo Lab', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Согласования', path: '/ops/approvals' },
    ],
  },
  execution: {
    label: 'Execution',
    summary: 'Активная и queued работа — запуски, tool calls и шаги pipeline компании.',
    tooltip: 'Активная и queued работа — запуски, tool calls и шаги pipeline компании.',
    description:
      'Execution — in-flight runtime-запуски, вызовы инструментов и orchestrated steps. Execution Queue и Live Runtime показывают что running, blocked on approval или finished recently.',
    whereUsed: 'Execution Queue, Live Runtime, история запусков и runtime widgets Command Center.',
    related: [
      { label: 'Очередь выполнения', path: '/ops/execution' },
      { label: 'Live-монитор Runtime', path: '/ops/runtime/live' },
      { label: 'История запусков', path: '/ops/runs' },
    ],
  },
  report: {
    label: 'Отчёт',
    summary: 'Структурированный результат завершённого запуска — выводы, шаги и вложения.',
    tooltip: 'Структурированный результат завершённого запуска — выводы, шаги и вложения.',
    description:
      'Отчёты документируют runtime-запуск в читаемой форме. Питают Task Results, обновления памяти, сводки операционного дня и проверку Owner перед закрытием работы.',
    whereUsed: 'Каталог отчётов, детали Task Result, workspace сотрудника и недавние отчёты Command Center.',
    related: [
      { label: 'Отчёты', path: '/ops/reports' },
      { label: 'Итоги задач', path: '/ops/task-results' },
      { label: 'Командный центр', path: '/ops' },
    ],
  },
  timeline: {
    label: 'Хронология',
    summary: 'Лента событий компании — запуски, согласования, handoffs и значимые события.',
    tooltip: 'Лента событий компании — запуски, согласования, handoffs и значимые события.',
    description:
      'Хронология агрегирует события в audit-friendly поток. Дополняет Command Center, когда Owner нужна история, а не текущее состояние.',
    whereUsed: 'Хронология компании, редиректы Mission Feed и перекрёстные ссылки Command Center.',
    related: [
      { label: 'Хронология компании', path: '/ops/timeline' },
      { label: 'Активность', path: '/ops/activity' },
      { label: 'Командный центр', path: '/ops' },
    ],
  },
  workScheduler: {
    label: 'Планировщик работ',
    summary: 'Рекомендуемые следующие действия после Task Result — одобрить, перезапустить, hand off или dismiss.',
    tooltip: 'Рекомендуемые следующие действия после Task Result — одобрить, перезапустить, hand off или dismiss.',
    description:
      'Work Scheduler превращает completed output в plan: приоритизированные suggestions по Task Result, часто с согласованием Owner перед next Runtime task или external handoff.',
    whereUsed: 'Детали Task Result, workspace сотрудника, панели Control Room и post-run review.',
    related: [
      { label: 'Итоги задач', path: '/ops/task-results' },
      { label: 'Запуск задачи', path: '/ops/run-task' },
      { label: 'Согласования', path: '/ops/approvals' },
    ],
  },
  costMonitor: {
    label: 'Cost Monitor',
    summary: 'Расход токенов и использование провайдера по run, сотруднику и дню.',
    tooltip: 'Расход токенов и использование провайдера по run, сотруднику и дню.',
    description:
      'Cost Monitor показывает Runtime spend против limits: tokens, estimated cost и provider breakdown. Помогает Owner решать cloud runs и switch modes до превышения budget.',
    whereUsed: 'Панели мониторинга Live Runtime, настройки Runtime и runtime dashboards сотрудников.',
    related: [
      { label: 'Live-монитор Runtime', path: '/ops/runtime/live' },
      { label: 'Настройки Runtime', path: '/ops/runtime' },
      { label: 'История запусков', path: '/ops/runs' },
    ],
  },
}
