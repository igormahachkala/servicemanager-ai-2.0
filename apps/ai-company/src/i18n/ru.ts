import type { Messages } from './en'

export const ru: Messages = {
  common: {
    empty: "—",
    all: "Все"
  },
  nav: {
    flow: "Flow",
    missionControl: "Mission Control",
    organization: "Организация",
    companies: "Companies",
    employees: "Сотрудники",
    workspaces: "Рабочие пространства",
    projects: "Проекты",
    tasks: "Задачи",
    feed: "Лента",
    timeline: "Хронология",
    activity: "Активность",
    notifications: "Notifications",
    reports: "Отчёты",
    runs: "История запусков",
    audit: "Аудит",
    runtime: "Runtime",
    approvals: "Согласования",
    knowledge: "База знаний",
    tools: "Инструменты",
    discussions: "Обсуждения",
    chats: "Чаты"
  },
  platformNav: {
    home: "Главная",
    chats: "Чаты",
    employees: "Сотрудники",
    workspaces: "Рабочие пространства",
    projects: "Проекты",
    knowledge: "База знаний",
    tasks: "Задачи",
    tools: "Инструменты",
    reports: "Отчёты",
    timeline: "Хронология",
    approvals: "Согласования",
    settings: "Настройки",
    presence: "Присутствие",
    canvas: "Canvas компании"
  },
  labels: {
    active: "Активные",
    planned: "Планируемые",
    models: "Модели",
    codingAgents: "Агенты разработки",
    integrations: "Интеграции",
    currentTask: "Текущая задача",
    availableTools: "Доступные инструменты",
    lastActivity: "Последняя активность",
    status: "Статус",
    model: "Модель",
    role: "Роль",
    agent: "Агент",
    load: "Нагрузка",
    squad: "Команда",
    id: "ID",
    title: "Название",
    assignee: "Исполнитель",
    sla: "SLA",
    priority: "Приоритет",
    name: "Имя",
    version: "Версия",
    scope: "Область",
    lastCheck: "Последняя проверка",
    usedBy: "Используют",
    domain: "Домен",
    leadAgent: "Ведущий агент",
    headcount: "Численность",
    capacity: "Ёмкость"
  },
  pages: {
    flow: "Flow Workspace",
    dashboard: "Дашборд",
    canvas: "Canvas компании",
    missionControl: "Mission Control",
    missionFeed: "Лента событий",
    companyTimeline: "Хронология компании",
    activity: "Активность",
    notifications: "Уведомления",
    toolsRegistry: "Реестр AI-инструментов",
    employees: "Сотрудники",
    companies: "Companies",
    organization: "Организация",
    tasks: "Задачи",
    execution: "Очередь выполнения",
    toolExecutions: "Вызовы инструментов",
    handoffs: "Work Handoffs",
    discussions: "Обсуждения",
    chats: "Чаты",
    collaboration: "Collaboration",
    controlRoom: "AI Photo Lab Control Room",
    sprint: "Sprint",
    workspaces: "Рабочие пространства",
    projects: "Проекты",
    reports: "Отчёты",
    runs: "История запусков",
    knowledge: "База знаний",
    audit: "Аудит",
    runtimeSettings: "Настройки Runtime",
    runtimeLive: "Live Runtime Monitor",
    approvals: "Согласования",
    presence: "Присутствие",
    workday: "Рабочий день",
    visualLab: "Visual Execution Lab",
    runTask: "Запуск задачи",
    taskResults: "Результаты задач"
  },
  agentStatus: {
    online: "онлайн",
    busy: "занят",
    idle: "простой",
    offline: "офлайн"
  },
  taskStatus: {
    backlog: "бэклог",
    running: "Выполняется",
    blocked: "заблокировано",
    done: "готово"
  },
  feedSeverity: {
    info: "Инфо",
    success: "успех",
    warn: "Предупреждение",
    error: "Ошибка"
  },
  toolStatus: {
    healthy: "исправен",
    degraded: "деградация",
    offline: "офлайн"
  },
  inspector: {
    title: "Inspector сотрудника",
    collapse: "Свернуть inspector",
    activityTimeline: "Хронология активности",
    lastRun: "Последний запуск",
    noEventsYet: "Событий пока нет",
    ago: "назад",
    noRecentActivity: "Нет недавней активности"
  },
  employees: {
    description: "Реестр агентов V1 — активные агенты работают сейчас; запланированные видны для org design.",
    agents: "агенты",
    template: "Шаблон",
    createFromTemplate: "Создать из шаблона",
    duplicate: "Дублировать",
    copyOf: "Копия",
    employeeTemplates: "Шаблоны сотрудников",
    selectTemplate: "Выберите шаблон",
    actions: "Действия",
    openProfile: "Открыть профиль",
    templates: {
      "ai-cto": "AI CTO",
      "ai-architect": "AI Architect",
      "senior-developer": "Senior Developer",
      "ai-qa": "AI QA",
      "ai-devops": "AI DevOps",
      "ai-business-analyst": "AI Business Analyst",
      "ai-product-manager": "AI Product Manager",
      "ai-assistant": "AI Assistant",
      "ai-cfo": "AI CFO",
      "ai-coo": "AI COO"
    }
  },
  organization: {
    description: "Отделы, команды, reporting lines и иерархия компании — отдельно от Workspace assignments.",
    customEmployees: "Кастомные сотрудники",
    squads: "Команды",
    squadRoster: "Снимок roster команды",
    squadsUnit: "команды",
    agentsUnit: "агенты",
    domains: {
      Engineering: "Инженерия",
      Leadership: "Лидерство",
      Operations: "Операции"
    }
  },
  companyEngine: {
    listDescription: "Company is the top-level tenant — security, ownership, and isolation boundary. Projects, departments, workspaces, reports, and audit events belong to a Company. Employees remain platform identities linked via Company Assignment.",
    newCompany: "New Company",
    createCompany: "Create Company",
    openCompany: "Open Company",
    backToList: "Back to Companies",
    newDescription: "Register a new company tenant — the root of your multi-organization platform.",
    newFormTitle: "Company profile",
    namePlaceholder: "e.g. Acme Retail Group",
    slugPlaceholder: "auto-generated from name if empty",
    descriptionPlaceholder: "Mission, scope, and context for this company…",
    countryPlaceholder: "e.g. RU",
    noDescription: "Описание не указано.",
    owner: "Владелец",
    notFoundTitle: "Company not found",
    notFoundDescription: "This company does not exist in local storage.",
    emptyListTitle: "No companies yet",
    emptyListDescription: "Create the first company to begin multi-tenant organization.",
    navLabel: "Company sections",
    fields: {
      slug: "Slug",
      description: "Описание",
      industry: "Industry",
      country: "Country",
      timezone: "Timezone",
      company: "Company"
    },
    status: {
      draft: "Черновик",
      active: "Активные",
      suspended: "Suspended",
      archived: "В архиве"
    },
    industry: {
      technology: "Technology",
      retail: "Retail",
      finance: "Финансы",
      healthcare: "Healthcare",
      manufacturing: "Manufacturing",
      other: "Other"
    },
    projectStatus: {
      planning: "Планирование",
      active: "Активные",
      on_hold: "On hold",
      completed: "Завершено",
      archived: "В архиве"
    },
    assignmentStatus: {
      active: "Активные",
      paused: "На паузе",
      ended: "Завершено"
    },
    tabs: {
      overview: "Обзор",
      projects: "Projects",
      departments: "Departments",
      employees: "Сотрудники",
      statistics: "Statistics",
      settings: "Настройки",
      future: "Будущее"
    },
    overview: {
      boundaryTitle: "Isolation boundary",
      boundaryDesc: "Everything below the platform layer is scoped to this Company. Digital employees keep platform identity and connect through assignments.",
      pointProjects: "Projects belong to Company",
      pointDepartments: "Departments belong to Company",
      pointWorkspaces: "Workspaces belong to Company",
      pointReports: "Reports belong to Company",
      pointEmployees: "Employees link via Company Assignment — identity stays platform-wide",
      branding: "Branding tagline"
    },
    stats: {
      projects: "Projects",
      projectsShort: "projects",
      departments: "Departments",
      workspaces: "Рабочие пространства",
      employees: "Сотрудники",
      employeesShort: "employees",
      reports: "Отчёты",
      auditEvents: "Audit events",
      count: "Count",
      activeSub: "Активные"
    },
    projects: {
      empty: "No projects for this company yet.",
      footnote: "Projects group workspaces and delivery scope under the Company tenant.",
      viewWorkspaces: "View workspaces"
    },
    departments: {
      empty: "No departments scoped to this company.",
      open: "Открыть",
      viewOrg: "View organization chart"
    },
    employees: {
      empty: "No company assignments yet.",
      hint: "Platform employees work for this company through Assignment — identity is not transferred.",
      openProfile: "Profile"
    },
    settings: {
      save: "Save settings",
      saved: "Saved"
    },
    future: {
      branding: {
        title: "Branding",
        desc: "Logo, colors, and white-label portal for this company tenant."
      },
      subscription: {
        title: "Subscription",
        desc: "Plan, billing, seat limits, and usage quotas per company."
      },
      marketplace: {
        title: "Marketplace",
        desc: "Install tools, templates, and employee packs scoped to this company."
      },
      aiWorkforce: {
        title: "AI Workforce",
        desc: "Company-scoped roster policies, hiring workflows, and capacity planning."
      }
    },
    errors: {
      nameRequired: "Company name is required."
    }
  },
  organizationEngine: {
    description: "Цифровая org structure — отделы, команды, менеджеры и reporting lines. Organization определяет структуру компании; Workspace assignments отдельны.",
    reportingTree: "Дерево organization",
    reportingTreeHint: "Owner → CEO → executives → engineering → QA → operations",
    treeFootnote: "Reporting lines хранятся локально в ai-company-organization. Owner id: {ownerId}.",
    ownerHint: "Human principal — не цифровой сотрудник",
    owner: "Владелец",
    departments: "Отделы",
    teams: "Команды",
    department: "Отдел",
    team: "Команда",
    departmentHead: "Руководитель отдела",
    teamLead: "Лид команды",
    teamsUnit: "команд",
    membersUnit: "участников",
    departmentPage: "Отдел",
    teamPage: "Команда",
    departmentOverview: "Обзор отдела",
    teamOverview: "Обзор команды",
    teamsInDepartment: "Команды в отделе",
    teamMembers: "Участники команды",
    noMembers: "Участники пока не назначены.",
    departmentNotFound: "Отдел не найден",
    departmentNotFoundDesc: "Этот отдел отсутствует в local organization storage.",
    teamNotFound: "Команда не найдена",
    teamNotFoundDesc: "Эта команда отсутствует в local organization storage.",
    backToOrganization: "Назад к организации",
    orgPlacement: "Размещение в organization",
    reportingLines: "Линии подчинения",
    manager: "Менеджер",
    directReports: "Прямые подчинённые",
    directReport: "Прямой подчинённый",
    unassigned: "Не назначено",
    noManager: "Нет менеджера — вершина reporting chain или unlinked.",
    noDirectReports: "Нет прямых подчинённых.",
    noOrgDataHint: "Этот сотрудник пока не связан с отделами, командами или reporting lines.",
    openOrganization: "Открыть Organization",
    orgVsWorkspaceHint: "Organization определяет структуру компании. Workspace assignments связывают employees с projects — managed separately.",
    futureBadge: "Будущее",
    futureStructures: "Будущие organization models",
    future: {
      crossFunctional: "Кросс-функциональные команды",
      crossFunctionalDesc: "Команды через несколько отделов — например, launch task forces.",
      matrix: "Матричная организация",
      matrixDesc: "Dual reporting — functional manager плюс project lead.",
      temporarySquads: "Временные squads",
      temporarySquadsDesc: "Time-boxed teams для incidents, releases или audits.",
      workspaceOverlay: "Наложение рабочего пространства",
      workspaceOverlayDesc: "Visualize how Workspace assignments map onto org chart."
    },
    stats: {
      departments: "Отделы",
      teams: "Команды",
      headcount: "Численность",
      activeEmployees: "Активные сотрудники",
      customEmployees: "Кастомные сотрудники",
      plannedEmployees: "Запланированные сотрудники"
    }
  },
  approvalEngine: {
    pageDescription: "Human-in-the-loop approval queue — Runtime никогда не выполняет critical actions напрямую. Каждое решение становится audit event.",
    queueTitle: "Очередь approval",
    requestCount: "запросов",
    searchLabel: "Поиск",
    searchPlaceholder: "Название, сотрудник, тип действия, статус…",
    policiesTitle: "Политики согласования",
    futureIntegrationTitle: "Будущие интеграции Runtime",
    futureIntegrationHint: "Runtime создаёт Approval Request → Owner проверяет → решение emit Audit Event.",
    futureBadge: "Будущее",
    futureIntegrations: [
      "GitHub Push",
      "Продакшен-развёртывание",
      "Миграция БД",
      "Удаление из файловой системы",
      "Денежный перевод",
      "Изменения прав",
      "Подключение инструмента",
      "Назначение на рабочее пространство"
    ],
    principleNote: "Human is Always in Control — критические действия цифровых сотрудников проходят через единый approval API.",
    runtimeNote: "Runtime integration: invoke createApprovalRequest() instead of executing protected actions. Owner decision writes to audit trail.",
    localOnly: "Хранится в localStorage (ai-company-approvals) — Runtime не подключён.",
    openAudit: "Открыть Audit",
    backToList: "Назад к согласованиям",
    notFoundTitle: "Approval не найден",
    notFoundDescription: "Этот approval request отсутствует в local storage.",
    detailsOverview: "Обзор запроса",
    ownerActionsTitle: "Проверка Owner",
    timelineTitle: "Хронология согласования",
    emptyTimelineTitle: "Действий пока нет",
    emptyTimelineDescription: "Approve, reject, delegate или comment для построения timeline.",
    emptyListTitle: "Нет approval requests",
    emptyListDescription: "Когда Runtime запрашивает human approval, запросы появляются здесь для проверки Owner.",
    owner: "Владелец",
    ownerReviewLead: "Review this request — ваше решение записывается в audit trail.",
    commentLabel: "Комментарий",
    commentPlaceholder: "Обоснование, условия или вопросы для сотрудника…",
    delegateLabel: "Делегировать",
    delegatePlaceholder: "ID сотрудника — будущая маршрутизация менеджеру",
    delegatedTo: "Делегировано",
    cancelRequest: "Отменить запрос",
    closedMessage: "Этот request {status} — no further Owner actions.",
    policyRule: "Правило policy",
    createdAt: "Создано",
    updatedAt: "Обновлено",
    filters: {
      status: "Статус",
      actionType: "Тип действия",
      priority: "Приоритет",
      workspace: "Рабочее пространство",
      noWorkspace: "Нет рабочего пространства"
    },
    stats: {
      total: "Всего",
      pending: "Ожидание",
      approved: "Одобрено",
      rejected: "Отклонено",
      critical: "Критический",
      expired: "Истекло"
    },
    statuses: {
      pending: "Ожидание",
      approved: "Одобрено",
      rejected: "Отклонено",
      cancelled: "Отменено",
      expired: "Истекло"
    },
    priorities: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      critical: "Критический"
    },
    actionTypes: {
      github_push: "GitHub Push",
      production_deploy: "Продакшен-развёртывание",
      database_migration: "Миграция БД",
      filesystem_delete: "Удаление из файловой системы",
      money_transfer: "Денежный перевод",
      permission_change: "Изменение разрешения",
      tool_connection: "Подключение инструмента",
      workspace_assignment: "Назначение на рабочее пространство",
      generic: "Общее критическое действие"
    },
    actionKinds: {
      approve: "Одобрить",
      reject: "Отклонить",
      delegate: "Делегировать",
      comment: "Комментарий"
    },
    rules: {
      always_required: "Всегда обязательно",
      owner_only: "Только владелец",
      manager: "Менеджер",
      workspace_admin: "Администратор рабочего пространства",
      auto_approve: "Автоодобрение",
      disabled: "Отключено"
    }
  },
  knowledgeEngine: {
    pageDescription: "Platform-owned knowledge — documents, ADRs, standards и runbooks. Employees learn via Assignment; Runtime queries before tasks.",
    catalogTitle: "Каталог базы знаний",
    collectionsTitle: "Коллекции базы знаний",
    collectionsDescription: "Кураторские reading paths — назначайте collections сотрудникам для структурированного обучения.",
    contentTitle: "Содержание",
    sourcesTitle: "Источники",
    featuredCollections: "Избранные collections",
    itemsUnit: "элементов",
    platformWide: "Platform-wide",
    searchLabel: "Поиск",
    searchPlaceholder: "Название, сводка, теги, содержание…",
    openCatalog: "Открыть каталог",
    openCollections: "Коллекции",
    viewAllCollections: "Показать все коллекции",
    backToList: "Назад к базе знаний",
    notFoundTitle: "Knowledge item не найден",
    notFoundDescription: "Этот knowledge item отсутствует в local storage.",
    emptyListTitle: "Нет knowledge items",
    emptyListDescription: "Измените фильтры или добавьте platform knowledge.",
    emptyCollections: "Collections пока нет.",
    emptyAssignments: "Нет knowledge assignments для этого employee.",
    emptyWorkspace: "Нет published knowledge для этого workspace.",
    assignedKnowledgeTitle: "Assigned Knowledge",
    assignedKnowledgeDescription: "Learning assignments — отдельные items или collections. Employee изучает knowledge; Runtime запрашивает только при выполнении задачи.",
    assignmentNote: "Назначайте collections для onboarding — отдельно от Employee Memory.",
    workspaceTabDescription: "Workspace-scoped и platform-wide published knowledge для назначенных employees.",
    openItem: "Открыть элемент",
    openCollection: "Открыть коллекцию",
    principleNote: "Knowledge принадлежит платформе и Workspace — never to the LLM provider or Employee model.",
    runtimeNote: "Runtime integration: call queryKnowledgeForRuntime() before task execution — do not store knowledge in model context permanently.",
    localOnly: "Stored in localStorage (ai-company-knowledge, ai-company-knowledge-collections) — no vector DB.",
    futureBadge: "Будущее",
    futureTitle: "Будущие возможности knowledge",
    filters: {
      status: "Статус",
      type: "Тип",
      source: "Источник",
      workspace: "Рабочее пространство",
      tag: "Тег"
    },
    stats: {
      total: "Всего items",
      published: "Опубликовано",
      collections: "Коллекции",
      assignments: "Назначения",
      platformWide: "Platform-wide",
      workspaceScoped: "Workspace-scoped"
    },
    statuses: {
      draft: "Черновик",
      published: "Опубликовано",
      archived: "В архиве"
    },
    assignmentStatuses: {
      assigned: "Назначено",
      in_progress: "В процессе",
      completed: "Завершено"
    },
    types: {
      documentation: "Документация",
      adr: "ADR",
      wiki: "Вики",
      standard: "Стандарт",
      instruction: "Инструкция",
      architecture: "Архитектура",
      decision: "Решение",
      best_practice: "Лучшая практика",
      api: "API",
      prompt_pack: "Набор промптов",
      runbook: "Runbook",
      manual: "Вручную"
    },
    sources: {
      markdown: "Markdown",
      pdf: "PDF",
      url: "URL",
      local_file: "Локальный файл",
      generated: "Сгенерировано",
      imported: "Импортировано"
    },
    future: {
      semanticSearch: "Семантический поиск",
      semanticSearchDesc: "Natural-language retrieval across knowledge items.",
      vectorSearch: "Векторный поиск",
      vectorSearchDesc: "Similarity ranking for task-context injection.",
      embeddings: "Эмбеддинги",
      embeddingsDesc: "Chunk embeddings stored platform-side — not in LLM.",
      knowledgeGraph: "Граф знаний",
      knowledgeGraphDesc: "Entity links between ADRs, standards, and architecture docs.",
      aiSummaries: "ИИ-сводки",
      aiSummariesDesc: "Owner-approved executive summaries of long documents.",
      recommendedReading: "Рекомендуемое к прочтению",
      recommendedReadingDesc: "Suggested items based on role, assignments, and task history."
    }
  },
  dashboard: {
    description: "Операционный обзор — health компании, active missions, алерты.",
    activeAgents: "Активные agents",
    activeAgentsSub: "из 7 зарегистрированных",
    runningTasks: "Running tasks",
    runningTasksSub: "в работе",
    queueDepth: "Queue depth",
    queueDepthSub: "бэклог + заблокировано",
    toolsHealthy: "Tools healthy",
    toolsHealthySub: "проверки реестра OK",
    activeMissions: "Активные missions",
    alerts: "Алерты",
    noActiveAlerts: "Нет активных алертов",
    slaBreach: "нарушение"
  },
  executiveDashboard: {
    title: "Панель руководства",
    description: "Обзор компании — health, runtime, approvals, workspace, чаты и алерты.",
    companyHealth: "Состояние компании",
    employees: "Сотрудники",
    employeesSub: "зарегистрированных цифровых сотрудников",
    currentRuntime: "Текущий Runtime",
    runtimeSub: "{active} активных профилей · {waiting} ожидают согласования",
    approvals: "Согласования",
    approvalsSub: "ожидающих решений",
    reports: "Отчёты",
    reportsSub: "сгенерированных artifacts",
    timeline: "Хронология",
    workspaceOverview: "Обзор рабочего пространства",
    workspacesSub: "workspaces в реестре",
    recentChats: "Недавние чаты",
    criticalAlerts: "Критические алерты",
    quickActions: "Быстрые действия",
    viewAll: "Показать все",
    noData: "Данных пока нет",
    eventFallback: "Событие компании",
    actionNewChat: "Новый чат",
    actionNewEmployee: "Новый сотрудник",
    actionTasks: "Задачи",
    actionOpenCanvas: "Открыть canvas компании",
    actionOpenControlRoom: "AI Photo Lab Control Room",
    actionOpenSprint: "Sprint 1 — Working MVP",
    actionFlow: "Flow workspace",
    projectsOverview: "Активные проекты",
    projectsSub: "delivery entities в реестре",
    actionNewProject: "Новый проект",
    presenceOverview: "Присутствие команды",
    presenceSub: "{working} работают · {waiting} ждут",
    actionOpenPresence: "Открыть presence",
    workdayOverview: "Утренний рабочий день",
    workdaySub: "{started} начали · {blocked} заблокированы · {finished} завершили",
    actionOpenWorkday: "Открыть дашборд рабочего дня"
  },
  commandCenter: {
    title: "Executive Command Center",
    description: "Operational view — company health, workforce, sprint, decisions, risks, and live activity.",
    healthScoreLabel: "company health index",
    sprintTasks: "tasks done",
    sprintPoints: "story points",
    approvalsPending: "Ожидание",
    approvalsApproved: "approved",
    runtimeTotal: "запуски",
    runtimeWaiting: "awaiting approval",
    toolCompleted: "completed",
    toolFailed: "Ошибка",
    toolPending: "await approval",
    canvasEmployees: "employees",
    canvasTasks: "active tasks",
    canvasApprovals: "approvals",
    canvasRuns: "runtime runs",
    controlRoomWorking: "in progress",
    controlRoomBlocked: "заблокировано",
    controlRoomApprovals: "decisions",
    greeting: {
      morning: "Good morning, Owner.",
      afternoon: "Good afternoon, Owner.",
      evening: "Good evening, Owner."
    },
    brief: {
      summary: "Here is your company pulse for today — what is moving, what needs you, and where risk sits.",
      workingHighlight: "{count} employees actively working right now",
      approvalsHighlight: "{count} approvals waiting for your decision",
      sprintHighlight: "Sprint health is {health}",
      projectHighlight: "AI Photo Lab is at {progress}% toward MVP",
      calmDay: "Operations are stable — no urgent blockers detected",
      riskAlerts: "{count} critical alerts need attention",
      riskWaiting: "{count} employees blocked on approval",
      healthScore: "Health index",
      unread: "{count} unread notifications",
      allClear: "Inbox clear",
      openTimeline: "Open live timeline"
    },
    sprintHealth: {
      on_track: "on track",
      at_risk: "at risk",
      blocked: "заблокировано"
    },
    sections: {
      companyHealth: "Состояние компании",
      employeesWorking: "Employees Working",
      todaysSprint: "Today's Sprint",
      approvals: "Согласования",
      criticalAlerts: "Критические алерты",
      runtime: "Runtime",
      toolUsage: "Tool Usage",
      recentReports: "Recent Reports",
      liveTimeline: "Live Timeline",
      canvasPreview: "Canvas Preview",
      controlRoomPreview: "Control Room Preview",
      notifications: "Notifications",
      quickLaunch: "Quick Launch",
      charts: "Execution Charts"
    },
    charts: {
      productivity: "Productivity",
      capacity: "Ёмкость",
      execution: "Execution",
      approvals: "Согласования"
    },
    quickLaunch: {
      atlas: "Atlas",
      max: "MAX",
      canvas: "Canvas",
      sprint: "Sprint",
      controlRoom: "Control Room",
      kickoff: "Kickoff",
      handoffs: "Handoffs",
      runtime: "Runtime",
      runTask: "Запуск задачи",
      taskResults: "Результаты задач"
    },
    empty: {
      sprint: "No active sprint configured",
      approvals: "No pending approvals",
      runtime: "No runtime runs yet",
      tools: "No tool executions yet",
      reports: "No reports generated yet",
      canvas: "Canvas graph unavailable",
      canvasTasks: "No active canvas tasks",
      controlRoom: "Control room snapshot unavailable"
    }
  },
  visualLab: {
    title: "Visual Execution Lab",
    description: "Cursor-style visual workspace — mock editor, terminal, browser preview, clicks, and test timeline for digital employee execution.",
    mockNote: "Visual/mock only — no real Playwright or browser automation yet.",
    sidebar: {
      employee: "Сотрудник",
      task: "Задача",
      execution: "Execution",
      status: "Статус",
      tests: "Test steps",
      project: "Project",
      integrations: "Интеграции",
      doingNow: "Сейчас делает"
    },
    integrations: {
      execution: "Execution Queue",
      runtime: "Runtime Run",
      handoffs: "Handoff",
      reports: "Отчёт",
      canvas: "Company Canvas",
      controlRoom: "Control Room"
    },
    editor: {
      title: "Editor",
      changed: "File changed"
    },
    terminal: {
      title: "Terminal",
      waiting: "Waiting for execution output…"
    },
    browser: {
      title: "Browser Preview",
      landingCopy: "Sign in to continue to AI Photo Lab inspection workspace.",
      buttonPending: "Rendering Sign in button…",
      screenshots: "Screenshots timeline"
    },
    timeline: {
      title: "Action Timeline",
      play: "Play",
      pause: "Pause",
      replay: "Replay",
      restart: "Restart",
      back: "Back",
      forward: "Forward"
    },
    actions: {
      test_started: "Test started",
      file_changed: "File changed",
      terminal_line: "Terminal",
      cursor_move: "Cursor moved",
      click: "Clicked login",
      highlight: "Highlighted UI element",
      button_added: "Button added",
      screenshot: "Screenshot captured",
      build_passed: "Build passed"
    }
  },
  tasks: {
    description: "Рабочая очередь компании — операционные задачи с исполнителем, приоритетом и SLA.",
    queue: "Очередь задач",
    slaLeft: "осталось {minutes} мин",
    slaBreach: "нарушение"
  },
  feed: {
    description: "NOC event stream — действия агентов, task transitions, tool health, system alerts.",
    liveFeed: "Лента в реальном времени",
    events: "события"
  },
  employeeBuilder: {
    title: "Создать сотрудника",
    description: "Конструктор цифрового специалиста — model, skills, tools, permissions, restrictions, prompt, workflow и memory.",
    createButton: "Создать сотрудника",
    cancel: "Отмена",
    submit: "Сохранить сотрудника",
    sections: {
      identity: "Identity",
      templates: "Шаблон",
      models: "Модели",
      skills: "Навыки",
      tools: "Инструменты",
      permissions: "Разрешения",
      restrictions: "Ограничения",
      systemPrompt: "System Prompt",
      workflow: "Workflow",
      memoryScope: "Memory Scope",
      mission: "Миссия"
    },
    fields: {
      name: "Имя",
      codename: "Кодовое имя",
      role: "Роль",
      status: "Статус",
      primaryModel: "Основная модель",
      fallbackModels: "Резервные модели",
      description: "Описание / Mission",
      skills: "Навыки",
      systemPrompt: "System prompt",
      workflow: "Workflow",
      memoryScope: "Memory scope"
    },
    placeholders: {
      name: "напр. Research Analyst",
      codename: "напр. SCOUT",
      role: "напр. AI Research Lead",
      selectModel: "Выберите primary model",
      description: "Mission statement, scope и operating constraints",
      systemPrompt: "Вы — цифровой специалист. Определите тон, границы и правила решений…",
      workflow: "Пошаговый flow: intake → analysis → output → review"
    },
    hints: {
      skills: "Ключевые компетенции, которые агент может применять автономно.",
      restrictions: "Жёсткие guardrails — применяются независимо от permissions.",
      memoryScope: "Knowledge domains, которые агент может читать и записывать."
    },
    status: {
      active: "Активные",
      planned: "Планируемые",
      disabled: "Отключено"
    },
    permissions: {
      read: "Чтение",
      write: "Запись",
      enabled: "Включено",
      readShort: "R",
      writeShort: "W",
      readWriteShort: "R/W"
    },
    options: {
      skills: {
        "Business Analysis": "Бизнес-анализ",
        Architecture: "Архитектура",
        Coding: "Разработка",
        Testing: "Тестирование",
        Research: "Исследование",
        Documentation: "Документация",
        Marketing: "Маркетинг",
        Finance: "Финансы",
        DevOps: "DevOps",
        "Product Management": "Управление продуктом"
      },
      restrictions: {
        "No Production Deploy": "No Production Deploy",
        "No Backend Changes": "No Backend Changes",
        "No Database Write": "No Database Write",
        "No Git Push": "No Git Push",
        "No Delete Operations": "No Delete Operations",
        "Requires Approval": "Требует согласования"
      },
      memoryScope: {
        "AI Company": "AI Company",
        "ServiceManager.AI": "ServiceManager.AI",
        "MAX Assistant": "MAX Assistant",
        "Photo Inspection AI": "Photo Inspection AI",
        Finance: "Финансы",
        Operations: "Операции"
      },
      permissions: {
        github: "GitHub",
        docker: "Docker",
        postgresql: "PostgreSQL",
        figma: "Figma",
        n8n: "n8n",
        filesystem: "Файловая система",
        servicemanagerApi: "ServiceManager API",
        productionDeploy: "Продакшен-развёртывание"
      }
    },
    permissionsHint: "Production Deploy, Database write и GitHub write отключены по умолчанию для безопасности.",
    errors: {
      required: "Имя, codename и role обязательны.",
      primaryModel: "Выберите primary model."
    }
  },
  tools: {
    pageDescription: "Models, coding agents и integrations — V1 local inventory.",
    modelsDescription: "LLM runtimes, доступные агентам",
    codingAgentsDescription: "Автономные coding и IDE agents",
    integrationsDescription: "MCP и infrastructure connectors",
    items: "элементов",
    registered: "Зарегистрировано",
    healthy: "Исправен",
    categories: "Категории",
    degraded: "Деградация"
  },
  toolRegistry: {
    pageDescription: "Universal catalog external capabilities — Employees access everything through Tool Registry, never directly.",
    detailsTitle: "Детали инструмента",
    architectureNote: "Только архитектура V1 — без реальных подключений. Employees invoke tools через Registry; MCP/GitHub/Docker adapters — future.",
    employeeBoundaryNote: "Employee никогда не подключается к MCP, GitHub или Docker напрямую. Runtime разрешает tool через Tool Registry и применяет capabilities + policies.",
    backToCatalog: "Назад к реестру инструментов",
    openTool: "Открыть инструмент",
    requiresApproval: "Согласование",
    capabilityCount: "возможности",
    toolsCount: "инструменты",
    connectedCount: "подключён",
    notFoundTitle: "Tool не найден",
    notFoundDescription: "Этот tool не зарегистрирован в catalog.",
    providersTitle: "Провайдеры",
    catalogTitle: "Каталог инструментов",
    stats: {
      registered: "Зарегистрировано",
      connected: "Подключено",
      categories: "Категории",
      providers: "Провайдеры"
    },
    filters: {
      category: "Категория",
      provider: "Провайдер",
      connection: "Подключение"
    },
    details: {
      identity: "Identity инструмента",
      architecture: "Архитектура",
      capabilities: "Возможности",
      accessPolicies: "Политики доступа",
      category: "Категория",
      provider: "Провайдер",
      requiresApproval: "Требует согласования",
      workspaceScope: "Область рабочего пространства",
      audit: "Аудит-трейл"
    },
    matrix: {
      yes: "Да",
      no: "Нет",
      active: "Активные",
      inactive: "—"
    },
    categories: {
      development: "Разработка",
      infrastructure: "Инфраструктура",
      communication: "Коммуникация",
      business: "Бизнес",
      knowledge: "База знаний",
      storage: "Хранилище",
      ai: "ИИ",
      automation: "Автоматизация"
    },
    providers: {
      mcp: "MCP",
      "rest-api": "REST API",
      cli: "CLI",
      native: "Нативный",
      local: "Локальный"
    },
    providerDescriptions: {
      mcp: "Model Context Protocol servers — standardized tool transport для LLM agents.",
      "rest-api": "HTTP REST integrations с OAuth или API keys.",
      cli: "Command-line binaries в sandboxed subprocess.",
      native: "In-process platform adapters (browser, desktop).",
      local: "Local filesystem и host resources без network."
    },
    capabilities: {
      read: "Чтение",
      write: "Запись",
      execute: "Выполнить",
      search: "Поиск",
      create: "Создать",
      delete: "Удалить",
      deploy: "Развернуть",
      review: "Проверка",
      analyze: "Анализировать",
      generate: "Сгенерировать",
      notify: "Уведомить"
    },
    policies: {
      "always-allowed": "Всегда разрешено",
      "require-approval": "Требуется согласование",
      "workspace-only": "Только рабочее пространство",
      "owner-only": "Только владелец",
      disabled: "Отключено"
    },
    policyHints: {
      "always-allowed": "Low-risk read operations без Owner gate.",
      "require-approval": "Owner must approve before invoke.",
      "workspace-only": "Разрешено только в контексте назначенного Workspace.",
      "owner-only": "Только human Owner может authorize invoke.",
      disabled: "Tool blocked — no invoke permitted."
    },
    connectionStatus: {
      connected: "Подключено",
      disconnected: "Отключено",
      degraded: "Деградация",
      pending: "Ожидание"
    },
    descriptions: {
      github: "Source control, PRs, issues и CI — via MCP adapter.",
      docker: "Container build, run и deploy — CLI adapter.",
      filesystem: "Local file read/write в sandbox paths.",
      browser: "Web automation и visual verification — native adapter.",
      postgresql: "Relational database queries и migrations.",
      figma: "Design context, components и assets — MCP adapter.",
      telegram: "Bot messaging и уведомления — REST adapter.",
      slack: "Team channels и alerts — REST adapter.",
      email: "SMTP/IMAP messaging — REST adapter.",
      googleDrive: "Cloud document storage — REST adapter.",
      calendar: "Scheduling и event management — REST adapter.",
      n8n: "Workflow automation и orchestration — REST adapter.",
      ollama: "Local LLM inference — REST adapter.",
      openrouter: "Multi-model cloud routing — REST adapter.",
      ssh: "Remote shell access — CLI adapter (high risk).",
      rest: "Generic HTTP REST connector для custom endpoints."
    }
  },
  status: {
    online: "Онлайн",
    working: "Работает",
    building: "Формирование",
    reviewing: "На проверке",
    idle: "Простой"
  },
  flow: {
    brand: "IT Company",
    workflow: "WORKFLOW",
    breadcrumb: "org.workflow · main",
    subtitle: "Инженерная автоматизация · v1.4",
    executionActive: "Выполнение активно",
    nodes: "узлов",
    activeCount: "активен",
    toggleNodeRail: "Переключить node rail",
    toggleInspector: "Переключить inspector",
    history: "История",
    executeWorkflow: "Execute Workflow",
    executionLog: "Журнал выполнения",
    live: "активно",
    logSuccess: "успех",
    logRunning: "Выполняется",
    logFailed: "Ошибка",
    addNode: "Добавить узел",
    logStatus: {
      Success: "Успех",
      Running: "Выполняется",
      Failed: "Ошибка"
    }
  },
  shell: {
    mockTelemetry: "mock-телеметрия",
    platformShell: "Platform Shell",
    platformReady: "платформа готова",
    breadcrumbs: "Навигация",
    statusBar: "Статус платформы",
    toggleNav: "Переключить навигацию"
  },
  language: {
    toggle: "Язык"
  },
  aria: {
    topNav: "AI Company",
    missionControlNav: "Mission Control",
    platformNav: "Навигация платформы"
  },
  brand: {
    title: "AI Company",
    subtitle: "локальный V1",
    env: "mock · localhost"
  },
  discussions: {
    listDescription: "Group conversations между Owner и цифровыми сотрудниками — отдельно от Tasks.",
    newDescription: "Start multi-participant discussion с выбранными AI employees.",
    allDiscussions: "Все обсуждения",
    discussionCount: "обсуждений",
    newDiscussion: "Новое обсуждение",
    createDiscussion: "Создать обсуждение",
    openDiscussion: "Открыть обсуждение",
    backToList: "Назад к обсуждениям",
    participants: "Участники",
    participantsCount: "участников",
    messages: "Сообщения",
    updated: "Обновлено",
    ownerName: "Владелец",
    localOnly: "Хранится локально — runtime не подключён",
    futureBadge: "Будущее",
    emptyListTitle: "Обсуждений пока нет",
    emptyListDescription: "Создайте групповое обсуждение с Atlas, MAX, QA, Architect или любым custom employee.",
    notFoundTitle: "Обсуждение не найдено",
    notFoundDescription: "Это обсуждение отсутствует в local storage или было удалено.",
    noMessagesTitle: "Сообщений пока нет",
    noMessagesDescription: "Отправьте первое сообщение, чтобы начать conversation.",
    newFormTitle: "Настройка обсуждения",
    titlePlaceholder: "напр. V1 rollout architecture review",
    selectParticipants: "Выберите участников",
    selectParticipantsHint: "Выберите одного или нескольких цифровых сотрудников. Owner включается автоматически.",
    sourceBuiltin: "Встроенные",
    sourceCustom: "Пользовательский",
    composerPlaceholder: "Напишите сообщение как Owner…",
    composerHint: "Ответы employee — mock-only в V1.",
    sendMessage: "Отправить",
    systemStarted: "Обсуждение начато с {names}.",
    status: {
      open: "Открыть",
      closed: "Закрыто"
    },
    roles: {
      owner: "Владелец",
      member: "Участник",
      observer: "Наблюдатель"
    },
    messageTypes: {
      system: "Система"
    },
    sidebar: {
      participants: "Участники",
      pinnedNotes: "Закреплённые заметки",
      pinnedNotesDesc: "Важные заметки, закреплённые в этом обсуждении.",
      decision: "Решение",
      decisionDesc: "Записанные решения и outcomes из этого thread.",
      relatedTasks: "Связанные задачи",
      relatedTasksDesc: "Tasks, связанные с этим discussion — discussions are not tasks.",
      artifacts: "Артефакты",
      artifactsDesc: "Files, diagrams и outputs, созданные в этом thread."
    },
    errors: {
      titleRequired: "Название обсуждения обязательно.",
      participantsRequired: "Выберите хотя бы одного сотрудника."
    },
    mockReplies: [
      "{name}: Согласен с направлением и могу поддержать следующий шаг.",
      "{name}: С архитектурной точки зрения, нужно сначала уточнить scope и dependencies.",
      "{name}: Могу review implementation details, когда decision станет clearer.",
      "{name}: QA потребует явные acceptance criteria перед продолжением.",
      "{name}: Предлагаю зафиксировать assumptions и risks в этом thread."
    ]
  },
  sideNav: {
    title: "Mission Control",
    subtitle: "AI Company · NOC",
    flowWorkspace: "Flow Workspace",
    env: "локально / mock"
  },
  conversations: {
    title: "Беседа",
    subtitle: "Personal dialogue с этим цифровым сотрудником — independent from Tasks and Runs.",
    personalDialog: "Личное",
    backToEmployees: "Назад к сотрудникам",
    openConversation: "Беседа",
    ownerName: "Владелец",
    updated: "Обновлено",
    localOnly: "Хранится локально — runtime не подключён",
    futureBadge: "Будущее",
    sourceBuiltin: "Встроенный roster",
    notFoundTitle: "Employee не найден",
    notFoundDescription: "Этот сотрудник не существует или был удалён из roster.",
    noMessagesTitle: "Начать conversation",
    noMessagesDescription: "Отправьте сообщение, чтобы начать personal dialogue с этим сотрудником.",
    composerPlaceholder: "Напишите сообщение как Owner…",
    composerHint: "Ответы employee — mock-only в V1 — runtime не подключён.",
    sendMessage: "Отправить",
    systemWelcome: "Personal conversation с {name} начата. Thread persistent и отделён от Tasks.",
    messageTypes: {
      message: "Сообщение",
      note: "Заметка",
      system: "Система",
      summary: "Сводка"
    },
    messageStatus: {
      sent: "отправлено",
      pending: "Ожидание",
      failed: "Ошибка",
      draft: "черновик"
    },
    sidebar: {
      employeeProfile: "Профиль сотрудника",
      pinnedNotes: "Закреплённые заметки",
      pinnedNotesDesc: "Важные заметки, закреплённые в этом private thread.",
      sharedDocuments: "Общие документы",
      sharedDocumentsDesc: "Документы, общие между Owner и этим сотрудником.",
      recentTopics: "Недавние темы",
      recentTopicsDesc: "Topics, недавно обсуждавшиеся в этом conversation.",
      quickActions: "Быстрые действия",
      quickActionsDesc: "Shortcuts для spawn tasks или capture decisions — future."
    },
    mockReplies: [
      "{name}: Спасибо — я здесь как ваш dedicated digital colleague.",
      "{name}: Понимаю. Позвольте reflect on that from my role perspective.",
      "{name}: Полезное направление. Помогу структурировать следующий шаг, когда будете готовы.",
      "{name}: Буду keep this context в нашем personal thread — separate from any Task queue.",
      "{name}: Принято. Спрашивайте в любое время — conversation сохраняется между сессиями."
    ]
  },
  chats: {
    listDescription: "Unified messenger для Owner и цифровых сотрудников — direct, group, workspace и system channels.",
    newDescription: "Start direct chat, group chat, workspace channel или open system channel.",
    newChat: "Новый чат",
    createChat: "Создать чат",
    openSystemChannel: "Открыть system channel",
    backToList: "Назад к чатам",
    ownerName: "Владелец",
    participants: "участников",
    updated: "Обновлено",
    localOnly: "Хранится локально — runtime не подключён",
    futureBadge: "Будущее",
    emptyListTitle: "Чатов пока нет",
    emptyListDescription: "Создайте чат для общения с Atlas, MAX, QA, Architect или любым custom employee.",
    selectChatTitle: "Выберите чат",
    selectChatDescription: "Выберите thread из списка или создайте новый чат.",
    notFoundTitle: "Чат не найден",
    notFoundDescription: "Этот чат отсутствует в local storage или был удалён.",
    noMessagesTitle: "Сообщений пока нет",
    noMessagesDescription: "Отправьте первое сообщение, чтобы начать этот чат.",
    newFormTitle: "Настройка чата",
    typeLabel: "Тип чата",
    titlePlaceholder: "напр. V1 rollout architecture review",
    selectEmployee: "Сотрудник",
    chooseEmployee: "Выберите сотрудника…",
    selectParticipants: "Выберите участников",
    selectParticipantsHint: "Выберите одного или нескольких цифровых сотрудников. Owner включается автоматически.",
    selectWorkspace: "Рабочее пространство",
    chooseWorkspace: "Выберите workspace…",
    workspaceLinked: "Рабочее пространство",
    openWorkspace: "Открыть рабочее пространство",
    addParticipant: "Добавить участника",
    removeParticipant: "Удалить участника",
    systemChannelHint: "Platform system channel — read-only placeholder для announcements и runtime status.",
    composerPlaceholder: "Напишите сообщение как Owner…",
    composerHint: "Ответы employee — mock-only в V1 — runtime не подключён.",
    mentionHint: "Упоминания: @Atlas, @MAX — в будущем.",
    sendMessage: "Отправить",
    systemWelcomeDirect: "Direct chat с {name} начат. Thread persistent и отделён от Tasks.",
    systemStartedGroup: "Group chat начат с {names}.",
    systemStartedWorkspace: "Workspace chat привязан к {name}.",
    types: {
      direct: "Прямой",
      group: "Группа",
      workspace: "Рабочее пространство",
      system: "Система"
    },
    status: {
      active: "Активные",
      archived: "В архиве",
      closed: "Закрыто"
    },
    messageTypes: {
      message: "Сообщение",
      note: "Заметка",
      system: "Система",
      summary: "Сводка",
      decision: "Решение"
    },
    messageStatus: {
      sent: "отправлено",
      pending: "Ожидание",
      failed: "Ошибка",
      draft: "черновик"
    },
    promote: {
      createTask: "Создать задачу",
      createReport: "Создать отчёт",
      createAdr: "Создать ADR",
      createDocument: "Создать документ"
    },
    sidebar: {
      participants: "Участники",
      workspace: "Рабочее пространство",
      pinnedNotes: "Закреплённые заметки",
      pinnedNotesDesc: "Важные заметки, закреплённые в этом чате.",
      artifacts: "Артефакты",
      artifactsDesc: "Files, reports и outputs, созданные в этом чате."
    },
    errors: {
      titleRequired: "Название чата обязательно.",
      employeeRequired: "Выберите сотрудника.",
      participantsRequired: "Выберите хотя бы одного сотрудника.",
      workspaceRequired: "Выберите workspace."
    },
    mockReplies: [
      "{name}: Согласен с направлением и могу поддержать следующий шаг.",
      "{name}: С архитектурной точки зрения, нужно сначала уточнить scope и dependencies.",
      "{name}: Могу review implementation details, когда decision станет clearer.",
      "{name}: QA потребует явные acceptance criteria перед продолжением.",
      "{name}: Предлагаю зафиксировать assumptions и risks в этом thread."
    ]
  },
  workspaces: {
    listDescription: "Project containers для knowledge, discussions, documents и employee assignments.",
    newDescription: "Создайте рабочее пространство — сотрудники присоединяются через Assignment, не через ownership.",
    newWorkspace: "Новое рабочее пространство",
    createWorkspace: "Создать рабочее пространство",
    openWorkspace: "Открыть рабочее пространство",
    backToList: "Назад к рабочим пространствам",
    localOnly: "Хранится локально — runtime не подключён",
    futureBadge: "Будущее",
    noDescription: "Описание не указано.",
    assignmentCount: "назначений",
    updated: "Обновлено",
    created: "Создано",
    navLabel: "Секции workspace",
    typeLabel: "Тип",
    owner: "Владелец",
    noOwner: "Owner не назначен",
    ownerPlaceholder: "напр. Igor — product lead",
    namePlaceholder: "напр. ServiceManager V1",
    descriptionPlaceholder: "Purpose, scope и context для этого workspace…",
    selector: {
      label: "Рабочее пространство",
      none: "Выберите workspace…",
      empty: "Рабочих пространств пока нет",
      manage: "Все рабочие пространства"
    },
    type: {
      general: "Общее",
      product: "Продукт",
      engineering: "Инженерия",
      operations: "Операции",
      research: "Исследование"
    },
    emptyListTitle: "Рабочих пространств пока нет",
    emptyListDescription: "Создайте рабочее пространство для назначения цифровых сотрудников и организации project context.",
    notFoundTitle: "Workspace не найден",
    notFoundDescription: "Это рабочее пространство отсутствует в local storage или было удалено.",
    newFormTitle: "Настройка workspace",
    status: {
      draft: "Черновик",
      active: "Активные",
      maintenance: "Обслуживание",
      archived: "В архиве"
    },
    tabs: {
      overview: "Обзор",
      employees: "Сотрудники",
      knowledge: "База знаний",
      documents: "Документы",
      activity: "Активность",
      tools: "Инструменты",
      settings: "Настройки"
    },
    overview: {
      summary: "Сводка",
      description: "Описание",
      employees: "Сотрудники",
      purpose: "Назначение",
      purposeText: "Workspace — operational container для projects. Employees do not belong to a workspace — they are linked through Assignment only."
    },
    assignments: {
      assignEmployee: "Назначить сотрудника",
      selectEmployee: "Сотрудник",
      chooseEmployee: "Выберите сотрудника…",
      roleLabel: "Роль в workspace",
      rolePlaceholder: "напр. Lead Developer",
      loadPercent: "Нагрузка %",
      assignButton: "Назначить",
      currentAssignments: "Текущие назначения",
      emptyTitle: "Назначений пока нет",
      emptyDescription: "Назначьте существующих цифровых сотрудников на это рабочее пространство.",
      remove: "Удалить",
      workspaceColumn: "Рабочее пространство",
      status: {
        active: "Активные",
        paused: "На паузе",
        ended: "Завершено"
      },
      errors: {
        employeeRequired: "Выберите сотрудника.",
        roleRequired: "Role обязательна."
      }
    },
    knowledge: {
      title: "База знаний",
      description: "Documents, indices и embeddings в scope workspace — в будущем."
    },
    documents: {
      title: "Документы",
      description: "Files и artifacts в этом workspace — в будущем."
    },
    discussions: {
      title: "Обсуждения рабочего пространства",
      description: "Обсуждения в scope этого workspace появятся здесь — V1 использует global discussions.",
      openGlobal: "Открыть обсуждения"
    },
    activity: {
      title: "Активность рабочего пространства",
      description: "Audit trail, events и действия агентов в scope этого workspace — в будущем."
    },
    tools: {
      title: "Инструменты рабочего пространства",
      description: "Tool bindings и integrations для этого workspace — future.",
      openCatalog: "Открыть tool catalog"
    },
    settings: {
      title: "Настройки workspace",
      save: "Сохранить изменения",
      saved: "Настройки сохранены локально."
    },
    errors: {
      nameRequired: "Название workspace обязательно."
    }
  },
  projects: {
    listDescription: "Delivery entities, где digital employees строят продукты — Company → Project → Workspace → Assignments → Runtime.",
    newDescription: "Создайте проект и привяжите к operational workspace.",
    newProject: "Новый проект",
    createProject: "Создать проект",
    openProject: "Открыть проект",
    backToList: "Назад к проектам",
    localOnly: "Хранится локально — backend не подключён",
    noDescription: "Описание не указано.",
    navLabel: "Разделы проекта",
    owner: "Владелец",
    noOwner: "Owner не назначен",
    ownerPlaceholder: "напр. Igor — product owner",
    titlePlaceholder: "напр. AI Photo Lab",
    descriptionPlaceholder: "Цели, scope и контекст delivery для проекта…",
    workspaceLabel: "Связанный workspace",
    noWorkspaces: "Сначала создайте workspace",
    deadline: "Дедлайн",
    progress: "Прогресс",
    updated: "Обновлено",
    emptyListTitle: "Проектов пока нет",
    emptyListDescription: "Проекты — место, где digital employees доставляют software. Создайте первый.",
    notFoundTitle: "Проект не найден",
    notFoundDescription: "Проект отсутствует в local storage или был удалён.",
    newFormTitle: "Настройка проекта",
    status: {
      planning: "Планирование",
      active: "Активные",
      on_hold: "На паузе",
      completed: "Завершено",
      archived: "В архиве"
    },
    priority: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      critical: "Критический"
    },
    tabs: {
      overview: "Обзор",
      team: "Команда",
      tasks: "Задачи",
      board: "Доска",
      milestones: "Milestones",
      roadmap: "Roadmap",
      timeline: "Хронология",
      assignments: "Назначения",
      runtime: "Runtime",
      reports: "Отчёты",
      activity: "Активность",
      chats: "Чаты",
      knowledge: "База знаний",
      handoffs: "Handoffs"
    },
    dashboard: {
      health: "Project Health",
      healthSub: "общий прогресс",
      sprintProgress: "Sprint Progress",
      milestonesDone: "milestones выполнено",
      runtimeQueue: "Runtime Queue",
      waitingApproval: "ожидают approval",
      teamActivity: "Team Activity",
      assignmentsSub: "active workspace assignments",
      approvals: "Согласования",
      approvalsSub: "pending decisions",
      recentDiscussions: "Recent Discussions",
      risks: "Open Risks",
      risksSub: "в project register"
    },
    team: {
      title: "Project Team",
      empty: "Члены команды не назначены.",
      viewProfile: "Профиль",
      roles: {
        lead: "Lead",
        developer: "Developer",
        qa: "QA",
        architect: "Architect",
        pm: "PM",
        designer: "Designer",
        member: "Участник"
      }
    },
    board: {
      title: "Project Board",
      description: "Delivery task kanban — backlog, in progress, review, done.",
      empty: "Пусто",
      columns: {
        backlog: "Backlog",
        in_progress: "In Progress",
        review: "Blocked",
        done: "Готово"
      }
    },
    milestones: {
      title: "Milestones",
      short: "milestones",
      empty: "Milestones не определены.",
      status: {
        planned: "Планируемые",
        in_progress: "В процессе",
        done: "Готово",
        blocked: "Blocked"
      }
    },
    roadmap: {
      title: "Roadmap",
      empty: "Ничего не запланировано",
      horizons: {
        now: "Now",
        next: "Next",
        later: "Later"
      }
    },
    timeline: {
      title: "Project Timeline",
      description: "Даты milestones и recent company events для delivery.",
      viewCompany: "Company timeline"
    },
    reports: {
      title: "Project Reports",
      description: "Reports от digital employees — project scope в V2.",
      empty: "Reports пока нет.",
      viewAll: "Все reports"
    },
    runtime: {
      title: "Runtime Queue",
      description: "Runtime runs для workspace {workspace} — company-wide queue в V1.",
      empty: "Runtime runs пока нет.",
      viewRuns: "Run history",
      settings: "Runtime settings"
    },
    activity: {
      title: "Project Activity",
      description: "Recent company events — project-scoped audit в V2.",
      empty: "Активности пока нет."
    },
    chats: {
      title: "Project Chats",
      description: "Delivery discussions — включая #ai-photo-lab-delivery.",
      empty: "Project chats пока нет.",
      messages: "сообщений",
      open: "Открыть чаты"
    },
    knowledge: {
      title: "Project Knowledge",
      description: "Knowledge entries для linked workspace.",
      empty: "Knowledge entries для workspace пока нет.",
      openWorkspace: "Открыть рабочее пространство"
    },
    tasks: {
      title: "Delivery Tasks",
      description: "Назначенные задачи с priority, status и expected output.",
      empty: "Delivery tasks пока нет.",
      expectedOutput: "Expected output"
    },
    taskStatus: {
      backlog: "Backlog",
      in_progress: "В процессе",
      review: "Проверка",
      done: "Готово",
      blocked: "Blocked"
    },
    taskPriority: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      critical: "Критический"
    },
    future: {
      label: "Будущее",
      budget: "Budget",
      client: "Client",
      invoices: "Invoices",
      releases: "Releases"
    },
    errors: {
      titleRequired: "Название проекта обязательно.",
      workspaceRequired: "Выберите linked workspace."
    }
  },
  presence: {
    pageDescription: "Operational workday layer — кто работает, ждёт, в discussion или требует внимания Owner. Mock engine, без Runtime execution.",
    localOnly: "Вычисляется локально из tasks, runtime queue, chats, projects и approvals.",
    since: "С",
    expected: "ETA",
    status: {
      offline: "Offline",
      available: "Available",
      busy: "Busy",
      in_discussion: "In Discussion",
      working: "Работает",
      waiting_approval: "Waiting Approval",
      reviewing: "На проверке",
      learning: "Learning",
      break: "Break"
    },
    dashboard: {
      nowWorking: "Now Working",
      waiting: "Waiting",
      needsAttention: "Needs Attention",
      available: "Available",
      recentlyFinished: "Recently Finished",
      todaysActivity: "Today's Activity",
      currentAssignment: "Current Assignment",
      recentReports: "Recent Reports",
      noWorking: "Сейчас никто активно не работает.",
      noWaiting: "Никто не ждёт approval.",
      noFinished: "Завершённых work blocks сегодня нет.",
      noAssignments: "Active workspace assignments нет.",
      noReports: "Recent reports нет."
    },
    currentWork: {
      title: "Current Work",
      offline: "Employee offline или не активирован.",
      project: "Project",
      workspace: "Рабочее пространство",
      task: "Задача",
      run: "Runtime run",
      started: "Начало",
      expectedFinish: "Expected finish"
    },
    workday: {
      empty: "Workday events пока нет."
    },
    workdayTypes: {
      work_started: "Начало",
      work_finished: "Окончание",
      discussion: "Обсуждение",
      approval_wait: "Согласование",
      review: "Проверка",
      learning: "Learning",
      break: "Break"
    },
    timeline: {
      title: "Workday Timeline",
      description: "Сегодняшняя активность digital employees из presence transitions."
    }
  },
  reports: {
    pageDescription: "Structured reports от digital employees — explainable, reviewable, Owner-facing до Runtime.",
    catalogTitle: "Каталог отчётов",
    reportCount: "отчёты",
    openReport: "Открыть отчёт",
    backToList: "Назад к отчётам",
    localOnly: "Хранится в localStorage — mock/seed data в V1, без Runtime.",
    reportsFirstNote: "Reports-first: каждое важное действие employee должно создавать report.",
    notFoundTitle: "Report не найден",
    notFoundDescription: "Этот report отсутствует в catalog.",
    noEmployee: "Платформа",
    noRisks: "Риски не выявлены.",
    noRecommendations: "Рекомендаций пока нет.",
    emptyTitle: "Нет подходящих reports",
    emptyDescription: "Измените фильтры или дождитесь отчётов от сотрудников.",
    searchPlaceholder: "Поиск отчётов…",
    findingsCount: "выводы",
    risksCount: "риски",
    created: "Создано",
    updated: "Обновлено",
    stats: {
      total: "Всего reports",
      published: "Опубликовано",
      reviewed: "Проверено",
      draft: "Черновик"
    },
    filters: {
      search: "Поиск",
      type: "Тип",
      status: "Статус"
    },
    types: {
      architecture: "Архитектура",
      task: "Задача",
      qa: "QA",
      devops: "DevOps",
      marketing: "Маркетинг",
      finance: "Финансы",
      operations: "Операции",
      system: "Система"
    },
    status: {
      draft: "Черновик",
      published: "Опубликовано",
      reviewed: "Проверено",
      archived: "В архиве"
    },
    sections: {
      summary: "Сводка",
      findings: "Выводы",
      risks: "Риски",
      recommendations: "Рекомендации",
      evidence: "Подтверждение"
    },
    evidenceKinds: {
      link: "Ссылка",
      artifact: "Артефакт",
      quote: "Цитата",
      metric: "Метрика"
    }
  },
  audit: {
    pageDescription: "Immutable audit trail — каждый tool call, permission change и critical decision оставляет trace.",
    timelineTitle: "Хронология аудита",
    eventCount: "события",
    localOnly: "Хранится в localStorage — seed events в V1, Runtime будет дописывать live.",
    auditPrincipleNote: "Audit principle: tool calls, runtime actions, permission changes, workspace assignments и critical decisions должны создавать audit events.",
    emptyTitle: "Нет подходящих events",
    emptyDescription: "Измените фильтры — будущие Runtime actions будут дописываться автоматически.",
    searchLabel: "Поиск",
    searchPlaceholder: "Поиск actor, action, target…",
    stats: {
      total: "Всего events",
      owner: "Владелец",
      employee: "Сотрудник",
      system: "Система"
    },
    filters: {
      actor: "Инициатор",
      action: "Действие",
      target: "Цель"
    },
    actors: {
      owner: "Владелец",
      employee: "Сотрудник",
      system: "Система"
    },
    actions: {
      create: "Создать",
      update: "Обновить",
      delete: "Удалить",
      invoke: "Вызвать",
      assign: "Назначить",
      unassign: "Снять назначение",
      approve: "Одобрить",
      reject: "Отклонить",
      review: "Проверка",
      publish: "Опубликовать",
      login: "Вход",
      configure: "Настроить"
    },
    targetTypes: {
      tool: "Инструмент",
      employee: "Сотрудник",
      workspace: "Рабочее пространство",
      task: "Задача",
      report: "Отчёт",
      permission: "Разрешение",
      assignment: "Назначение",
      discussion: "Обсуждение",
      memory: "Память",
      approval: "Согласование",
      run: "Запуск",
      system: "Система",
      company: "Company",
      project: "Project"
    }
  },
  notificationEngine: {
    pageDescription: "Unified operational inbox — every important platform event produces an owner-facing notification with severity, context, and deep links.",
    inboxTitle: "Notifications",
    bellLabel: "Notifications",
    emptyInbox: "Notifications пока нет.",
    markRead: "Mark read",
    markAllRead: "Mark all read",
    openAction: "Открыть",
    viewInbox: "View inbox",
    itemCount: "элементов",
    unreadCount: "{count} unread notifications",
    searchLabel: "Поиск",
    searchPlaceholder: "Title, summary, category, employee…",
    principleNote: "Notification principle: emitEvent() and audit actions automatically enqueue inbox items — Owner reviews one surface instead of every module page.",
    localOnly: "Stored in localStorage (ai-company-notifications) — synced from events and audit in V1.",
    timelineHint: "Timeline events also appear in the Notification Center with actionable links.",
    approvalInbox: "Approval notifications",
    reportInbox: "Report notifications",
    chatInbox: "Chat notifications",
    runtimeInbox: "Runtime notifications",
    filters: {
      category: "Категория",
      severity: "Критичность",
      read: "Чтение",
      unread: "Unread"
    },
    severity: {
      info: "Инфо",
      success: "Успех",
      warn: "Предупреждение",
      error: "Ошибка"
    },
    stats: {
      total: "Всего",
      unread: "Unread",
      approval: "Unread approvals",
      runtime: "Unread runtime"
    },
    categories: {
      approval: "Согласование",
      runtime: "Runtime",
      project: "Project",
      employee: "Сотрудник",
      knowledge: "База знаний",
      chat: "Chat",
      discussion: "Обсуждение",
      task: "Задача",
      report: "Отчёт",
      audit: "Аудит",
      system: "Система"
    }
  },
  eventEngine: {
    pageDescription: "Internal event bus — каждое важное действие платформы становится event для Runtime, Automation, Notifications и Analytics.",
    activityDescription: "Scoped activity feed — фильтр по employee или workspace.",
    timelineTitle: "Хронология компании",
    activityTitle: "Лента активности",
    eventCount: "события",
    localOnly: "Stored in localStorage (ai-company-events) — seed data in V1; modules emit via emitEvent().",
    principleNote: "Event principle: reports, audit, runtime, notifications и analytics подписываются на events — без direct coupling.",
    futureBadge: "Будущее",
    emptyTitle: "Нет подходящих events",
    emptyDescription: "Измените фильтры — будущие модули будут emit events автоматически.",
    searchLabel: "Поиск",
    searchPlaceholder: "Поиск type, source, metadata…",
    scopeLabel: "Область",
    clearScope: "Очистить scope",
    sourceLabel: "Источник",
    employeeLabel: "Сотрудник",
    workspaceLabel: "Рабочее пространство",
    reportLabel: "Отчёт",
    scopes: {
      company: "Хронология компании",
      employee: "Employee · {name}",
      workspace: "Workspace · {name}"
    },
    stats: {
      total: "Всего events",
      success: "Успех",
      warn: "Предупреждения",
      withWorkspace: "Workspace-linked"
    },
    filters: {
      employee: "Сотрудник",
      workspace: "Рабочее пространство",
      noWorkspace: "Нет рабочего пространства",
      severity: "Критичность",
      type: "Тип события",
      dateFrom: "От",
      dateTo: "К"
    },
    types: {
      "employee.created": "Сотрудник создан",
      "employee.updated": "Сотрудник обновлён",
      "workspace.created": "Рабочее пространство создано",
      "workspace.assigned": "Рабочее пространство назначено",
      "conversation.started": "Беседа начата",
      "chat.message": "Сообщение чата",
      "memory.added": "Память добавлена",
      "knowledge.updated": "Знания обновлены",
      "report.created": "Отчёт создан",
      "approval.requested": "Запрошено согласование",
      "approval.granted": "Согласование одобрено",
      "approval.rejected": "Согласование отклонено",
      "tool.connected": "Инструмент подключён",
      "task.created": "Задача создана",
      "task.completed": "Задача завершена",
      "task_result.created": "Task Result создан",
      "task_result.ready": "Task Result готов",
      "task_result.approved": "Task Result одобрен",
      "task_result.changes_requested": "Task Result — нужны правки",
      "task_result.rejected": "Task Result отклонён",
      "task_result.archived": "Task Result архивирован",
      "runtime.started": "Runtime Started",
      "runtime.failed": "Runtime Failed",
      "run.completed": "Запуск завершён",
      "collaboration.started": "Collaboration Started",
      "collaboration.message": "Collaboration Message",
      "collaboration.consensus": "Collaboration Consensus",
      "collaboration.completed": "Collaboration Completed",
      "handoff.created": "Handoff Created",
      "handoff.sent": "Handoff Sent",
      "handoff.returned": "Handoff Returned",
      "handoff.accepted": "Handoff Accepted",
      "handoff.rejected": "Handoff Rejected",
      "sprint.planned": "Sprint Planned",
      "sprint.started": "Sprint Started",
      "sprint.completed": "Sprint Completed",
      "workday.started": "Рабочий день начат",
      "workday.phase_changed": "Фаза рабочего дня изменена",
      "workday.finished": "Рабочий день завершён"
    }
  },
  runEngine: {
    pageDescription: "Воспроизводимый журнал выполнения для каждого run цифрового сотрудника — независим от модели, полностью объясним, готов для будущего Ollama Runtime.",
    catalogTitle: "История запусков",
    runCount: "запуски",
    runDetailsTitle: "Детали запуска",
    runDetailsDescription: "Полный trace pipeline — context, steps, metrics, artifacts и warnings.",
    detailsNavLabel: "Секции run details",
    backToList: "Назад к истории запусков",
    notFoundTitle: "Run не найден",
    notFoundDescription: "Этот run отсутствует в local storage.",
    emptyListTitle: "Нет подходящих runs",
    emptyListDescription: "Измените фильтры или запустите Runtime orchestrator run.",
    emptyArtifacts: "Нет artifacts для этого run.",
    emptyWarnings: "Нет предупреждений.",
    emptyContext: "Context layers не записаны.",
    emptyEmployeeRuns: "Run history для этого employee пока пуст.",
    employeeRunsTitle: "История запусков",
    employeeRunsDescription: "Прошлые выполнения employee — каждый Runtime run создаёт одну history-запись.",
    openAllRuns: "Все запуски",
    openRun: "Открыть запуск",
    openReport: "Открыть отчёт",
    openTimeline: "Хронология",
    linkedRun: "Связанный запуск",
    runtimeRunId: "Runtime run",
    platformWide: "Platform-wide",
    placeholderBadge: "Заглушка",
    startedAt: "Начало",
    finishedAt: "Окончание",
    contextLoaded: "Загружено",
    contextNotLoaded: "Не загружено",
    contextItems: "элементов",
    searchLabel: "Поиск",
    searchPlaceholder: "ID запуска, сотрудник, модель, отчёт…",
    principleNote: "Run History принадлежит employee и платформе — not to the LLM provider. Смена модели не стирает execution logs.",
    localOnly: "Stored in localStorage (ai-company-run-history) — Runtime will append records when connected.",
    filters: {
      status: "Статус",
      employee: "Сотрудник",
      workspace: "Рабочее пространство"
    },
    stats: {
      total: "Всего запусков",
      completed: "Завершено",
      waitingApproval: "Ожидание согласования",
      failed: "Ошибка"
    },
    statuses: {
      queued: "В очереди",
      running: "Выполняется",
      waiting_approval: "Ожидание согласования",
      completed: "Завершено",
      failed: "Ошибка",
      cancelled: "Отменено"
    },
    stepStatuses: {
      pending: "Ожидание",
      active: "Активные",
      done: "Готово",
      skipped: "Пропущено",
      failed: "Ошибка"
    },
    steps: {
      context_loaded: "Контекст загружен",
      knowledge_loaded: "Знания загружены",
      memory_loaded: "Память загружена",
      model_selected: "Модель выбрана",
      approval_requested: "Запрошено согласование",
      execution_started: "Выполнение начато",
      execution_finished: "Выполнение завершено",
      report_generated: "Отчёт сгенерирован",
      events_created: "События созданы"
    },
    metrics: {
      duration: "Длительность",
      estimatedCost: "Прим. стоимость",
      estimatedTokens: "Прим. токены",
      memoryRecords: "Записи памяти",
      knowledgeRecords: "Записи знаний",
      toolCalls: "Вызовы инструментов",
      warnings: "Предупреждения"
    },
    artifactKinds: {
      generated_report: "Сгенерированный отчёт",
      generated_summary: "Сгенерированная сводка",
      generated_adr: "Сгенерированный ADR",
      generated_task: "Сгенерированная задача",
      generated_document: "Сгенерированный документ"
    },
    timelineKinds: {
      step: "Шаг",
      warning: "Предупреждение",
      artifact: "Артефакт",
      event: "Событие"
    },
    warningSeverities: {
      info: "Инфо",
      warn: "Предупреждение",
      error: "Ошибка"
    },
    sections: {
      overview: "Обзор",
      pipeline: "Пайплайн",
      metrics: "Метрики",
      artifacts: "Артефакты",
      warnings: "Предупреждения",
      timeline: "Хронология",
      context: "Контекст"
    }
  },
  executionEngine: {
    pageDescription: "Очередь выполнения задач сотрудников — связывает delivery tasks, runtime runs и lifecycle statuses в одном orchestration layer.",
    queueTitle: "Очередь выполнения",
    executionCount: "выполнения",
    runningNowTitle: "Сейчас выполняется",
    runningNowEmpty: "Нет активных executions в этом scope.",
    nextTasksTitle: "Следующие задачи",
    nextTasksEmpty: "Очередь пуста — поставьте delivery task в очередь.",
    inspectorTitle: "Execution Inspector",
    inspectorEmptyTitle: "Выберите execution",
    inspectorEmptyDescription: "Выберите карточку из очереди, чтобы inspect lifecycle, runtime link и actions.",
    timelineTitle: "Lifecycle выполнения",
    pendingStep: "Ожидание",
    priority: "Приоритет",
    queuePosition: "Позиция в очереди",
    estimatedDuration: "Оценка длительности",
    minutesShort: " мин",
    taskId: "Task ID",
    startedAt: "Начало",
    finishedAt: "Окончание",
    linkedRun: "Связанный запуск",
    noRuntimeRun: "Runtime run не связан",
    noProject: "Без проекта",
    openPhotoLab: "AI Photo Lab",
    principleNote: "Execution принадлежит очереди сотрудника — задачи становятся активным lifecycle, а не пассивными записями.",
    localOnly: "Хранится в localStorage (ai-company-executions) — future API: enqueueTask, cancel, retry, complete.",
    emptyQueueTitle: "Нет executions в этом scope",
    emptyQueueDescription: "Смените scope или поставьте задачи из delivery board проекта.",
    scope: {
      label: "Scope очереди",
      company: "Company queue",
      employee: "Employee queue",
      project: "Project queue",
      workspace: "Workspace queue"
    },
    stats: {
      currentQueue: "Текущая очередь",
      nextTasks: "Следующие задачи",
      runningNow: "Сейчас выполняется",
      completedToday: "Завершено сегодня"
    },
    priorities: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      critical: "Критический"
    },
    statuses: {
      queued: "В очереди",
      preparing: "Подготовка",
      waiting_approval: "Ожидает согласования",
      running: "Выполняется",
      review: "Проверка",
      completed: "Завершено",
      failed: "Ошибка",
      cancelled: "Отменено"
    },
    actions: {
      enqueue: "Поставить в очередь",
      cancel: "Отмена",
      retry: "Повторить",
      complete: "Завершить"
    }
  },
  taskRunner: {
    title: "Запуск задачи сотрудника",
    description: "Вставьте задачу из чата, назначьте цифрового сотрудника и запустите реальный Runtime через Ollama.",
    intro: "Owner flow: вставить задачу → выбрать сотрудника и режим → Start → мониторинг в Live Runtime Monitor.",
    localNote: "Хранится в localStorage (ai-company-task-runner-history, ai-company-delivery-tasks, ai-company-executions, ai-company-runtime-runs).",
    employeeHint: "Доступные сотрудники: {names}",
    suggested: "Рекомендуется",
    defaultForEmployee: "По умолчанию",
    extractedTitle: "Авто-заголовок: {title}",
    startNote: "Создаёт delivery task, execution, runtime run, draft report, timeline и notification.",
    sections: {
      input: "Текст задачи",
      employee: "Сотрудник",
      mode: "Режим",
      project: "Проект и workspace",
      preview: "Предпросмотр",
      result: "Последний результат",
      history: "История запусков"
    },
    fields: {
      taskText: "Текст задачи",
      title: "Заголовок (опционально)",
      expectedOutput: "Ожидаемый результат",
      constraints: "Ограничения",
      priority: "Приоритет",
      project: "Проект",
      workspace: "Рабочее пространство"
    },
    placeholders: {
      taskText: "Вставьте задачу из чата, briefing или чек-листа…",
      title: "Оставьте пустым — возьмём первую строку"
    },
    modes: {
      planning: "Планирование",
      architecture: "Архитектура",
      technical_audit: "Technical Audit",
      qa_review: "QA Review",
      devops_plan: "DevOps Plan",
      handoff_preparation: "Handoff Preparation",
      documentation: "Документация",
      product_review: "Product Review"
    },
    preview: {
      title: "Название",
      employee: "Сотрудник",
      mode: "Режим",
      project: "Проект",
      workspace: "Рабочее пространство",
      taskExcerpt: "Фрагмент задачи",
      emptyTask: "Вставьте текст задачи для предпросмотра…"
    },
    actions: {
      start: "Start",
      starting: "Запуск…",
      openRunTask: "Запуск задачи"
    },
    result: {
      empty: "Запустите задачу, чтобы увидеть ответ сотрудника.",
      openLive: "Live monitor",
      openRun: "Детали run",
      openReport: "Отчёт",
      noResponse: "Run завершился без текста ответа."
    },
    history: {
      empty: "Пока не было запусков через Run Task.",
      live: "Live",
      report: "Отчёт"
    }
  },
  photoLabKickoff: {
    title: "AI Photo Lab Kickoff",
    description: "Owner kickoff hub — CTO plan, sprint, demo readiness, Codex handoff и быстрые запуски сотрудников.",
    actionsHint: "Запустите пресеты Atlas / MAX / QA или перейдите на связанные поверхности.",
    handoffChecklistDone: "пунктов чек-листа",
    demoReadyLabel: "gates ready",
    sections: {
      ctoPlan: "CTO plan",
      sprintGoal: "Sprint goal",
      demoReadiness: "Demo readiness",
      maxHandoff: "MAX → Codex handoff",
      qaChecklist: "QA checklist",
      ownerApprovals: "Owner approvals",
      actions: "Kickoff actions",
      teamActivity: "Активность команды сейчас"
    },
    links: {
      controlRoom: "Control Room"
    },
    cto: {
      weekGoal: "Week goal",
      priorities: "Priorities",
      codexScope: "Codex scope"
    },
    sprint: {
      name: "Sprint",
      status: "Статус",
      tasks: "Задачи",
      health: "Health"
    },
    owner: {
      decisions: "Owner decisions",
      approvals: "Pending approvals",
      noDecisions: "Нет открытых owner decisions.",
      noApprovals: "Нет pending approvals."
    },
    demoOverall: {
      ready: "Ready",
      needs_fix: "Needs Fix",
      blocked: "Blocked"
    },
    gateStatus: {
      ready: "Ready",
      needs_fix: "Needs Fix",
      blocked: "Blocked",
      pending: "Ожидание"
    },
    actions: {
      startAtlas: "Start Atlas (Planning)",
      startMax: "Start MAX (Technical Audit)",
      startQa: "Start QA (Demo Review)",
      starting: "Запуск…",
      review: "Проверка",
      openSprint: "Open Sprint",
      openCodexHandoff: "Codex handoff",
      openDemoChecklist: "Demo checklist",
      openLiveRuntime: "Live Runtime",
      openVisualLab: "Visual Lab",
      openRunTask: "Run Task"
    },
    notFoundTitle: "Kickoff недоступен",
    notFoundDescription: "Не удалось загрузить kickoff snapshot AI Photo Lab.",
    pageDescription: "Owner kickoff hub — CTO plan, sprint, demo readiness, Codex handoff и быстрые запуски сотрудников.",
    localNote: "Kickoff использует excerpts из docs и Control Room snapshot.",
    stats: {
      demoReady: "Demo gates",
      decisions: "Decisions",
      approvals: "Согласования",
      progress: "Progress"
    }
  },
  taskResultEngine: {
    pageDescription: "Очередь Owner review для результатов runtime — принять, отклонить или отправить на доработку после Run Task.",
    openNotifications: "Уведомления по задачам",
    filtersTitle: "Фильтры",
    catalogTitle: "Очередь результатов",
    previewTitle: "Предпросмотр review",
    searchLabel: "Поиск",
    searchPlaceholder: "Название, сотрудник, task id…",
    openDetails: "Открыть детали",
    selectResult: "Выберите результат для review.",
    empty: "Нет результатов — запустите задачу из Employee Runtime.",
    notFoundTitle: "Результат не найден",
    notFoundDescription: "Этот результат отсутствует в local storage.",
    backToList: "Назад к результатам",
    openRun: "Открыть runtime run",
    openReport: "Открыть отчёт",
    openHandoff: "Открыть handoff",
    openFollowUp: "Открыть follow-up задачу",
    openProject: "Открыть проект",
    noTimeline: "История review пуста.",
    noFindings: "Findings не записаны.",
    noArtifacts: "Артефакты не привязаны.",
    commentPlaceholder: "Комментарий Owner для сотрудника…",
    principleNote: "Flow: Run Task → Runtime Result → Draft Report → Owner Review → Approve / Changes / Reject → Timeline + Notification + Task status.",
    flowNote: "Approve публикует отчёт и закрывает delivery task. Request changes возвращает задачу в in_progress.",
    localOnly: "localStorage (ai-company-task-results) — mock-only.",
    stats: {
      total: "Всего результатов",
      readyForReview: "Ready for review",
      approved: "Одобрено",
      changesRequested: "Changes requested"
    },
    sections: {
      review: "Owner review",
      output: "Output сотрудника",
      artifacts: "Артефакты и ссылки",
      timeline: "Timeline review"
    },
    fields: {
      status: "Статус",
      ownerComment: "Комментарий Owner"
    },
    actions: {
      approve: "Одобрить",
      requestChanges: "Request changes",
      reject: "Отклонить",
      createFollowUp: "Create follow-up task",
      sendToQa: "Send to QA",
      sendToCodex: "Send to Codex handoff",
      archive: "Archive"
    },
    statuses: {
      draft: "Черновик",
      ready_for_review: "Ready for Review",
      approved: "Одобрено",
      changes_requested: "Changes Requested",
      rejected: "Отклонено",
      archived: "В архиве"
    },
    reviewActions: {
      submit_for_review: "Submitted for review",
      approve: "Одобрено",
      request_changes: "Changes requested",
      reject: "Отклонено",
      create_follow_up: "Follow-up task created",
      send_to_qa: "Sent to QA",
      send_to_codex: "Sent to Codex",
      archive: "В архиве"
    }
  },
  canvasEngine: {
    pageDescription: "Premium operational graph — кто работает, как движутся задачи, где Runtime и где ждут approvals.",
    projectFocusDescription: "Project focus — {project}: squad, tasks, runtime runs, reports, approvals и tool gateway.",
    nodes: "nodes",
    connections: "связей",
    liveOn: "Live вкл",
    liveOff: "Live выкл",
    liveFeed: "Лента в реальном времени",
    zoomIn: "Приблизить",
    zoomOut: "Отдалить",
    fitView: "Вписать",
    resetView: "Сбросить вид",
    refresh: "Обновить",
    layers: "Слои",
    inspectorEmptyTitle: "Выберите узел",
    inspectorEmptyDescription: "Нажмите на employee, task, run, approval или runtime, чтобы увидеть связи и перейти на страницу сущности.",
    canvasSummary: "Сводка canvas",
    summaryEmployees: "Сотрудники",
    summaryTasks: "Задачи",
    summaryApprovals: "Согласования",
    summaryRuns: "История запусков",
    activeEmployees: "Активные сотрудники",
    runningTasks: "Running tasks",
    waitingApprovals: "Waiting approvals",
    recentActivity: "Недавняя активность",
    noActiveEmployees: "Нет активных employees в этом view.",
    noRunningTasks: "Сейчас нет running tasks.",
    noWaitingApprovals: "Нет pending approvals.",
    noRecentActivity: "Недавней активности пока нет.",
    connectionSelected: "Выбрана связь",
    connectionSelectedHint: "Это ребро показывает поток работы или коммуникации между узлами.",
    status: "Статус",
    idleStatus: "Простой",
    relatedEntities: "Связанные сущности",
    recentEvents: "Недавние events",
    noRelatedEntities: "Нет напрямую связанных сущностей.",
    openEntity: "Открыть страницу",
    openRuntime: "Открыть Runtime",
    openTool: "Открыть tool",
    openReport: "Открыть отчёт",
    inbound: "Входящие",
    outbound: "Исходящие",
    noConnections: "Нет связей в этом представлении.",
    futureRealtime: "Будущее: realtime WebSocket sync с Runtime и presence.",
    futureWebSocket: "Будущее: WebSocket event stream для live-обновлений графа.",
    futureStreaming: "Будущее: runtime streaming overlays на execution и run edges.",
    layerLabels: {
      employees: "Сотрудники",
      projects: "Projects",
      tasks: "Задачи",
      runtime: "Runtime",
      reports: "Отчёты",
      approvals: "Согласования",
      knowledge: "База знаний",
      tools: "Инструменты",
      chats: "Чаты"
    },
    modes: {
      company: "Компания",
      project: "Проект",
      runtime: "Runtime",
      knowledge: "База знаний",
      organization: "Организация",
      live: "Live"
    },
    liveStatuses: {
      working: "Работает",
      thinking: "Думает",
      waiting: "Ждёт",
      running: "Выполняется",
      review: "Проверка",
      completed: "Завершено"
    },
    nodeKinds: {
      employee: "Сотрудник",
      project: "Project",
      workspace: "Рабочее пространство",
      task: "Задача",
      runtime: "Runtime",
      run: "Запуск",
      report: "Отчёт",
      approval: "Согласование",
      knowledge: "База знаний",
      tool: "Инструмент"
    },
    connectionTypes: {
      assignment: "Назначение",
      execution: "Execution",
      runtime: "Runtime",
      report: "Отчёт",
      approval: "Согласование",
      knowledge: "База знаний",
      tool: "Инструмент",
      chat: "Chat"
    }
  },
  runtimeEngine: {
    pageDescription: "Model-independent Runtime Profiles — сменяемые LLM engines с routing, privacy и cost policies.",
    employeePageTitle: "{name} — Runtime Profile",
    employeePageDescription: "Конфигурация Runtime engine для сотрудника — выбор модели отделён от identity, memory и experience.",
    employeeRuntimePage: "Employee Runtime",
    employeeSectionTitle: "Runtime Profile",
    employeeSectionDescription: "Primary model, fallbacks, routing rules и policies — identity и memory остаются у Employee, не у модели.",
    openRuntime: "Runtime",
    openFullRuntime: "Открыть страницу Runtime",
    models: {
      mockLocal: "Mock Local Model"
    },
    profileSummary: "Сводка Runtime",
    routerPreview: "Предпросмотр model router",
    routerSimulator: "Симулятор model router",
    policiesTitle: "Политики privacy и cost",
    futureConnectorsTitle: "Будущие коннекторы",
    futureConnectorsDescription: "Коннекторы Ollama, OpenRouter и Runtime Orchestrator — placeholder, без реального inference в V1.",
    futureBadge: "Будущее",
    localOnly: "Stored in localStorage (ai-company-runtime-profiles) — no Ollama or cloud calls in V1.",
    principleNote: "Независимость модели: identity, memory, experience, reputation и competence сотрудника не хранятся в LLM.",
    modelIndependenceNote: "Смена модели у Atlas с Qwen на Claude/GPT/Ollama не переносит и не стирает memory, experience и identity.",
    notFoundTitle: "Runtime profile не найден",
    notFoundDescription: "Не удалось загрузить runtime profile — сотрудник не найден.",
    emptyProfiles: "Runtime profiles пока нет — откройте страницу Runtime сотрудника.",
    profilesCatalog: "Runtime profiles сотрудников",
    providersCatalog: "Провайдеры моделей",
    primaryModel: "Основная модель",
    fallbackModels: "Резервные модели",
    fallbackChain: "Цепочка fallback",
    allowedProviders: "Разрешённые провайдеры",
    routingRules: "Правила маршрутизации",
    runtimeStatus: "Статус Runtime",
    reasoningLevel: "Уровень reasoning",
    temperature: "Температура",
    contextWindow: "Контекстное окно",
    maxTokens: "Макс. токены",
    taskType: "Тип задачи",
    routeName: "Маршрут",
    preferredModel: "Предпочитаемая модель",
    priority: "Приоритет",
    privacyPolicy: "Политика privacy",
    costPolicy: "Политика cost",
    connectionStatus: "Подключение",
    privacyLevel: "Уровень privacy",
    modelsCount: "Модели",
    requiresApiKey: "Требуется API key",
    selectedModel: "Выбранная модель",
    requiresApproval: "Требуется одобрение Owner перед запуском",
    hasSensitiveData: "Sensitive data в контексте",
    requiresExternalTools: "Требуются внешние инструменты",
    noRoutesTitle: "Нет правил маршрутизации",
    noRoutesDescription: "Будет использована цепочка primary/fallback по умолчанию.",
    noSelectionTitle: "Модель не выбрана",
    noSelectionDescription: "Измените политики profile или контекст задачи — router не смог выбрать модель.",
    noFallbackChain: "Нет fallback chain — fallback при ошибке отключён или нет подходящих альтернатив.",
    stats: {
      totalProfiles: "Runtime profiles",
      activeProfiles: "Активные",
      providers: "Провайдеры",
      seedModels: "Начальные модели"
    },
    status: {
      active: "Активные",
      paused: "На паузе",
      draft: "Черновик"
    },
    reasoningLevels: {
      minimal: "Минимальный",
      standard: "Стандарт",
      deep: "Глубокий"
    },
    providerTypes: {
      local: "Локальный",
      cloud: "Облако",
      hybrid: "Гибридный"
    },
    connectionStatuses: {
      connected: "Подключено",
      disconnected: "Отключено",
      degraded: "Деградация",
      mock: "Mock (V1)"
    },
    privacyLevels: {
      "local-only": "Только локально",
      hybrid: "Гибридный",
      "cloud-ok": "Облако исправно"
    },
    capabilities: {
      streaming: "Потоковая передача",
      tools: "Инструменты",
      vision: "Видение",
      code: "Код"
    },
    policy: {
      localFirst: "Сначала локально",
      cloudAllowed: "Облако разрешено",
      sensitiveDataAllowed: "Конфиденциальные данные разрешены",
      requireApprovalForCloud: "Согласование для облака",
      maxCostPerRun: "Макс. стоимость за запуск",
      maxTokensPerRun: "Макс. токены за запуск"
    },
    taskTypes: {
      general: "Общее",
      planning: "Планирование",
      coding: "Разработка",
      review: "Проверка",
      analysis: "Анализ",
      conversation: "Беседа",
      embedding: "Эмбеддинг",
      vision: "Видение"
    }
  },
  runtimeProviders: {
    healthPanelTitle: "Runtime provider adapter",
    healthPanelDescription: "Слой execution adapter — orchestrator вызывает только active provider. Model Router по-прежнему выбирает catalog model metadata.",
    healthTitle: "Монитор runtime health",
    healthDescription: "Live Ollama health, загруженные модели, метрики execution и настройки provider.",
    currentProvider: "Active adapter",
    providerStatus: "Статус provider",
    lastCheck: "Последняя health check",
    refreshHealth: "Обновить health",
    checkingHealth: "Проверка…",
    switchProvider: "Переключить execution provider",
    latency: "Latency",
    executionDuration: "Длительность последнего execution",
    tokenEstimate: "Оценка токенов",
    ollamaSettings: "Настройки Ollama provider",
    ollamaUrl: "Ollama base URL",
    defaultModel: "Default model tag",
    saveSettings: "Сохранить настройки",
    loadedModels: "Загруженные модели на сервере",
    noLoadedModels: "Loaded models не сообщены — выполните health check или pull модели на сервере.",
    executionTitle: "Runtime execution",
    executionDescription: "Реальный prompt для {name} через active runtime provider.",
    modelSelector: "Ollama model",
    promptLabel: "Prompt",
    executePrompt: "Execute prompt",
    executing: "Executing…",
    realExecution: "Real execution",
    mockExecution: "Mock execution",
    mockExecutionNote: "Переключите active provider на Ollama для real HTTP execution.",
    fastTestMode: "Fast test mode",
    fastTestTag: "fast test",
    fastTestModeNote: "Fast test mode ограничивает output tokens и обрезает длинные prompts для qwen2.5-coder:7b и deepseek-r1:8b.",
    lightweightContext: "Lightweight context",
    lightweightContextNote: "First real Ollama run использует только employee profile и runtime profile — memory и knowledge пропускаются.",
    elapsedTime: "Elapsed",
    timeoutLimit: "Timeout limit: {seconds}s",
    cancelExecution: "Cancel execution",
    errors: {
      timeout: "Execution timed out",
      cancelled: "Execution cancelled"
    },
    logsTitle: "Runtime logs",
    logsEmpty: "Runtime logs пока пусты.",
    capabilities: {
      embeddings: "Эмбеддинги"
    },
    healthStatuses: {
      healthy: "Исправен",
      degraded: "Деградация",
      unavailable: "Unavailable",
      mock: "Mock",
      unknown: "Unknown"
    }
  },
  runtimeLive: {
    title: "Live Runtime Monitor",
    description: "Watch digital employee execution in real time — pipeline, logs, provider health, result preview, and downstream integrations.",
    launchTitle: "Launch execution",
    executionStream: "Live execution stream",
    executionStreamDescription: "Merged pipeline, provider logs, and timeline events for the active run.",
    contextAndPreview: "Runtime context + result preview",
    bottomPanel: "Logs / events / warnings",
    selectedEmployee: "Selected employee",
    currentStep: "Current step",
    elapsed: "Elapsed",
    timeout: "Timeout",
    liveBadge: "LIVE",
    streamEmpty: "Start a runtime run to populate the live stream.",
    noRunSelected: "No runtime run selected — launch Atlas or MAX execution above.",
    integrations: "Интеграции",
    runHistory: "Run history",
    reportLink: "Отчёт",
    employeeWorkspace: "Employee workspace",
    reportCreation: "Report creation",
    reportPending: "Report will be created after successful execution.",
    resultPreview: "Result preview",
    resultPending: "Waiting for model response…",
    recentRuns: "Недавние запуски",
    principleNote: "Live monitor reads local runtime runs, provider logs, and company events — no external telemetry in V1.",
    localOnly: "Polls localStorage every 500ms while a run is active.",
    tabs: {
      logs: "Logs",
      events: "Events",
      warnings: "Предупреждения"
    },
    eventsEmpty: "No timeline events for this run yet."
  },
  handoffEngine: {
    pageDescription: "Real work handoff protocol — digital employees prepare packages for Codex, Claude Code, Cursor, or humans. No external execution in V1.",
    openPhotoLab: "AI Photo Lab",
    createSample: "Create sample handoff",
    catalogTitle: "Handoff catalog",
    previewTitle: "Package preview",
    filtersTitle: "Filters",
    templatesTitle: "Handoff templates",
    projectPanelTitle: "External work handoffs",
    projectPanelDescription: "Prepared packages for Codex, Cursor, QA, DevOps, and human executors. Owner approves before send; results return to AI Company.",
    projectEmpty: "No handoffs for this project yet.",
    openAll: "All handoffs",
    openDetails: "Open details",
    selectHandoff: "Select a handoff to preview the package.",
    empty: "No handoffs yet — activate AI Photo Lab or create a sample handoff.",
    notFoundTitle: "Handoff not found",
    notFoundDescription: "This handoff is not in local storage.",
    backToHandoffs: "Back to handoffs",
    openProject: "Open project",
    openReport: "Открыть отчёт",
    relatedHandoffs: "Related handoffs",
    packageNotReady: "Package not built yet — prepare the handoff first.",
    noChecklist: "No checklist items.",
    principleNote: "Handoff rule: digital employees prepare work, Owner approves, external executor completes, result returns to AI Company with report and timeline updates.",
    localOnly: "Stored in localStorage (ai-company-handoffs) — mock protocol only, no Codex/Cursor API.",
    stats: {
      total: "Total handoffs",
      ready: "Ready",
      inProgress: "Sent / in progress",
      accepted: "Accepted"
    },
    sections: {
      context: "Контекст",
      instructions: "Instructions",
      checklist: "Checklist",
      package: "Handoff package",
      result: "Returned result"
    },
    package: {
      projectContext: "Project context",
      taskContext: "Task context",
      currentState: "Current state",
      files: "Files / paths",
      constraints: "Constraints",
      commands: "Commands",
      acceptanceCriteria: "Acceptance criteria",
      expectedResponseFormat: "Expected response format"
    },
    fields: {
      target: "Цель",
      status: "Статус",
      project: "Project",
      workspace: "Рабочее пространство",
      task: "Задача",
      preparedBy: "Prepared by",
      paths: "Related paths",
      expectedResult: "Expected result",
      deliveredAt: "Delivered at",
      responseFormat: "Response format",
      artifacts: "Артефакты",
      blockers: "Blockers"
    },
    actions: {
      prepare: "Build package",
      requestApproval: "Request Owner approval",
      send: "Send handoff (mock)",
      markInProgress: "Mark in progress",
      mockReturn: "Mock external return",
      accept: "Accept result",
      reject: "Reject result",
      cancel: "Cancel handoff"
    },
    targets: {
      codex: "Codex",
      claude_code: "Claude Code",
      cursor: "Cursor",
      human_developer: "Human Developer",
      devops: "DevOps",
      designer: "Designer",
      qa: "QA"
    },
    statuses: {
      draft: "Черновик",
      ready: "Ready",
      sent: "Sent",
      in_progress: "In Progress",
      returned: "Returned",
      accepted: "Accepted",
      rejected: "Отклонено",
      cancelled: "Отменено"
    }
  },
  runtimeOrchestrator: {
    pageDescription: "Single entry point для execution digital employee — coordinates domains, routes models, emits events. Mock-only в V1.",
    runPageTitle: "Runtime Run",
    notFoundTitle: "Runtime run не найден",
    notFoundDescription: "Этот run отсутствует в local storage.",
    backToRuntime: "Назад к Runtime",
    runsCatalog: "Недавние запуски",
    startRun: "Запустить runtime run",
    startRunFromTask: "Запуск через Orchestrator",
    startRunFromChat: "Запуск через Orchestrator",
    grantApprovalMock: "Предоставить согласование (mock)",
    waitingApprovalNote: "Run paused at approval gate — mock Owner approval required before completion.",
    principleNote: "Orchestrator rule: Runtime никогда не вызывает LLM напрямую — always through Model Router. Runtime reads context only; never mutates Employee or Memory.",
    localOnly: "Stored in localStorage (ai-company-runtime-runs) — mock pipeline, no Ollama or provider calls.",
    state: "Состояние",
    employee: "Сотрудник",
    model: "Модель",
    provider: "Провайдер",
    report: "Отчёт",
    startedAt: "Начало",
    finishedAt: "Окончание",
    runSummary: "Сводка запуска",
    resultTitle: "Результат Runtime",
    pipelineTitle: "Pipeline Orchestrator",
    contextTitle: "Runtime context",
    contextBuiltAt: "Собрано в",
    contextSize: "Слои контекста загружены",
    knowledgeUsed: "Элементы knowledge",
    memoryUsed: "Записи memory",
    estimatedTokens: "Оценочное число токенов",
    estimatedCost: "Оценочная стоимость",
    responseText: "Ответ модели",
    executionDurationMs: "Длительность execution",
    promptTokens: "Prompt tokens",
    completionTokens: "Completion tokens",
    noResultYet: "Результата пока нет — run может ждать approval или завершиться рано.",
    noArtifacts: "Artifacts не созданы.",
    noWarnings: "Нет предупреждений.",
    openReport: "Открыть отчёт",
    notLoaded: "Не загружено",
    stats: {
      totalRuns: "Всего запусков",
      completed: "Завершено",
      waitingApproval: "Ожидание согласования",
      failed: "Ошибка"
    },
    states: {
      queued: "В очереди",
      preparing_context: "Подготовка context",
      waiting_approval: "Ожидание согласования",
      running: "Выполняется",
      completed: "Завершено",
      cancelled: "Отменено",
      failed: "Ошибка"
    },
    pipelineStatus: {
      pending: "Ожидание",
      active: "Активные",
      done: "Готово",
      skipped: "Пропущено",
      failed: "Ошибка"
    },
    pipelineSteps: {
      receive_request: "Получить запрос",
      load_employee: "Загрузить employee",
      load_workspace: "Загрузить workspace",
      load_memory: "Загрузить memory",
      load_knowledge: "Загрузить knowledge",
      load_competencies: "Загрузить competencies",
      load_runtime_profile: "Загрузить runtime profile",
      run_model_router: "Run Model Router",
      approval_check: "Проверка approval",
      tool_gateway: "Шлюз инструментов",
      create_run: "Создать run",
      emit_event: "Отправить событие",
      create_report: "Создать report",
      complete: "Завершить"
    },
    contextLayers: {
      employee_profile: "Профиль сотрудника",
      memory: "Память",
      knowledge: "База знаний",
      competencies: "Компетенции",
      workspace: "Рабочее пространство",
      permissions: "Разрешения",
      tools: "Инструменты",
      conversation: "Беседа",
      current_task: "Текущая задача",
      runtime_profile: "Runtime profile"
    }
  },
  memoryEngine: {
    title: "Employee Memory",
    pageTitle: "{name} — Memory",
    pageDescription: "Persistent memory, принадлежащая Employee — independent of Claude, Qwen или any runtime model.",
    backToProfile: "Назад к профилю",
    openMemory: "Open Memory",
    viewTimeline: "Открыть полную хронологию",
    localOnly: "Хранится в localStorage — без vector DB и подключённого Runtime.",
    futureBadge: "Будущее",
    notFoundTitle: "Employee не найден",
    notFoundDescription: "Не удалось загрузить memory — сотрудник отсутствует в roster.",
    timelineTitle: "Хронология memory",
    searchLabel: "Поиск",
    searchPlaceholder: "Поиск по title, summary, tags…",
    searchHint: "V1: только text match — semantic search в future.",
    emptyTitle: "Нет подходящих memories",
    emptyDescription: "Измените фильтры или добавьте новую запись memory.",
    addTitle: "Добавить memory",
    addTitlePlaceholder: "Название memory",
    addSummaryLabel: "Сводка",
    addSummaryPlaceholder: "Краткое summary, хранящееся с записью",
    addButton: "Сохранить memory",
    summary: {
      title: "Memory Architecture",
      lead: "Memory принадлежит identity Employee — never to the LLM model or provider.",
      modelIndependent: "Смена primaryModel с Claude на Qwen не переносит и не стирает этот memory store."
    },
    stats: {
      total: "Всего записей",
      recentWeek: "Обновлено на этой неделе",
      withWorkspace: "Workspace-linked",
      critical: "Критический"
    },
    filters: {
      type: "Тип",
      importance: "Важность",
      tag: "Тег"
    },
    types: {
      conversation: "Беседа",
      decision: "Решение",
      knowledge: "База знаний",
      experience: "Опыт",
      report: "Отчёт",
      document: "Документ",
      relationship: "Связь",
      task: "Задача",
      workspace: "Рабочее пространство"
    },
    importance: {
      low: "Низкий",
      normal: "Обычный",
      high: "Высокий",
      critical: "Критический"
    },
    retention: {
      session: "Сессия",
      short: "Краткосрочная",
      long: "Долгосрочная",
      permanent: "Постоянная"
    },
    sources: {
      conversation: "Беседа",
      discussion: "Обсуждение",
      task: "Задача",
      workspace: "Рабочее пространство",
      manual: "Вручную",
      system: "Система",
      document: "Документ",
      run: "Запуск"
    },
    future: {
      semanticSearch: "Семантический поиск",
      embeddings: "Эмбеддинги",
      vectorDb: "Vector DB",
      summaries: "Автосводки",
      llmContextBuilder: "LLM Context Builder"
    },
    futureDesc: {
      semanticSearch: "Natural-language retrieval по записям memory.",
      embeddings: "Vector embeddings per entry для similarity ranking.",
      vectorDb: "External vector store — memory остаётся Employee-scoped.",
      summaries: "Periodic condensation timeline в executive summaries.",
      llmContextBuilder: "Runtime assembles model-agnostic context windows из этого store."
    }
  },
  competencyEngine: {
    title: "Компетенции",
    pageTitle: "{name} — Competencies",
    pageDescription: "Навыки, опыт, сертификаты и репутация за всю карьеру — принадлежат Employee, не хранятся в модели сотрудника.",
    backToProfile: "Назад к профилю",
    openCompetencies: "Открыть Competencies",
    localOnly: "Хранится в localStorage — reputation считается локально, Runtime не подключён.",
    notFoundTitle: "Employee не найден",
    notFoundDescription: "Не удалось загрузить competencies — сотрудник отсутствует в roster.",
    overview: {
      title: "Обзор компетенций",
      lead: "Цифровая квалификация развивается через experience, knowledge, training и выполненную работу — не через LLM context.",
      notInModel: "Competencies не являются полями модели Employee. Они живут в competency engine и накапливаются за карьеру сотрудника."
    },
    sections: {
      competencies: "Домены компетенций",
      skills: "Навыки",
      experience: "Опыт",
      certificates: "Сертификаты",
      reputation: "Reputation",
      learning: "Learning Path"
    },
    stats: {
      skills: "Навыки",
      verified: "проверено",
      certificates: "Сертификаты",
      experience: "События опыта",
      domains: "Домены",
      trustScore: "Trust score",
      averageCompetency: "Средняя компетенция"
    },
    meta: {
      workspacePrefix: "WS",
      taskPrefix: "Задача",
      reportPrefix: "Отчёт"
    },
    fields: {
      skill: "Навык",
      category: "Категория",
      level: "Уровень",
      verified: "Проверено",
      issuer: "Инициатор",
      completedAt: "Завершено",
      impact: "Влияние",
      type: "Тип",
      description: "Описание"
    },
    reputation: {
      accuracy: "Точность",
      successfulTasks: "Успешные задачи",
      reportsQuality: "Качество reports",
      reviews: "Проверки",
      trustScore: "Trust score",
      productionApprovals: "Согласования продакшена",
      calculatedBySystem: "Reputation рассчитывается системой из experience — never stored inside the LLM.",
      updated: "Рассчитано"
    },
    learning: {
      completed: "Завершённые навыки",
      planned: "Запланированные навыки",
      recommended: "Рекомендуемые навыки"
    },
    experienceTypes: {
      task: "Задача",
      report: "Отчёт",
      workspace: "Рабочее пространство",
      training: "Обучение",
      review: "Проверка",
      certification: "Сертификация"
    },
    impact: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий"
    },
    certificationStatus: {
      planned: "Планируемые",
      in_progress: "В процессе",
      completed: "Завершено",
      expired: "Истекло"
    },
    empty: {
      skills: "Навыки пока не записаны.",
      experience: "Событий опыта пока нет.",
      certificates: "Сертификатов пока нет.",
      competencies: "Домены компетенций появятся после записи навыков и опыта.",
      learningCompleted: "Пока ничего не завершено.",
      learningPlanned: "Пока ничего не запланировано.",
      learningRecommended: "Рекомендаций пока нет."
    },
    addExperienceTitle: "Записать Experience",
    addExperiencePlaceholder: "Опишите, что сделал сотрудник и какой результат…",
    addExperienceButton: "Добавить событие опыта",
    future: {
      runtimeMatching: "Runtime будет использовать trustScore и domain scores при выборе task assignees."
    }
  },
  learningEngine: {
    title: "Learning",
    pageTitle: "{name} — Learning",
    pageDescription: "Continuous competency growth — goals, sessions, recommendations, and skill progression over time.",
    backToProfile: "Назад к профилю",
    openLearning: "Open Learning",
    openCompetencies: "Открыть Competencies",
    teamLearning: "Team Learning",
    localOnly: "Stored in localStorage — learning progress syncs with competency experience events.",
    notFoundTitle: "Employee не найден",
    notFoundDescription: "Cannot load learning profile — employee does not exist in roster.",
    itemCount: "элементов",
    dashboard: {
      title: "{name} — Learning Dashboard",
      lead: "Employees evolve through study, runtime work, and guided recommendations — not static skill lists.",
      notInModel: "Learning state lives in the learning engine and feeds back into competencies and reputation."
    },
    preview: {
      title: "Learning Preview",
      lead: "Active goals and automatic suggestions for continuous improvement."
    },
    sections: {
      recommendations: "Suggested Learning",
      goals: "Learning Goals",
      progress: "Skill Progress",
      growthChart: "Skill Growth",
      timeline: "Learning Timeline"
    },
    stats: {
      experience: "Experience points",
      activeGoals: "Active goals",
      completedSessions: "Completed sessions",
      averageProgress: "Avg skill progress",
      suggestions: "Suggestions",
      certificates: "Сертификаты",
      totalSessions: "Total sessions",
      skillsTracked: "Skills tracked"
    },
    fields: {
      current: "Current",
      target: "Цель",
      due: "Due"
    },
    priority: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий"
    },
    recommendationKinds: {
      project: "Project",
      knowledge: "База знаний",
      report: "Отчёт",
      runtime: "Runtime",
      certification: "Сертификация",
      study: "Study"
    },
    sessionTypes: {
      study: "Study",
      practice: "Practice",
      review: "Проверка",
      certification: "Сертификация",
      runtime: "Runtime"
    },
    sessionStatus: {
      planned: "Планируемые",
      in_progress: "В процессе",
      completed: "Завершено",
      skipped: "Пропущено"
    },
    actions: {
      open: "Открыть",
      startLearning: "Start learning",
      dismiss: "Dismiss",
      startSession: "Start session",
      completeSession: "Complete session",
      viewReport: "View report",
      refreshSuggestions: "Refresh suggestions"
    },
    meta: {
      project: "Project"
    },
    empty: {
      recommendations: "No learning suggestions — complete a session or refresh suggestions.",
      goals: "No active learning goals.",
      progress: "No progress data yet.",
      skills: "No skill progress tracked yet.",
      growthChart: "Skill growth history will appear after learning sessions.",
      sessions: "No learning sessions recorded yet."
    }
  },
  collaborationEngine: {
    title: "Collaboration",
    pageDescription: "Multi-agent collaboration — digital employees discuss work, propose decisions, and reach consensus without Owner intervention.",
    backToList: "Back to Collaboration",
    catalogTitle: "Collaboration Sessions",
    sessionCount: "sessions",
    searchLabel: "Поиск",
    searchPlaceholder: "Search sessions, goals, participants…",
    observerNote: "Owner can observe this discussion — employees coordinate autonomously.",
    localOnly: "Stored in localStorage — mock multi-agent thread in V1; future Runtime will emit real LLM messages.",
    futureNote: "Future: Runtime messages and real LLM collaboration between digital employees.",
    timelinePreview: "Recent Collaborations",
    openProjectCollaborations: "Project Collaborations",
    participants: "Участники",
    messages: "Сообщения",
    approvals: "approvals",
    votes: "votes",
    finalDecision: "Final Decision",
    viewConsensus: "View consensus",
    inReplyTo: "In reply to",
    sections: {
      timeline: "Session Timeline",
      conversation: "Agent Conversation",
      decisions: "Intermediate Decisions",
      consensus: "Final Consensus",
      graph: "Discussion Graph",
      artifacts: "Артефакты",
      participants: "Участники"
    },
    stats: {
      total: "Total sessions",
      active: "Активные",
      consensus: "At consensus",
      participants: "Unique agents"
    },
    filters: {
      status: "Статус"
    },
    status: {
      started: "Начало",
      discussing: "Discussing",
      research: "Исследование",
      review: "Проверка",
      consensus: "Consensus",
      completed: "Завершено"
    },
    messageKinds: {
      question: "Question",
      answer: "Answer",
      comment: "Комментарий",
      issue: "Issue",
      suggestion: "Suggestion",
      consensus: "Consensus"
    },
    decisionStatus: {
      proposed: "Proposed",
      accepted: "Accepted",
      rejected: "Отклонено",
      superseded: "Superseded",
      final: "Final"
    },
    vote: {
      approve: "Одобрить",
      reject: "Отклонить",
      abstain: "Abstain"
    },
    artifactKinds: {
      report: "Отчёт",
      knowledge: "База знаний",
      runtime: "Runtime",
      project: "Project",
      decision: "Решение"
    },
    empty: {
      sessions: "No collaboration sessions match the current filters.",
      messages: "No agent messages recorded yet.",
      decisions: "No intermediate decisions yet.",
      consensus: "Consensus has not been reached yet.",
      graph: "Reply edges will appear once agents respond to each other.",
      artifacts: "No linked artifacts yet."
    }
  },
  sprintEngine: {
    title: "Sprint Planning",
    pageDescription: "Sprint 1 for AI Photo Lab — goal, capacity, commitment, backlog, and board ready for the digital team to start Monday.",
    openSprint: "Open Sprint 1",
    openControlRoom: "Control Room",
    openProject: "Open Project",
    openExecution: "Execution Queue",
    openRuntime: "Runtime",
    start: "Start",
    end: "End",
    workingDays: "working days",
    commitment: "Commitment",
    committed: "committed",
    capacityTotal: "Ёмкость",
    capacityRemaining: "Remaining capacity",
    definitionOfReady: "Definition of Ready",
    definitionOfDone: "Definition of Done",
    reviewNotes: "Sprint notes",
    plannedSprints: "planned",
    tasks: "tasks",
    remaining: "Remaining (burndown)",
    ideal: "Ideal",
    burndownNote: "Mock burndown — story points remaining vs ideal line for Sprint 1.",
    dayProgress: "Day {elapsed} of {total} (starts Monday)",
    localNote: "Planning only — no task execution. Sprint data in localStorage; tasks synced from delivery backlog.",
    notFoundTitle: "Sprint not found",
    notFoundDescription: "Activate AI Photo Lab and reload to seed Sprint 1.",
    status: {
      planned: "Планируемые",
      active: "Активные",
      review: "Проверка",
      completed: "Завершено",
      cancelled: "Отменено"
    },
    health: {
      on_track: "On track",
      at_risk: "At risk",
      blocked: "Blocked"
    },
    columns: {
      ready: "Ready",
      in_sprint: "In Sprint",
      review: "Проверка",
      done: "Готово",
      blocked: "Blocked"
    },
    metrics: {
      completed: "Завершено",
      remaining: "Remaining",
      blocked: "Blocked",
      progress: "Progress",
      velocity: "Velocity (mock)",
      health: "Sprint health"
    },
    sections: {
      goal: "Sprint Goal",
      progress: "Sprint Progress",
      capacity: "Capacity & Commitment",
      backlog: "Sprint Backlog",
      board: "Sprint Board",
      burndown: "Burndown",
      review: "DoR / DoD / Review",
      links: "Quick Links"
    }
  },
  workdayEngine: {
    title: "Рабочий день цифрового сотрудника",
    pageDescription: "Движок рабочего дня компании — старт в 08:00, agenda, уведомления, согласования, знания, задачи, отчёты, review и завершение дня.",
    flowTitle: "Стандартный flow рабочего дня",
    flowNote: "08:00 → Agenda → Уведомления → Согласования → Знания → Задачи → Отчёты → Review → Завершение дня",
    localOnly: "Mock workday engine — только localStorage, синхронизация с Presence, Workspace и Timeline.",
    states: {
      starting: "Начало работы",
      planning: "Планирование",
      working: "Работает",
      waiting: "Ожидание",
      reviewing: "На проверке",
      completed: "Завершено",
      finished: "Окончание"
    },
    phases: {
      day_start: "08:00",
      agenda: "Agenda",
      check_notifications: "Уведомления",
      check_approvals: "Согласования",
      read_knowledge: "База знаний",
      execute_tasks: "Задачи",
      create_reports: "Отчёты",
      review: "Проверка",
      finish_day: "Завершение дня"
    },
    dashboard: {
      started: "Начали работу",
      idle: "Простой",
      blocked: "Заблокированы",
      finished: "Завершили день",
      notStarted: "Ещё не начали",
      noStarted: "Никто активно не работает.",
      noIdle: "Нет сотрудников в простое.",
      noBlocked: "Нет заблокированных сотрудников.",
      noFinished: "Никто ещё не завершил день.",
      noNotStarted: "Все начали рабочий день."
    },
    summary: {
      title: "Daily Summary",
      scheduledStart: "Плановый старт",
      started: "Начало",
      idle: "Простой",
      blocked: "Заблокированы",
      finished: "Окончание",
      notStarted: "Не начали",
      avgPhase: "Средняя фаза",
      reportsToday: "Отчётов сегодня",
      tasksInProgress: "Задач в работе"
    },
    actions: {
      startDay: "Начать день",
      nextPhase: "Следующая фаза",
      finishDay: "Завершить день",
      openWorkspace: "Рабочее пространство",
      sync: "Синхронизировать",
      openWorkday: "Workday"
    },
    workspace: {
      title: "Рабочий день сегодня",
      noWorkday: "Рабочий день ещё не начат.",
      openDashboard: "Дашборд рабочего дня компании"
    }
  },
  photoLabControlRoom: {
    title: "AI Photo Lab Control Room",
    pageDescription: "Delivery control room — manage MVP readiness, digital team workload, Codex handoff, and Owner decisions from one screen.",
    openControlRoom: "Open Control Room",
    openKickoff: "Monday Kickoff",
    openProject: "Open Project",
    openCanvas: "Open Canvas",
    openExecution: "Execution Queue",
    openRuntime: "Runtime",
    openReports: "Отчёты",
    openApprovals: "Согласования",
    deadline: "Deadline",
    progress: "Progress",
    health: "Health",
    riskLevel: "Risk level",
    mvpReady: "MVP readiness",
    tasksDone: "готово",
    tasksActive: "активен",
    demoReady: "demo checks ready",
    noCurrentTask: "No active task",
    ownerDecisions: "Required Owner decisions",
    pendingApprovals: "Pending approvals",
    reviewDecision: "Проверка",
    codexNote: "Tasks routed to Codex per Owner directive — digital employees audit and plan; Codex implements in ~/projects/ai-photo-lab.",
    localNote: "Mock delivery data — localStorage only, no production or Ollama calls.",
    notFoundTitle: "Control room unavailable",
    notFoundDescription: "Activate AI Photo Lab in projects to seed delivery data.",
    healthLevels: {
      on_track: "On track",
      at_risk: "At risk",
      critical: "Критический"
    },
    riskLevels: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      critical: "Критический"
    },
    stats: {
      tasks: "Delivery tasks",
      inProgress: "В процессе",
      demoReady: "Demo checks",
      decisions: "Owner decisions",
      codex: "Codex handoffs"
    },
    sections: {
      mvpStatus: "MVP Status",
      deliveryProgress: "Delivery Progress",
      digitalTeam: "Digital Team",
      workNow: "Work Now",
      deliveryTasks: "Delivery Tasks (13)",
      runtimeActivity: "Runtime Activity",
      codexHandoff: "Codex Handoff",
      demoReadiness: "Demo Readiness",
      reports: "Отчёты",
      risks: "Risks & Blockers",
      decisions: "Decisions",
      quickLinks: "Quick Links"
    },
    workNow: {
      currentlyWorking: "Currently working",
      waitingApproval: "Ожидание согласования",
      blocked: "Blocked",
      doneToday: "Done today"
    },
    codexCategories: {
      complex_code: "Complex code changes",
      bug_fix: "Bug fixes",
      production_deploy: "Production deployment",
      pdf_report: "PDF / report engine",
      ollama_integration: "Ollama integration",
      ui_implementation: "UI implementation"
    },
    demoItems: {
      local_run: "Local run",
      production_health: "Production health",
      photo_upload: "Photo upload",
      ai_analysis: "AI analysis",
      visual_zones: "Visual zones",
      manual_zone_edit: "Manual zone edit",
      inspection_chat: "Inspection chat",
      report_history: "Report / history",
      mobile_view: "Mobile view",
      deployment_checklist: "Deployment checklist"
    },
    empty: {
      working: "No tasks in active execution.",
      waiting: "Nothing waiting for approval.",
      blocked: "No blockers.",
      doneToday: "No completions today yet.",
      runtime: "No runtime runs for this project.",
      decisions: "No Owner decisions pending.",
      reports: "No draft reports yet.",
      risks: "No risks recorded."
    }
  },
  employeeWorkspace: {
    pageTitle: "{name} — Workspace",
    pageDescription: "Personal desktop for a digital employee — current work, agenda, knowledge, handoffs, runtime, and activity in one place.",
    openWorkspace: "Рабочее пространство",
    openProfile: "Open profile",
    openRuntime: "Open Runtime",
    openExecution: "Execution queue",
    openKnowledge: "Open knowledge",
    openReports: "Open reports",
    openChat: "Open chat",
    openNotifications: "All notifications",
    openApprovals: "All approvals",
    overviewSummary: "This desktop aggregates tasks, runtime, handoffs, knowledge, reports, chats, and decisions scoped to this employee.",
    noCurrentFocus: "No active focus",
    noMessages: "Сообщений пока нет",
    unreadCount: "{count} unread notifications",
    notFoundTitle: "Employee workspace not found",
    notFoundDescription: "This employee does not exist or cannot load a workspace snapshot.",
    principleNote: "Workspace rule: one page for who I am, what I work on, what waits for my decision, and where to jump next — no Runtime execution from this view.",
    localOnly: "Aggregated locally from tasks, executions, runtime runs, handoffs, knowledge, reports, chats, and events.",
    sections: {
      overview: "Who I am",
      today: "Today",
      currentTasks: "Current tasks",
      currentRun: "Runtime",
      knowledge: "Assigned knowledge",
      reports: "Recent reports",
      chats: "Recent chats",
      notifications: "Notifications",
      approvals: "Waiting for decision",
      pendingHandoffs: "Pending handoffs",
      activity: "My activity",
      recentExecutions: "Recent executions",
      recentRuns: "Недавние запуски"
    },
    fields: {
      primaryModel: "Основная модель",
      currentFocus: "Current focus",
      openTasks: "Open tasks",
      pendingDecisions: "Pending decisions",
      workingOn: "Working on"
    },
    agenda: {
      approval: "Согласование",
      handoff: "Handoff"
    },
    actions: {
      startWork: "Start Work",
      openTask: "Open Task",
      openRuntime: "Open Runtime",
      openKnowledge: "Open Knowledge",
      openChat: "Open Chat",
      createReport: "Создать отчёт"
    },
    empty: {
      today: "Nothing scheduled for today yet.",
      tasks: "No open delivery tasks assigned.",
      currentRun: "No active runtime run.",
      knowledge: "No knowledge assignments yet.",
      reports: "No reports created by this employee yet.",
      chats: "No chats with this employee yet.",
      notifications: "No notifications for this employee.",
      approvals: "No pending approvals."
    }
  },
  employeeProfile: {
    title: "Профиль сотрудника",
    backToEmployees: "Назад к сотрудникам",
    navLabel: "Секции профиля",
    created: "Создано",
    comingSoon: "Скоро — runtime не подключён",
    futureBadge: "Будущее",
    yes: "Да",
    no: "Нет",
    notFoundTitle: "Employee не найден",
    notFoundDescription: "Этот сотрудник отсутствует в local storage или был удалён.",
    noDescription: "Mission description не указано.",
    noSystemPrompt: "System prompt не настроен.",
    noWorkflow: "Workflow не определён.",
    noRestrictions: "Restrictions не настроены.",
    noSkills: "Навыки не назначены",
    noSkillsHint: "Добавляйте навыки при создании или редактировании сотрудника.",
    noMemoryScope: "Memory scope не настроен",
    noMemoryScopeHint: "Memory domains появятся здесь после назначения.",
    sections: {
      overview: "Обзор",
      skills: "Навыки",
      permissions: "Разрешения",
      memory: "Память",
      knowledge: "База знаний",
      relationships: "Связи",
      assignments: "Назначения",
      activity: "Активность",
      runtime: "Runtime",
      presence: "Presence",
      learning: "Learning"
    },
    assignments: {
      emptyTitle: "Нет workspace assignments",
      emptyDescription: "Employee не назначен ни на один workspace. Назначьте со страницы Workspace."
    },
    future: {
      conversation: "Беседа",
      conversationDesc: "Direct chat thread с этим цифровым сотрудником.",
      discussion: "Обсуждение",
      discussionDesc: "Multi-party threads с участием этого employee.",
      runHistory: "История запусков",
      runHistoryDesc: "Прошлые выполнения, результаты и runtime traces.",
      workspaceAssignments: "Назначения на рабочие пространства",
      workspaceAssignmentsDesc: "Projects, squads и workspaces, связанные с этим employee.",
      memoryTimeline: "Хронология memory",
      memoryTimelineDesc: "Хронологические чтения, записи memory и обновления context.",
      relationships: "Связи",
      relationshipsDesc: "Peers, managers, collaborators и reporting lines.",
      activityFeed: "Лента активности",
      activityFeedDesc: "Недавние действия, task transitions и operational events."
    }
  },
  livingCompany: {
    now: 'сейчас',
    since: '{time} назад',
    doingNow: 'Сейчас делает',
    fallback: 'Работает над {context}',
    phases: {
      working: 'В работе',
      thinking: 'Думает',
      waiting: 'Ожидает',
      reviewing: 'На ревью',
      completed: 'Завершено',
      idle: 'Свободен',
    },
    verbs: {
      atlas: {
        architecture: 'Анализирует архитектуру…',
        task: 'Анализирует {task}…',
      },
      max: {
        upload: 'Проверяет upload flow…',
        task: 'Аудит {task}…',
      },
      qa: {
        regression: 'Выполняет регрессионное тестирование…',
        task: 'Тестирует {task}…',
      },
      devops: {
        environment: 'Проверяет окружение…',
        task: 'Проверяет {task}…',
      },
      default: {
        task: 'Работает над {task}…',
      },
    },
    pipeline: {
      receive_request: 'Принимает запрос…',
      load_employee: 'Загружает профиль сотрудника…',
      load_workspace: 'Загружает workspace…',
      load_memory: 'Читает память…',
      load_knowledge: 'Загружает knowledge…',
      load_competencies: 'Загружает компетенции…',
      load_runtime_profile: 'Загружает runtime profile…',
      run_model_router: 'Маршрутизирует вызов модели…',
      approval_check: 'Ожидает одобрение Owner…',
      tool_gateway: 'Выполняет tools…',
      create_run: 'Создаёт запись run…',
      emit_event: 'Отправляет event…',
      create_report: 'Готовит отчёт…',
      complete: 'Завершает…',
    },
    taskResult: {
      working: 'Готовит результат',
      ready_for_review: 'Готов к вашему ревью',
      reviewing: 'Запрошены правки — доработка',
      completed: 'Одобрено и завершено',
      waiting: 'Ожидает ревью Owner',
      idle: 'В архиве',
    },
    recentActivity: 'Недавняя активность',
    noRecentActivity: 'Нет недавней активности',
  },
  mock: {
    lastActivity: "Ожидание активации V1",
    relativeTime: {
      now: "сейчас",
      minutesAgo: "{minutes} мин назад"
    },
    squads: {
      orchestrator: "Orchestrator",
      memoryStore: "Memory store",
      toolGateway: "Tool gateway",
      coreEngineering: "Core Engineering",
      executive: "Executive",
      operations: "Operations"
    }
  }
}
