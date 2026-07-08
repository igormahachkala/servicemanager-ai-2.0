import type { Messages } from './en'
import { platformGlossaryTermsRu } from './platformGlossaryTerms.ru'
import { ownerNavRu } from './ownerNav/ru'

export const ru: Messages = {
  common: {
    empty: "—",
    all: "Все",
    notAvailable: "н/д",
    selected: "Выбрано"
  },
  contextEmpty: {
    sections: {
      whyEmpty: "Почему пусто",
      whatToDo: "Что сделать",
      example: "Пример результата"
    },
    taskResults: {
      initial: {
        title: "Нет результатов",
        reason: "Вы ещё не запускали сотрудников через Run Task.",
        actionHint: "Откройте Run Task, выберите сотрудника (например MAX) и поручите первую задачу.",
        actionLabel: "Запустить задачу",
        example: "MAX аудирует AI Photo Lab MVP → черновик отчёта здесь → вы одобряете или просите правки."
      },
      filtered: {
        title: "Нет результатов по фильтрам",
        reason: "Поиск или фильтр статуса скрывают все результаты в очереди.",
        actionHint: "Сбросьте фильтры или расширьте статус, чтобы увидеть полную очередь.",
        actionLabel: "Запустить задачу",
        example: "После сброса фильтров видны draft и ready-for-review из недавних runs."
      }
    },
    memory: {
      initial: {
        title: "Память пуста",
        reason: "У сотрудника нет сохранённых записей — ни из runs, ни вручную.",
        actionHint: "Запустите задачу с этим сотрудником или добавьте запись памяти ниже.",
        actionLabel: "Запустить задачу",
        example: "После runtime run Memory Evolution добавит урок: «upload flow нужен retry»."
      },
      filtered: {
        title: "Нет записей по фильтрам",
        reason: "Фильтры типа, важности или тега исключают все записи памяти.",
        actionHint: "Сбросьте фильтры или добавьте новую запись для этого сотрудника.",
        actionLabel: "Запустить задачу",
        example: "Пример: Decision — «Owner одобрил MVP scope без mobile chat»."
      }
    },
    knowledge: {
      initial: {
        title: "Каталог знаний пуст",
        reason: "В текущем scope нет knowledge items — база не заполнена.",
        actionHint: "Запустите задачу с документами или откройте Collections для curated paths.",
        actionLabel: "Запустить задачу",
        example: "Atlas читает ADR-001 → item в каталоге → Runtime подтягивает его в следующем run."
      },
      filtered: {
        title: "Нет items по фильтрам",
        reason: "Поиск, тип или тег скрывают все knowledge items.",
        actionHint: "Сбросьте фильтры или откройте Collections.",
        actionLabel: "Collections",
        example: "Коллекция Platform Architecture — ADR и стандарты для сотрудников."
      }
    },
    timeline: {
      initial: {
        title: "Timeline пуст",
        reason: "События компании ещё не записаны — runs, approvals и handoffs пишут events сюда.",
        actionHint: "Запустите Runtime run или одобрите task result, чтобы наполнить timeline.",
        actionLabel: "Запустить задачу",
        example: "runtime.completed → task_result.approved → handoff.created с датами."
      },
      filtered: {
        title: "Нет events по фильтрам",
        reason: "Фильтры employee, workspace или типа исключают все события.",
        actionHint: "Сбросьте scope, чтобы увидеть глобальный company timeline.",
        actionLabel: "Запустить задачу",
        example: "Фильтр по MAX — только runs и approvals этого сотрудника."
      }
    },
    reports: {
      initial: {
        title: "Отчётов пока нет",
        reason: "Каждый завершённый Runtime run создаёт draft report — их ещё нет.",
        actionHint: "Run Task с любым сотрудником — orchestrator создаст отчёт Senior Engineer.",
        actionLabel: "Запустить задачу",
        example: "Аудит MAX → отчёт с рисками (Критический/Высокий) и секцией «Требуется решение Owner»."
      },
      filtered: {
        title: "Нет reports по фильтрам",
        reason: "Фильтры типа или статуса скрывают все отчёты в каталоге.",
        actionHint: "Поставьте All или запустите новую задачу для свежего draft.",
        actionLabel: "Запустить задачу",
        example: "Draft system reports появляются после первого успешного runtime run."
      }
    },
    runtime: {
      initial: {
        title: "Run History пуст",
        reason: "Ни один сотрудник ещё не выполнялся через orchestrator.",
        actionHint: "Run Task → выберите сотрудника и модель → первый execution.",
        actionLabel: "Запустить задачу",
        example: "Run завершён → запись в History → linked report и task result для Owner."
      },
      filtered: {
        title: "Нет runs по фильтрам",
        reason: "Статус, employee или workspace скрывают все записи.",
        actionHint: "Сбросьте фильтры или запустите новый run из Run Task.",
        actionLabel: "Запустить задачу",
        example: "Фильтр completed — успешные runs с model и context metadata."
      }
    },
    workspace: {
      initial: {
        title: "Рабочих пространств пока нет",
        reason: "Workspace группирует проекты, assignments и контекст — вы ещё не создали ни одного.",
        actionHint: "Создайте workspace, затем назначьте сотрудников через Assignment (не ownership).",
        actionLabel: "Новое рабочее пространство",
        example: "Engineering workspace → MAX + Atlas → Run Task в scope workspace."
      },
      filtered: {
        title: "Нет подходящих workspace",
        reason: "В этом представлении нечего показать.",
        actionHint: "Создайте workspace для delivery-контекста команды.",
        actionLabel: "Новое рабочее пространство",
        example: "Product workspace для AI Photo Lab с project и assignments."
      }
    },
    canvas: {
      initial: {
        title: "Выберите узел на графе",
        reason: "Canvas показывает employees, tasks, runs и approvals — ничего не выбрано.",
        actionHint: "Кликните узел на canvas или запустите задачу для live-активности.",
        actionLabel: "Запустить задачу",
        example: "Клик MAX → inbound tasks, recent runs, переход в Runtime profile."
      },
      filtered: {
        title: "Выберите узел на графе",
        reason: "Canvas показывает employees, tasks, runs и approvals — ничего не выбрано.",
        actionHint: "Кликните узел или запустите задачу для наполнения графа.",
        actionLabel: "Запустить задачу",
        example: "Project focus — squad AI Photo Lab, tasks и waiting approvals."
      }
    },
    approvals: {
      initial: {
        title: "Очередь approvals пуста",
        reason: "Запросов human-in-the-loop пока нет — Runtime создаёт их для protected actions.",
        actionHint: "Run с tool execution или production deploy сгенерирует request.",
        actionLabel: "Запустить задачу",
        example: "Tool gateway request → pending → Owner approve → audit event."
      },
      filtered: {
        title: "Нет approvals по фильтрам",
        reason: "Статус или поиск скрывают все запросы.",
        actionHint: "Сбросьте фильтры или дождитесь нового protected action от Runtime.",
        actionLabel: "Запустить задачу",
        example: "Pending production deploy — policy badge и Owner review actions."
      }
    }
  },
  nav: {
    flow: "Flow",
    missionControl: "Mission Control",
    organization: "Организация",
    companies: "Компании",
    employees: "Сотрудники",
    workspaces: "Рабочие пространства",
    projects: "Проекты",
    tasks: "Задачи",
    feed: "Лента",
    timeline: "Хронология",
    activity: "Активность",
    notifications: "Уведомления",
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
  ownerNav: ownerNavRu,
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
    flow: "Flow-пространство",
    dashboard: "Обзор компании",
    canvas: "Canvas компании",
    missionControl: "Mission Control",
    missionFeed: "Лента событий",
    companyTimeline: "Хронология компании",
    activity: "Активность",
    notifications: "Уведомления",
    toolsRegistry: "Реестр AI-инструментов",
    employees: "Сотрудники",
    companies: "Компании",
    organization: "Организация",
    tasks: "Задачи",
    execution: "Очередь выполнения",
    toolExecutions: "Вызовы инструментов",
    handoffs: "Передачи работы",
    discussions: "Обсуждения",
    chats: "Чаты",
    collaboration: "Коллаборация",
    controlRoom: "Control Room AI Photo Lab",
    sprint: "Спринт",
    workspaces: "Рабочие пространства",
    projects: "Проекты",
    reports: "Отчёты",
    runs: "История запусков",
    knowledge: "База знаний",
    audit: "Аудит",
    runtimeSettings: "Настройки Runtime",
    runtimeLive: "Live-монитор Runtime",
    approvals: "Согласования",
    presence: "Присутствие",
    workday: "Рабочий день",
    operatingDay: "Рабочий день",
    visualLab: "Visual Execution Lab",
    runTask: "Запуск задачи",
    taskResults: "Результаты задач",
    morningReport: "Утренний отчёт",
    employeeToday: "Сегодня"
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
    actionOpenControlRoom: "Control Room AI Photo Lab",
    actionOpenSprint: "Спринт 1 — рабочий MVP",
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
    title: "Командный центр",
    description: "Операционный обзор — здоровье компании, команда, спринт, решения, риски и live-активность.",
    healthScoreLabel: "индекс здоровья компании",
    sprintTasks: "задач выполнено",
    sprintPoints: "story points",
    approvalsPending: "Ожидание",
    approvalsApproved: "одобрено",
    runtimeTotal: "запуски",
    runtimeWaiting: "ожидает согласования",
    toolCompleted: "завершено",
    toolFailed: "Ошибка",
    toolPending: "ожидает согласования",
    canvasEmployees: "сотрудников",
    canvasTasks: "активных задач",
    canvasApprovals: "согласований",
    canvasRuns: "запусков runtime",
    controlRoomWorking: "в работе",
    controlRoomBlocked: "заблокировано",
    controlRoomApprovals: "решений",
    greeting: {
      morning: "Доброе утро, Owner.",
      afternoon: "Добрый день, Owner.",
      evening: "Добрый вечер, Owner."
    },
    brief: {
      summary: "Ваш операционный пульс на сегодня — что движется, что требует вас и где сосредоточен риск.",
      workingHighlight: "{count} сотрудников активно работают прямо сейчас",
      approvalsHighlight: "{count} согласований ждут вашего решения",
      sprintHighlight: "Здоровье спринта: {health}",
      projectHighlight: "AI Photo Lab на {progress}% к MVP",
      calmDay: "Операции стабильны — срочных блокеров не обнаружено",
      riskAlerts: "{count} критических алертов требуют внимания",
      riskWaiting: "{count} сотрудников заблокированы на согласовании",
      healthScore: "Индекс здоровья",
      unread: "{count} непрочитанных уведомлений",
      allClear: "Входящих нет",
      openTimeline: "Открыть хронологию"
    },
    sprintHealth: {
      on_track: "по плану",
      at_risk: "под риском",
      blocked: "заблокировано"
    },
    sections: {
      companyHealth: "Состояние компании",
      employeesWorking: "Работающие сотрудники",
      todaysSprint: "Спринт на сегодня",
      approvals: "Согласования",
      criticalAlerts: "Критические алерты",
      runtime: "Runtime",
      toolUsage: "Использование инструментов",
      recentReports: "Недавние отчёты",
      liveTimeline: "Live-лента",
      canvasPreview: "Превью Canvas",
      controlRoomPreview: "Превью Control Room",
      notifications: "Уведомления",
      quickLaunch: "Быстрый запуск",
      charts: "Графики execution"
    },
    charts: {
      productivity: "Продуктивность",
      capacity: "Ёмкость",
      execution: "Execution",
      approvals: "Согласования"
    },
    quickLaunch: {
      atlas: "Atlas",
      max: "MAX",
      canvas: "Canvas",
      sprint: "Спринт",
      controlRoom: "Control Room",
      kickoff: "Kickoff",
      handoffs: "Handoffs",
      runtime: "Runtime",
      runTask: "Запуск задачи",
      taskResults: "Результаты задач",
      morningReport: "Утренний отчёт"
    },
    empty: {
      sprint: "Активный спринт не настроен",
      approvals: "Нет ожидающих согласований",
      runtime: "Запусков runtime пока нет",
      tools: "Запусков инструментов пока нет",
      reports: "Отчёты пока не созданы",
      canvas: "Граф Canvas недоступен",
      canvasTasks: "Нет активных задач на Canvas",
      controlRoom: "Снимок Control Room недоступен"
    },
    providerHealth: {
      up: "Исправно",
      degraded: "Деградация"
    }
  },
  firstFiveMinutesGuide: {
    title: "Что сделать первым?",
    subtitle: "Пять шагов за 5 минут — быстрый старт для Owner без onboarding-wizard.",
    cta: "Начать с MAX",
    ctaHref: "/ops/run-task?employee=ag-max",
    collapse: "Свернуть",
    expand: "Показать гид",
    compactNavAria: "Краткий список первых шагов",
    stepMeta: {
      whatItIs: "Что это",
      why: "Зачем",
      afterClick: "После клика",
      expectedResult: "Ожидаемый результат"
    },
    steps: {
      companyState: {
        title: "Посмотреть состояние компании",
        whatItIs: "Командный центр — главный экран /ops с здоровьем компании, командой, runtime и алертами.",
        why: "Owner за минуту видит, что происходит с цифровой компанией, прежде чем ставить задачи.",
        afterClick: "Откроется Command Center с утренним брифом, активными сотрудниками, согласованиями и live-событиями.",
        expectedResult: "Понятная картина дня: кто работает, что ждёт решения, есть ли риски."
      },
      assignTask: {
        title: "Поставить задачу MAX",
        whatItIs: "Run Task — форма постановки задачи цифровому сотруднику MAX.",
        why: "MAX выполняет технический аудит, reasoning и Worker Loop по вашей формулировке.",
        afterClick: "Откроется /ops/run-task с выбранным MAX — опишите задачу и запустите цикл.",
        expectedResult: "MAX принимает задачу, строит Decision Plan и запускает Worker Loop; результат появится в Runtime и отчётах."
      },
      maxDay: {
        title: "Открыть рабочий день MAX",
        whatItIs: "Employee Operating Day — экран «сегодня» для MAX: очередь, смена, итог дня.",
        why: "Видно, что MAX делает прямо сейчас и как идёт его рабочая смена.",
        afterClick: "Откроется /ops/employees/ag-max/today с Operating Day, Work Queue и summary.",
        expectedResult: "Понимание текущей работы MAX: активные задачи, очередь, статус смены."
      },
      morningReport: {
        title: "Посмотреть утренний отчёт",
        whatItIs: "Owner Morning Report — сводка ночной/утренней работы MAX для Owner.",
        why: "Не нужно собирать статус вручную — отчёт агрегирует Journal, решения и next steps.",
        afterClick: "Откроется /ops/morning-report с разделами «что сделано», «что требует решения».",
        expectedResult: "Готовый brief: выполненные задачи, риски, Owner decisions и рекомендуемый следующий шаг."
      },
      ownerDecisions: {
        title: "Проверить решения Owner",
        whatItIs: "Approvals — очередь согласований и Owner decisions (Cursor Automation, handoff, gates).",
        why: "Цифровые сотрудники не действуют без Owner там, где требуется approval.",
        afterClick: "Откроется /ops/approvals со списком pending и историей решений.",
        expectedResult: "Видны все пункты, ожидающие вашего approve/reject, и можно принять решение."
      }
    }
  },
  ownerHome: {
    title: "Обзор компании",
    description: "Главный экран Owner — что происходит в цифровой компании прямо сейчас.",
    heroQuestion: "Что сейчас происходит в компании?",
    heroHint: "Состояние команды, последние результаты, решения Owner и следующие шаги — только реальные данные из localStorage.",
    localNote: "Presence, Work Queue, Daily Journal, Approvals, Cursor Automation, Runtime — без fake progress.",
    sections: {
      companyStatus: "Состояние компании",
      completedTasks: "Что сделали сотрудники",
      decisions: "Что требует решения Owner",
      nextActions: "Что делать дальше"
    },
    metrics: {
      activeEmployees: "Активных сотрудников",
      tasksInProgress: "Задач в работе",
      tasksCompletedToday: "Завершено сегодня",
      pendingDecisions: "Ждёт решения Owner"
    },
    companyStatus: {
      operatingHint: "Компания работает — есть активные сотрудники или задачи в runtime.",
      idleHint: "Сейчас нет активных задач. Поставьте задачу MAX или откройте утренний отчёт.",
      operatingStatus: {
        operating: "Работает",
        idle: "Простой",
        attention: "Нужно внимание"
      }
    },
    decisionKinds: {
      approval: "Согласование",
      cursor_handoff: "Cursor handoff",
      knowledge_candidate: "Knowledge candidate",
      blocked_task: "Заблокировано"
    },
    actions: {
      openReport: "Открыть отчёт",
      review: "Проверить"
    },
    nextActions: {
      runTask: {
        label: "Поставить задачу MAX",
        description: "Run Task — новая задача для MAX."
      },
      morningReport: {
        label: "Открыть утренний отчёт",
        description: "Итог работы сотрудников и решения Owner."
      },
      maxToday: {
        label: "Рабочий день MAX",
        description: "Operating Day — статус, прогресс, итог дня."
      },
      maxQueue: {
        label: "Очередь задач MAX",
        description: "Work Queue на рабочем месте MAX."
      }
    },
    empty: {
      completedTasks: "Сегодня завершённых задач пока нет. Запустите Run Task или очередь MAX.",
      decisions: "Нет срочных решений — approvals, handoff и блокировки отсутствуют."
    }
  },
  morningReport: {
    pageTitle: "Утренний отчёт Owner",
    title: "Утренний отчёт",
    pageDescription: "Результат ночной работы MAX — что сделано, что обнаружено, что требует вашего решения и что делать дальше.",
    greeting: "Доброе утро, Owner",
    generatedAt: "Сформирован",
    statsAria: "Сводка за ночную смену",
    openNextStep: "Перейти к действию",
    sourceJournal: "Источник: Employee Daily Journal",
    sourceOperatingDay: "Источник: Daily Journal + Operating Day Summary",
    sourceRuntimeFallback: "Источник: Runtime fallback",
    localNote: "Primary: Employee Daily Journal + Operating Day Summary (при завершении workday). Fallback: Worker Loop / Runtime / Cursor Automation / Work Queue.",
    operatingDayState: {
      finished: "Рабочий день завершён",
      in_progress: "Рабочий день идёт",
      not_started: "Рабочий день не начат"
    },
    stats: {
      journalEntries: "Записей Journal",
      workDurationMinutes: "Минут работы",
      loopsCompleted: "Циклов MAX",
      reportsCreated: "Отчётов",
      pendingApprovals: "Ждут Owner",
      cursorTasks: "Cursor tasks",
      memoryDrafts: "Memory drafts",
      knowledgeCandidates: "Knowledge",
      remainingQueue: "В очереди"
    },
    sections: {
      whatDone: "Что сделано",
      whatDoneHint: "Завершённые задачи MAX из Daily Journal — work summary и результаты.",
      reportsCreated: "Созданные отчёты",
      modelsUsed: "Модели",
      modelsUsedHint: "Local Ollama и pipeline из Decision Plan / Runtime.",
      toolsUsed: "Инструменты",
      toolsUsedHint: "Tool Registry и Cursor Automation из Journal.",
      consultations: "Консультации",
      consultationsHint: "Peer consult из Worker Loop / Decision Plan.",
      whatDiscovered: "Решения и выводы",
      whatDiscoveredHint: "Decisions из Journal и findings из Worker Loop (fallback).",
      memoryDrafts: "Memory Drafts",
      knowledgeCandidates: "Knowledge Candidates",
      needsOwner: "Что требует решения Owner",
      needsOwnerHint: "Owner Approval из Journal + Cursor gates и Work Scheduler.",
      remainingQueue: "Осталось в очереди",
      remainingQueueHint: "Employee Work Queue — pending / scheduled / blocked.",
      cursorTasks: "Cursor tasks",
      cursorTasksHint: "Handoff готов к submit, отправленные задачи и ожидание результата.",
      nextStep: "Что предлагаю дальше",
      nextStepHint: "Следующая задача из очереди, approval, рекомендация Operating Day или продолжение после Journal.",
      operatingDaySummary: "Итог рабочего дня",
      operatingDaySummaryHint: "End-of-day recap из Operating Day Summary после завершения workday.",
      employeeRecommendations: "Рекомендации сотрудника",
      employeeRecommendationsHint: "Рекомендации на следующий день из Operating Day Summary.",
      unfinishedTasks: "Незавершённые задачи",
      unfinishedTasksHint: "Pending / scheduled из Work Queue или Operating Day Summary.",
      blockedTasks: "Заблокированные задачи",
      blockedTasksHint: "Blocked items и difficulties из Operating Day Summary."
    },
    empty: {
      whatDone: "За отчётный период MAX не завершил новых задач — можно запустить Worker Loop.",
      reports: "Новых отчётов MAX за период нет.",
      modelsUsed: "Модели не зафиксированы в Journal.",
      toolsUsed: "Инструменты не использовались.",
      consultations: "Консультаций с коллегами не было.",
      whatDiscovered: "Decisions и findings не зафиксированы — запустите Worker Loop.",
      memoryDrafts: "Memory drafts не появились.",
      knowledgeCandidates: "Knowledge candidates не появились.",
      needsOwner: "Решений Owner не требуется — операции стабильны.",
      remainingQueue: "Work Queue пуст — новых задач в очереди нет.",
      cursorTasks: "Cursor tasks в очереди нет.",
      nextStep: "Следующий шаг не определён.",
      employeeRecommendations: "Рекомендаций сотрудника пока нет — завершите рабочий день для Operating Day Summary.",
      unfinishedTasks: "Незавершённых задач в Work Queue нет.",
      blockedTasks: "Заблокированных задач нет."
    }
  },
  visualLab: {
    title: "Visual Execution Lab",
    description: "Visual workspace в стиле Cursor — mock-редактор, терминал, превью браузера, клики и timeline тестов для execution цифрового сотрудника.",
    mockNote: "Только visual/mock — без реального Playwright или browser automation.",
    sidebar: {
      employee: "Сотрудник",
      task: "Задача",
      execution: "Execution",
      status: "Статус",
      tests: "Шаги теста",
      project: "Проект",
      integrations: "Интеграции",
      doingNow: "Сейчас делает"
    },
    integrations: {
      execution: "Очередь execution",
      runtime: "Запуск Runtime",
      handoffs: "Handoff",
      reports: "Отчёт",
      canvas: "Canvas компании",
      controlRoom: "Control Room"
    },
    editor: {
      title: "Редактор",
      changed: "Файл изменён"
    },
    terminal: {
      title: "Терминал",
      waiting: "Ожидание вывода execution…"
    },
    browser: {
      title: "Превью браузера",
      landingCopy: "Войдите, чтобы продолжить в inspection workspace AI Photo Lab.",
      buttonPending: "Отрисовка кнопки Sign in…",
      screenshots: "Timeline скриншотов"
    },
    timeline: {
      title: "Timeline действий",
      play: "Воспроизвести",
      pause: "Пауза",
      replay: "Повтор",
      restart: "Перезапуск",
      back: "Назад",
      forward: "Вперёд"
    },
    actions: {
      test_started: "Тест запущен",
      file_changed: "Файл изменён",
      terminal_line: "Терминал",
      cursor_move: "Курсор перемещён",
      click: "Клик по login",
      highlight: "Подсветка UI-элемента",
      button_added: "Кнопка добавлена",
      screenshot: "Скриншот сохранён",
      build_passed: "Сборка успешна"
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
      cursorAutomation:
        "Cursor Automations — внешний исполнитель кода и PR; не сотрудник, только Tool Registry.",
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
    flowWorkspace: "Flow-пространство",
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
      milestones: "Вехи",
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
      health: "Здоровье проекта",
      healthSub: "общий прогресс",
      sprintProgress: "Прогресс спринта",
      milestonesDone: "milestones выполнено",
      runtimeQueue: "Очередь Runtime",
      waitingApproval: "ожидают approval",
      teamActivity: "Активность команды",
      assignmentsSub: "активных назначений в workspace",
      approvals: "Согласования",
      approvalsSub: "ожидающих решений",
      recentDiscussions: "Недавние обсуждения",
      risks: "Открытые риски",
      risksSub: "в project register"
    },
    team: {
      title: "Команда проекта",
      empty: "Члены команды не назначены.",
      viewProfile: "Профиль",
      roles: {
        lead: "Лид",
        developer: "Разработчик",
        qa: "QA",
        architect: "Архитектор",
        pm: "PM",
        designer: "Дизайнер",
        member: "Участник"
      }
    },
    board: {
      title: "Доска проекта",
      description: "Delivery task kanban — backlog, in progress, review, done.",
      empty: "Пусто",
      columns: {
        backlog: "Backlog",
        in_progress: "В работе",
        review: "Заблокировано",
        done: "Готово"
      }
    },
    milestones: {
      title: "Вехи",
      short: "вех",
      empty: "Milestones не определены.",
      status: {
        planned: "Планируемые",
        in_progress: "В процессе",
        done: "Готово",
        blocked: "Заблокировано"
      }
    },
    roadmap: {
      title: "Roadmap",
      empty: "Ничего не запланировано",
      horizons: {
        now: "Сейчас",
        next: "Далее",
        later: "Позже"
      }
    },
    timeline: {
      title: "Timeline проекта",
      description: "Даты milestones и recent company events для delivery.",
      viewCompany: "Timeline компании"
    },
    reports: {
      title: "Отчёты проекта",
      description: "Reports от digital employees — project scope в V2.",
      empty: "Reports пока нет.",
      viewAll: "Все reports"
    },
    runtime: {
      title: "Очередь Runtime",
      description: "Runtime runs для workspace {workspace} — company-wide queue в V1.",
      empty: "Runtime runs пока нет.",
      viewRuns: "История запусков",
      settings: "Настройки Runtime"
    },
    activity: {
      title: "Активность проекта",
      description: "Recent company events — project-scoped audit в V2.",
      empty: "Активности пока нет."
    },
    chats: {
      title: "Чаты проекта",
      description: "Delivery discussions — включая #ai-photo-lab-delivery.",
      empty: "Project chats пока нет.",
      messages: "сообщений",
      open: "Открыть чаты"
    },
    knowledge: {
      title: "База знаний проекта",
      description: "Knowledge entries для linked workspace.",
      empty: "Knowledge entries для workspace пока нет.",
      openWorkspace: "Открыть рабочее пространство"
    },
    tasks: {
      title: "Delivery-задачи",
      description: "Назначенные задачи с priority, status и expected output.",
      empty: "Delivery tasks пока нет.",
      expectedOutput: "Ожидаемый результат"
    },
    taskStatus: {
      backlog: "Backlog",
      in_progress: "В процессе",
      review: "Проверка",
      done: "Готово",
      blocked: "Заблокировано"
    },
    taskPriority: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      critical: "Критический"
    },
    milestoneStatus: {
      pending: "Ожидает",
      in_progress: "В работе",
      done: "Готово",
      blocked: "Заблокировано",
      at_risk: "Под риском"
    },
    future: {
      label: "Будущее",
      budget: "Бюджет",
      client: "Клиент",
      invoices: "Счета",
      releases: "Релизы"
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
      offline: "Не в сети",
      available: "Доступен",
      busy: "Занят",
      in_discussion: "В обсуждении",
      working: "Работает",
      waiting_approval: "Ожидает согласования",
      reviewing: "На проверке",
      learning: "Обучение",
      break: "Перерыв"
    },
    dashboard: {
      nowWorking: "Сейчас работает",
      waiting: "Ожидает",
      needsAttention: "Требует внимания",
      available: "Доступен",
      recentlyFinished: "Недавно завершили",
      todaysActivity: "Активность за сегодня",
      currentAssignment: "Текущее назначение",
      recentReports: "Недавние отчёты",
      noWorking: "Сейчас никто активно не работает.",
      noWaiting: "Никто не ждёт approval.",
      noFinished: "Завершённых work blocks сегодня нет.",
      noAssignments: "Active workspace assignments нет.",
      noReports: "Recent reports нет."
    },
    currentWork: {
      title: "Текущая работа",
      offline: "Employee offline или не активирован.",
      project: "Проект",
      workspace: "Рабочее пространство",
      task: "Задача",
      run: "Запуск Runtime",
      started: "Начало",
      expectedFinish: "Ожидаемое завершение"
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
      learning: "Обучение",
      break: "Перерыв"
    },
    timeline: {
      title: "Timeline рабочего дня",
      description: "Сегодняшняя активность digital employees из presence transitions."
    }
  },
  reports: {
    pageDescription: "Структурированные отчёты цифровых сотрудников — понятные, проверяемые Owner до и после Runtime.",
    catalogTitle: "Каталог отчётов",
    reportCount: "отчёты",
    openReport: "Открыть отчёт",
    backToList: "Назад к отчётам",
    localOnly: "Хранится в localStorage — mock/seed data в V1, без Runtime.",
    reportsFirstNote: "Принцип «сначала отчёт»: каждое важное действие сотрудника должно создавать отчёт.",
    notFoundTitle: "Отчёт не найден",
    notFoundDescription: "Этот отчёт отсутствует в каталоге.",
    noEmployee: "Платформа",
    noRisks: "Риски не выявлены.",
    noRecommendations: "Рекомендаций пока нет.",
    emptyTitle: "Нет подходящих отчётов",
    emptyDescription: "Измените фильтры или дождитесь отчётов от сотрудников.",
    searchPlaceholder: "Поиск отчётов…",
    findingsCount: "выводы",
    risksCount: "риски",
    created: "Создано",
    updated: "Обновлено",
    stats: {
      total: "Всего отчётов",
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
    runtimeReport: {
      ownerDecisionNo: "Нет",
      sections: {
        briefSummary: "Краткий итог",
        checked: "Что проверено",
        found: "Что найдено",
        risks: "Риски",
        recommendations: "Рекомендации",
        nextStep: "Следующий шаг",
        ownerDecisionRequired: "Требуется решение Owner"
      },
      severity: {
        critical: "Критический",
        high: "Высокий",
        medium: "Средний",
        low: "Низкий"
      }
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
    pageDescription: "Единый операционный inbox — каждое важное событие платформы создаёт уведомление для Owner с severity, контекстом и deep links.",
    inboxTitle: "Уведомления",
    bellLabel: "Уведомления",
    emptyInbox: "Уведомлений пока нет.",
    markRead: "Отметить прочитанным",
    markAllRead: "Отметить все прочитанными",
    openAction: "Открыть",
    viewInbox: "Открыть inbox",
    itemCount: "элементов",
    unreadCount: "{count} непрочитанных уведомлений",
    searchLabel: "Поиск",
    searchPlaceholder: "Название, summary, category, сотрудник…",
    principleNote: "Принцип уведомлений: emitEvent() и audit actions автоматически добавляют элементы в inbox — Owner проверяет одну поверхность вместо каждой страницы модуля.",
    localOnly: "Хранится в localStorage (ai-company-notifications) — синхронизировано из events и audit в V1.",
    timelineHint: "События Timeline также появляются в Notification Center с actionable links.",
    approvalInbox: "Уведомления согласований",
    reportInbox: "Уведомления отчётов",
    chatInbox: "Уведомления чатов",
    runtimeInbox: "Уведомления Runtime",
    filters: {
      category: "Категория",
      severity: "Критичность",
      read: "Чтение",
      unread: "Непрочитанные"
    },
    severity: {
      info: "Инфо",
      success: "Успех",
      warn: "Предупреждение",
      error: "Ошибка"
    },
    stats: {
      total: "Всего",
      unread: "Непрочитанные",
      approval: "Непрочитанные согласования",
      runtime: "Непрочитанные Runtime"
    },
    categories: {
      approval: "Согласование",
      runtime: "Runtime",
      project: "Проект",
      employee: "Сотрудник",
      knowledge: "База знаний",
      chat: "Чат",
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
    localOnly: "Хранится в localStorage (ai-company-events) — seed data в V1; модули emit через emitEvent().",
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
      employee: "Сотрудник · {name}",
      workspace: "Workspace · {name}"
    },
    stats: {
      total: "Всего events",
      success: "Успех",
      warn: "Предупреждения",
      withWorkspace: "Связано с workspace"
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
      "memory.evolved": "Memory Evolved",
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
      "runtime.started": "Runtime запущен",
      "runtime.completed": "Runtime Completed",
      "runtime.failed": "Runtime завершился с ошибкой",
      "run.completed": "Запуск завершён",
      "collaboration.started": "Коллаборация начата",
      "collaboration.message": "Сообщение коллаборации",
      "collaboration.consensus": "Консенсус коллаборации",
      "collaboration.completed": "Коллаборация завершена",
      "handoff.created": "Handoff создан",
      "handoff.sent": "Handoff отправлен",
      "handoff.returned": "Handoff возвращён",
      "handoff.accepted": "Handoff принят",
      "handoff.rejected": "Handoff отклонён",
      "sprint.planned": "Спринт запланирован",
      "sprint.started": "Спринт начат",
      "sprint.completed": "Спринт завершён",
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
    inspectorTitle: "Инспектор execution",
    inspectorEmptyTitle: "Выберите execution",
    inspectorEmptyDescription: "Выберите карточку из очереди, чтобы inspect lifecycle, runtime link и actions.",
    timelineTitle: "Lifecycle выполнения",
    pendingStep: "Ожидание",
    priority: "Приоритет",
    queuePosition: "Позиция в очереди",
    estimatedDuration: "Оценка длительности",
    minutesShort: " мин",
    taskId: "ID задачи",
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
      company: "Очередь компании",
      employee: "Очередь сотрудника",
      project: "Очередь проекта",
      workspace: "Очередь workspace"
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
  toolExecutionEngine: {
    pageDescription: "Единый шлюз для запросов инструментов. Только mock-провайдер, без реального выполнения.",
    submitSample: "Отправить тестовый запрос",
    localNote: "Только локальный mock-поток. Реальные вызовы провайдеров не выполняются.",
    stats: {
      total: "Всего",
      waitingApproval: "Ожидает согласования",
      completed: "Завершено",
      failedCancelled: "Ошибка/отменено"
    },
    filters: {
      title: "Фильтры",
      employee: "Сотрудник",
      provider: "Провайдер",
      status: "Статус",
      approval: "Согласование",
      all: "все",
      required: "обязательно",
      notRequired: "не требуется"
    },
    log: {
      title: "Журнал выполнения",
      items: "{count} записей",
      empty: "Запусков инструментов пока нет.",
      selectHint: "Выберите выполнение из журнала."
    },
    details: {
      title: "Детали выполнения"
    },
    approval: {
      stateTitle: "Статус согласования",
      noAction: "Для текущего статуса действие согласования недоступно.",
      requiredTitle: "Требуется согласование",
      waitingNote: "Запрос ожидает решения Owner: {toolId} · {action}",
      approve: "Одобрить",
      reject: "Отклонить",
      cancel: "Отменить",
      rejectReason: "Отклонено в панели согласования инструмента"
    },
    result: {
      executionId: "ID выполнения:",
      status: "Статус:",
      elapsed: "время: {ms} мс · завершено: {at}",
      noResponse: "Ответа пока нет. Ожидание результата выполнения."
    },
    card: {
      mockTag: "mock",
      selected: "Выбрано",
      openDetails: "Открыть детали"
    },
    statuses: {
      created: "Создано",
      waiting_approval: "Ожидает согласования",
      approved: "Одобрено",
      running: "Выполняется",
      completed: "Завершено",
      failed: "Ошибка",
      cancelled: "Отменено"
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
      technical_audit: "Технический аудит",
      qa_review: "QA-проверка",
      devops_plan: "План DevOps",
      handoff_preparation: "Подготовка handoff",
      documentation: "Документация",
      product_review: "Продуктовое ревью"
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
      start: "Запустить",
      starting: "Запуск…",
      openRunTask: "Запуск задачи"
    },
    result: {
      empty: "Запустите задачу, чтобы увидеть ответ сотрудника.",
      openLive: "Live-монитор",
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
  maxOwnerCommand: {
    panelTitle: "Owner Command — MAX",
    modeBadge: "Режим MAX",
    modeTitle: "Запустить сотрудника MAX",
    modeDescription:
      "Owner быстро ставит задачу MAX и видит, что произойдёт до нажатия «Запустить MAX»: модель Ollama, Cursor, Owner Approval, Memory и Knowledge.",
    enterMaxMode: "Выбрать MAX",
    enterMaxModeHint: "Нажмите «Выбрать MAX», чтобы открыть шаблоны и объяснение цикла Worker Loop.",
    explainTitle: "Что будет дальше",
    templatesTitle: "Быстрые шаблоны задач",
    templatesHint: "Шаблон заполнит форму — при необходимости отредактируйте текст перед запуском.",
    afterLaunch:
      "После запуска откроется Runtime Live с фокусом на MAX Worker Loop: фазы цикла, Tool Branch и Owner Approval.",
    startMax: "Запустить MAX",
    startMaxNote:
      "Создаёт MAX Worker Loop V1, runtime run, Runtime Report и черновики Memory/Knowledge; переход в Live.",
    explain: {
      whatMaxDoes: {
        title: "Что сделает MAX",
        body:
          "MAX пройдёт Worker Loop: анализ задачи через Ollama → reasoning → Runtime Report → черновики Memory/Knowledge. При необходимости — Tool Branch с Cursor Automation (mock V1).",
      },
      model: {
        title: "Какая модель",
        body:
          "Ollama · режим {mode} · {catalog} → тег {model}. MAX закреплён за coding-маршрутом (qwen2.5-coder:7b).",
      },
      cursor: {
        title: "Когда понадобится Cursor",
        body:
          "Если задача требует правок в коде, PR или внешнего исполнителя — MAX откроет Tool Branch и подготовит handoff для Cursor Automation. До Owner Approval submit не выполняется.",
      },
      ownerApproval: {
        title: "Owner Approval",
        body:
          "Требуется при вызове Cursor Automation и других внешних инструментов: Approve/Reject в MAX Worker Loop или на странице Approvals. Без approve — только reasoning и отчёт.",
      },
      memory: {
        title: "Memory",
        body:
          "После цикла MAX сохранит draft Memory Evolution: уроки, findings и mistakes из Runtime Report — в employee-scoped store (localStorage).",
      },
      knowledge: {
        title: "Knowledge",
        body:
          "Кандидаты в Knowledge Base: structured findings, glossary и runbook-фрагменты из отчёта. Owner решает, что промote в project knowledge.",
      },
    },
    templates: {
      runtimeRuI18n: {
        title: "Проверить русификацию Runtime",
        summary: "i18n audit Run Task, Live, Worker Loop и Help Center.",
      },
      screenQa: {
        title: "Провести QA экрана",
        summary: "UX/copy чек-лист Owner Command и перехода в Live.",
      },
      findMocks: {
        title: "Найти mock-данные",
        summary: "Карта real vs mock: demo, Cursor stub, adapters.",
      },
      cursorHandoff: {
        title: "Подготовить задачу для Cursor",
        summary: "Handoff prompt, scope файлов и expected PR для Tool Branch.",
      },
      reportNextStep: {
        title: "Проверить отчёт и предложить следующий шаг",
        summary: "Review последнего Runtime Report и 1–3 next actions.",
      },
    },
    hints: {
      cursor: "Cursor",
      ownerApproval: "Owner Approval",
      memory: "Memory",
      knowledge: "Knowledge",
    },
  },
  maxWorkerLoop: {
    title: "MAX Worker Loop",
    subtitle: "Процесс работы цифрового сотрудника MAX — без fake progress, только реальные фазы.",
    whatHappens: "Что происходит?",
    whatNext: "Что будет дальше?",
    openLive: "Live Runtime",
    openReport: "Runtime Report",
    openRun: "Детали run",
    sectionTitle: "Цикл работы MAX",
    startNote: "Запуск через MAX Worker Loop V1 — Decision Plan (Brain), reasoning, отчёт и черновики Memory/Knowledge.",
    decisionPlan: {
      title: "Decision Plan",
      intent: "Intent",
      model: "Модель",
      tools: "Инструменты",
      ownerApproval: "Owner Approval",
      expectedResult: "Ожидаемый результат",
      rationale: "Rationale (Brain)",
      required: "Требуется",
      notRequired: "Не требуется",
      cursorRequired: "Cursor Automation",
      localOnly: "Только local Ollama"
    },
    consultPeer: {
      title: "Consult Peer",
      askedWho: "Кого спросил",
      whyAsked: "Почему",
      question: "Вопрос",
      answer: "Ответ",
      decision: "Решение MAX",
      usedInTask: "Как использовано в задаче",
      skippedDefault: "Консультация не требуется — Decision Plan не нашёл peer consult signals.",
      failedDefault: "Peer consult завершился с ошибкой."
    },
    phaseStatus: {
      pending: "Ожидает",
      active: "Выполняется",
      done: "Готово",
      skipped: "Пропущено",
      failed: "Ошибка"
    },
    empty: {
      reason: "MAX ещё не выполнял Worker Loop — нет записи цикла в журнале.",
      actionHint: "Выберите MAX в Run Task, вставьте задачу Owner и нажмите «Запустить».",
      actionLabel: "Запустить задачу для MAX",
      example: "Пример: MAX проводит технический аудит AI Photo Lab MVP → фазы цикла → Runtime Report."
    },
    cursorAutomation: {
      title: "Cursor Automation (V1 mock)",
      toolId: "Инструмент",
      invokePhase: "Фаза invoke",
      ownerApproval: "Одобрение Owner",
      mockPr: "Mock PR",
      handoffPrompt: "Handoff prompt для Cursor Automation"
    },
    autonomousDemo: {
      badge: "Autonomous Demo 098C",
      snapshotTitle: "Demo Snapshot",
      runButton: "Запустить первый автономный цикл (demo)",
      runHint:
        "Real Ollama + Runtime Report; mock Owner Approval, Cursor submit и PR — без shell, git и Cursor API.",
      prefillTitle: "Русификация Runtime — autonomous demo",
      prefillTask:
        "Исправить русификацию Runtime Live, Run Task и MAX Worker Loop: проверить i18n ключи, добавить недостающие подписи Help Center для фаз цикла. Подготовить PR через Cursor Automation (mock V1)."
    },
    toolBranch: {
      title: "Tool Branch — Cursor Automation",
      whyCursor: "Почему MAX выбрал Cursor",
      defaultReason: "MAX определил необходимость внешнего исполнителя для реализации.",
      localModels: "Локальные модели (Ollama)",
      selectedTool: "Выбранный инструмент",
      riskLevel: "Уровень риска",
      ownerApprovalStatus: "Статус Owner Approval",
      plannedFiles: "Планируемые файлы",
      expectedOutcome: "Предполагаемый результат",
      buildChecklist: "Build / checklist",
      expectedPr: "Ожидаемый PR",
      readyNote: "Owner одобрил — Ready for Cursor Automation. Нажмите «Отправить в Cursor Automation».",
      rejectedNote: "Owner отклонил отправку во внешний инструмент. Cursor Automation не будет вызван.",
      statusLabels: {
        not_applicable: "Не требуется",
        analyzing: "Анализ",
        external_executor_required: "Нужен внешний исполнитель",
        plan_ready: "План готов",
        awaiting_owner_approval: "Ожидание Owner",
        waiting_for_owner_approval: "Waiting for Owner Approval",
        ready_for_cursor_automation: "Ready for Cursor Automation",
        rejected: "Отклонено Owner",
        handoff_ready: "Handoff готов",
        submitted_mock: "Отправлено (mock stub)",
        submitted_pending_real_adapter: "Отправлено — ожидает adapter",
        waiting_for_result: "Ожидание результата",
        submit_failed: "Ошибка отправки",
        mock_submitted: "Mock отправлен",
        mock_result_ready: "Mock результат",
        accepted: "Принято MAX",
        completed: "Завершено"
      },
      approvalStatus: {
        none: "Не требуется",
        pending: "Ожидает решения",
        approved: "Одобрено",
        rejected: "Отклонено"
      },
      actions: {
        approve: "Approve",
        reject: "Reject",
        editPlan: "Edit Plan",
        editPlanHint: "Редактирование плана — в V2 (placeholder)."
      },
      submit: {
        sectionTitle: "Submit to Cursor Automation",
        submitButton: "Отправить в Cursor Automation",
        statusLabel: "Статус отправки",
        runIdLabel: "Run ID",
        submittedAtLabel: "Submitted at",
        deliveryModeLabel: "Delivery mode",
        expectedPrLabel: "Ожидаемый PR",
        expectedChecksLabel: "Expected checks",
        handoffPayloadLabel: "Handoff payload (saved)",
        successMock:
          "Отправка подготовлена (mock stub). Payload сохранён локально — внешние сервисы не вызывались.",
        successPendingAdapter:
          "Отправка подготовлена — ожидается реальный Cursor adapter. Payload сохранён для будущей доставки.",
        whatNext:
          "Дальше: real Cursor adapter заберёт payload → выполнит automation → вернёт PR/checks → MAX Review → Runtime Report.",
        retryButton: "Retry submit",
        retryHint: "Retry submit — V2 (placeholder).",
        errorGeneric: "Submit не выполнен — проверьте Owner Approval и handoff.",
        deliveryMode: {
          mock_v1_stub: "Mock V1 stub",
          pending_real_adapter: "Pending real adapter"
        }
      }
    },
    cursorResult: {
      title: "Cursor Result → MAX Integration",
      source: "Источник",
      cursorReturned: "Что вернул Cursor",
      maxAccepted: "Что принял MAX",
      reportPatch: "Patch для Runtime Report",
      memoryDraft: "Memory Evolution (draft)",
      knowledgeCandidates: "Knowledge Candidate (draft)",
      cursorRules: "Правила для .cursor/rules",
      historyEvents: "Runtime History events",
      buildStatus: "Build",
      draftOnlyNote: "Только draft — автоматическая публикация отключена.",
      rulesNote: "Кандидаты правил — Owner review перед записью в .cursor/rules.",
      reviewStatus: {
        pending: "Ожидает review",
        accepted: "Принято",
        rejected: "Отклонено"
      }
    }
  },
  decisionPlan: {
    title: "План решения MAX",
    subtitle: "Как MAX понял задачу и что выбрал Brain + Decision Strategy перед выполнением.",
    sectionTitle: "Decision Plan",
    previewBadge: "Предпросмотр",
    empty: {
      message: "MAX ещё не построил план решения. Он появится после запуска задачи.",
      hint: "Введите задачу Owner и выберите MAX — предпросмотр появится до запуска, сохранённый план — после старта Worker Loop."
    },
    fields: {
      taskUnderstood: "Понятая задача",
      brainProfile: "Brain профиль",
      decisionStyle: "Стиль решений",
      primaryModel: "Выбранная модель",
      multiModel: "Multi-model режим",
      tools: "Инструменты (Tool Registry)",
      cursorAutomation: "Cursor Automation",
      ownerApproval: "Owner Approval",
      expectedResult: "Ожидаемый результат",
      deliverables: "Deliverables",
      acceptanceCriteria: "Критерии приёмки",
      matchedSignals: "Matched signals",
      rationale: "Причины / rationale"
    },
    values: {
      yes: "Да",
      no: "Нет",
      required: "Требуется",
      notRequired: "Не требуется"
    }
  },
  maxWorkspace: {
    pageTitle: "MAX — рабочее место",
    pageDescription:
      "Рабочий стол цифрового сотрудника MAX: текущая задача, Worker Loop, Cursor Automation, черновики Memory/Knowledge и следующие шаги — только реальные данные.",
    principleNote:
      "Без fake progress: статусы и фазы отражают фактический MAX Worker Loop и Runtime. Пустые секции — данных ещё нет.",
    runningNote: "Цикл выполняется — фазы обновляются по мере реального progress Task Runner / Ollama.",
    sections: {
      workStatus: "Статус работы",
      thinkingModel: "Модель reasoning",
      workerLoopPhase: "Фаза Worker Loop",
      externalExecutor: "Внешний исполнитель",
      ownerApproval: "Owner Approval",
      cursorAutomation: "Cursor Automation",
      lastReport: "Последний отчёт",
      memoryDrafts: "Memory Drafts",
      knowledgeCandidates: "Knowledge Candidates",
      nextActions: "Next Actions",
      workerLoopDetail: "Детали MAX Worker Loop",
      required: "Требуется",
      tool: "Инструмент",
      reason: "Причина",
      status: "Статус",
      submitRun: "Submit run",
      result: "Результат"
    },
    values: {
      yes: "Да",
      no: "Нет",
      resultReady: "Result integration готов (draft)"
    },
    empty: {
      noLoopHint: "MAX ещё не запускал Worker Loop. Запустите задачу через Run Task — здесь появится реальный статус работы.",
      noTask: "Задача не назначена",
      noModel: "Модель будет известна после запуска reasoning",
      externalExecutor: "Внешний исполнитель не требуется или цикл ещё не завершил анализ.",
      ownerApproval: "Gate Owner Approval появится после handoff Cursor Automation.",
      cursorAutomation: "Cursor Automation не активен для текущего цикла.",
      lastReport: "Отчётов по текущему циклу пока нет.",
      memoryDrafts: "Черновики Memory Evolution появятся после завершённого Worker Loop.",
      knowledgeCandidates: "Knowledge Candidates появятся после завершённого Worker Loop.",
      nextActions: "Next Actions появятся после Runtime Report."
    },
    actions: {
      runTask: "Запустить задачу для MAX",
      openProfile: "Профиль MAX",
      openReport: "Открыть отчёт",
      openRun: "Детали run",
      openLive: "Live Runtime"
    },
    summary: {
      title: "Рабочее место MAX",
      task: "Текущая задача",
      status: "Статус",
      phase: "Фаза",
      cursor: "Cursor Automation",
      cursorIdle: "Не активен",
      empty: "Worker Loop ещё не запускался — откройте рабочее место или Run Task.",
      openWorkspace: "Открыть рабочее место MAX"
    },
    workQueue: {
      title: "Очередь работы MAX",
      empty: "У MAX пока нет задач в очереди.",
      suggestedAction: "Следующее действие",
      activeLabel: "Активная задача",
      pendingLabel: "Ожидающие задачи",
      running: "Выполняется задача из очереди — Worker Loop активен…",
      footnote: "Очередь хранится локально (Employee Work Queue V1). Для разовых задач используйте",
      stats: {
        pending: "В очереди: {count}",
        blocked: "Заблокировано: {count}"
      },
      fields: {
        priority: "Приоритет",
        status: "Статус",
        scheduledAt: "Запланировано",
        startedAt: "Начато",
        completedAt: "Завершено",
        blockedReason: "Причина блокировки",
        workerLoopId: "Worker Loop",
        queuePosition: "Позиция"
      },
      statuses: {
        pending: "Ожидает",
        scheduled: "Запланирована",
        in_progress: "В работе",
        blocked: "Заблокирована",
        completed: "Завершена",
        skipped: "Пропущена",
        cancelled: "Отменена"
      },
      priorities: {
        low: "Низкий",
        medium: "Средний",
        high: "Высокий",
        critical: "Критический"
      },
      actions: {
        addTest: "Добавить тестовую задачу",
        startNext: "Запустить следующую задачу",
        runAll: "Запустить всю очередь"
      },
      feedback: {
        testAdded: "Тестовая задача добавлена в очередь MAX.",
        started: "Запущена задача: «{title}».",
        runAllDone: "Обработано задач: {count}.",
        runAllPartial: "Обработано до ошибки: {count}."
      },
      errors: {
        generic: "Не удалось выполнить задачу из очереди.",
        emptyQueue: "Очередь пуста — добавьте задачу."
      }
    }
  },
  workScheduler: {
    title: "Next Suggested Actions",
    empty: "Нет предложений — завершите runtime run, чтобы сотрудник предложил следующие шаги.",
    ownerApprovalNote: "Сотрудник проанализировал последний run и предложил шаги. Owner должен approve — автоматического выполнения нет.",
    stats: {
      pending: "{count} ожидают approval"
    },
    kinds: {
      next_task: "Следующая задача",
      send_qa: "Отправить в QA",
      send_max: "Отправить MAX",
      send_codex: "Отправить в Codex",
      create_follow_up: "Follow-up задача",
      complete_sprint_item: "Закрыть sprint item"
    },
    priorities: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий"
    },
    actions: {
      approve: "Одобрить",
      dismiss: "Dismiss",
      openRunTask: "Run Task",
      openResult: "Открыть result",
      openQueue: "Очередь Task Results"
    }
  },
  photoLabKickoff: {
    title: "Kickoff AI Photo Lab",
    description: "Owner kickoff hub — CTO plan, sprint, demo readiness, Codex handoff и быстрые запуски сотрудников.",
    actionsHint: "Запустите пресеты Atlas / MAX / QA или перейдите на связанные поверхности.",
    handoffChecklistDone: "пунктов чек-листа",
    demoReadyLabel: "gates готовы",
    sections: {
      ctoPlan: "План CTO",
      sprintGoal: "Цель спринта",
      demoReadiness: "Готовность к demo",
      maxHandoff: "Handoff MAX → Codex",
      qaChecklist: "QA checklist",
      ownerApprovals: "Согласования Owner",
      actions: "Действия kickoff",
      teamActivity: "Активность команды сейчас"
    },
    links: {
      controlRoom: "Control Room"
    },
    cto: {
      weekGoal: "Цель недели",
      priorities: "Приоритеты",
      codexScope: "Объём Codex"
    },
    sprint: {
      name: "Спринт",
      status: "Статус",
      tasks: "Задачи",
      health: "Здоровье"
    },
    owner: {
      decisions: "Решения Owner",
      approvals: "Ожидающие согласования",
      noDecisions: "Нет открытых owner decisions.",
      noApprovals: "Нет pending approvals."
    },
    demoOverall: {
      ready: "Готово",
      needs_fix: "Нужна доработка",
      blocked: "Заблокировано"
    },
    gateStatus: {
      ready: "Готово",
      needs_fix: "Нужна доработка",
      blocked: "Заблокировано",
      pending: "Ожидание"
    },
    checklistStatus: {
      pending: "Ожидает",
      in_progress: "В работе",
      done: "Готово",
      blocked: "Заблокировано"
    },
    actions: {
      startAtlas: "Запустить Atlas (планирование)",
      startMax: "Запустить MAX (технический аудит)",
      startQa: "Запустить QA (demo review)",
      starting: "Запуск…",
      review: "Проверка",
      openSprint: "Открыть спринт",
      openCodexHandoff: "Handoff Codex",
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
      decisions: "Решения",
      approvals: "Согласования",
      progress: "Прогресс"
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
      readyForReview: "Готово к review",
      approved: "Одобрено",
      changesRequested: "Запрошены изменения"
    },
    sections: {
      review: "Review Owner",
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
      requestChanges: "Запросить изменения",
      reject: "Отклонить",
      createFollowUp: "Создать follow-up задачу",
      sendToQa: "Отправить в QA",
      sendToCodex: "Отправить в handoff Codex",
      archive: "Архивировать"
    },
    statuses: {
      draft: "Черновик",
      ready_for_review: "Готово к review",
      approved: "Одобрено",
      changes_requested: "Запрошены изменения",
      rejected: "Отклонено",
      archived: "В архиве"
    },
    reviewActions: {
      submit_for_review: "Отправлено на review",
      approve: "Одобрено",
      request_changes: "Запрошены изменения",
      reject: "Отклонено",
      create_follow_up: "Follow-up задача создана",
      send_to_qa: "Отправлено в QA",
      send_to_codex: "Отправлено в Codex",
      archive: "В архиве"
    }
  },
  canvasEngine: {
    pageDescription: "Premium operational graph — кто работает, как движутся задачи, где Runtime и где ждут approvals.",
    projectFocusDescription: "Project focus — {project}: squad, tasks, runtime runs, reports, approvals и tool gateway.",
    nodes: "узлов",
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
    runningTasks: "Задачи в работе",
    waitingApprovals: "Ожидающие согласования",
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
    openNode: "Открыть",
    miniMapAria: "Мини-карта",
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
      projects: "Проекты",
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
      project: "Проект",
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
      chat: "Чат"
    }
  },
  runtimeEngine: {
    pageDescription: "Model-independent Runtime Profiles — сменяемые LLM engines с routing, privacy и cost policies.",
    employeePageTitle: "{name} — профиль Runtime",
    employeePageDescription: "Конфигурация Runtime engine для сотрудника — выбор модели отделён от identity, memory и experience.",
    employeeRuntimePage: "Runtime сотрудника",
    employeeSectionTitle: "Профиль Runtime",
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
    localOnly: "Хранится в localStorage (ai-company-runtime-profiles) — без вызовов Ollama или облака в V1.",
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
      totalProfiles: "Профили Runtime",
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
    executionTitle: "Выполнение Runtime",
    executionDescription: "Реальный prompt для {name} через активный runtime provider.",
    modelSelector: "Модель Ollama",
    promptLabel: "Prompt",
    executePrompt: "Выполнить prompt",
    executing: "Выполнение…",
    realExecution: "Реальное выполнение",
    mockExecution: "Mock-выполнение",
    mockExecutionNote: "Переключите active provider на Ollama для real HTTP execution.",
    fastTestMode: "Быстрый тестовый режим",
    fastTestTag: "быстрый тест",
    fastTestModeNote: "Быстрый тестовый режим ограничивает output tokens и обрезает длинные prompts для qwen2.5-coder:7b и deepseek-r1:8b.",
    lightweightContext: "Облегчённый context",
    lightweightContextNote: "Первый real Ollama run использует только employee profile и runtime profile — memory и knowledge пропускаются.",
    elapsedTime: "Прошло",
    timeoutLimit: "Лимит таймаута: {seconds} с",
    cancelExecution: "Отменить выполнение",
    errors: {
      timeout: "Превышено время выполнения",
      cancelled: "Выполнение отменено"
    },
    logsTitle: "Логи Runtime",
    logsEmpty: "Логи Runtime пока пусты.",
    capabilities: {
      embeddings: "Эмбеддинги"
    },
    healthStatuses: {
      healthy: "Исправен",
      degraded: "Деградация",
      unavailable: "Недоступен",
      mock: "Mock",
      unknown: "Неизвестно"
    }
  },
  runtimePromptBuilder: {
    empty: "Не удалось собрать превью prompt — выберите сотрудника и введите текст задачи.",
    leadHint: "ⓘ Здесь видно, какой prompt получит модель: идентичность сотрудника, контекст компании и формат отчёта Senior Engineer на русском.",
    explicitOverrideNote: "Режим явного prompt: финальный prompt отправляется как есть, без неявной сборки.",
    outputLanguage: "Язык ответа",
    outputLanguages: {
      ru: "Русский (по умолчанию)",
      en: "Английский (если задача требует)"
    },
    project: "Проект",
    workspace: "Рабочее пространство",
    copyPrompt: "Копировать prompt",
    exportPrompt: "Экспорт prompt",
    copied: "Скопировано в буфер обмена",
    copyFailed: "Не удалось скопировать в буфер обмена",
    sections: {
      systemPrompt: "Системный prompt",
      employeeIdentity: "Идентичность сотрудника",
      employeePersona: "Persona сотрудника",
      languagePolicy: "Политика языка",
      task: "Задача",
      context: "Контекст",
      instructions: "Инструкции",
      finalPrompt: "Финальный prompt"
    }
  },
  runtimeLive: {
    title: "Live-монитор Runtime",
    description: "Наблюдайте за execution цифрового сотрудника в реальном времени — pipeline, логи, здоровье провайдера, превью результата и downstream-интеграции.",
    launchTitle: "Запустить execution",
    executionStream: "Live-поток execution",
    executionStreamDescription: "Объединённый pipeline, логи провайдера и события timeline для активного запуска.",
    contextAndPreview: "Контекст Runtime + превью результата",
    bottomPanel: "Логи / события / предупреждения / превью prompt",
    selectedEmployee: "Выбранный сотрудник",
    currentStep: "Текущий шаг",
    elapsed: "Прошло",
    timeout: "Таймаут",
    liveBadge: "LIVE",
    streamEmpty: "Запустите runtime run, чтобы заполнить live-поток.",
    noRunSelected: "Runtime run не выбран — запустите execution Atlas или MAX выше.",
    integrations: "Интеграции",
    runHistory: "История запусков",
    reportLink: "Отчёт",
    employeeWorkspace: "Рабочее пространство сотрудника",
    reportCreation: "Создание отчёта",
    reportPending: "Отчёт будет создан после успешного execution.",
    resultPreview: "Превью результата",
    resultPending: "Ожидание ответа модели…",
    recentRuns: "Недавние запуски",
    principleNote: "Live-монитор читает локальные runtime runs, логи провайдера и события компании — без внешней телеметрии в V1.",
    localOnly: "Опрашивает localStorage каждые 500 мс, пока run активен.",
    tabs: {
      logs: "Логи",
      events: "События",
      warnings: "Предупреждения",
      promptPreview: "Превью Prompt"
    },
    eventsEmpty: "Событий timeline для этого run пока нет."
  },
  handoffEngine: {
    pageDescription: "Протокол передачи реальной работы — цифровые сотрудники готовят пакеты для Codex, Claude Code, Cursor или людей. Без внешнего execution в V1.",
    openPhotoLab: "AI Photo Lab",
    createSample: "Создать sample handoff",
    catalogTitle: "Каталог handoff",
    previewTitle: "Превью пакета",
    filtersTitle: "Фильтры",
    templatesTitle: "Шаблоны handoff",
    projectPanelTitle: "Внешние handoff работы",
    projectPanelDescription: "Подготовленные пакеты для Codex, Cursor, QA, DevOps и human executors. Owner одобряет перед отправкой; результаты возвращаются в AI Company.",
    projectEmpty: "Handoff для этого проекта пока нет.",
    openAll: "Все handoffs",
    openDetails: "Открыть детали",
    selectHandoff: "Выберите handoff для превью пакета.",
    empty: "Handoff пока нет — активируйте AI Photo Lab или создайте sample handoff.",
    notFoundTitle: "Handoff не найден",
    notFoundDescription: "Этот handoff отсутствует в local storage.",
    backToHandoffs: "Назад к handoffs",
    openProject: "Открыть проект",
    openReport: "Открыть отчёт",
    relatedHandoffs: "Связанные handoffs",
    packageNotReady: "Пакет ещё не собран — сначала подготовьте handoff.",
    missingTemplateNote: "Handoff template \"{id}\" is not registered — showing stored package and metadata in degraded mode.",
    noChecklist: "Нет пунктов checklist.",
    principleNote: "Правило handoff: цифровые сотрудники готовят работу, Owner одобряет, внешний executor выполняет, результат возвращается в AI Company с отчётом и обновлениями timeline.",
    localOnly: "Хранится в localStorage (ai-company-handoffs) — только mock-протокол, без Codex/Cursor API.",
    stats: {
      total: "Всего handoffs",
      ready: "Готово",
      inProgress: "Отправлено / в работе",
      accepted: "Принято"
    },
    sections: {
      context: "Контекст",
      instructions: "Инструкции",
      checklist: "Checklist",
      package: "Пакет handoff",
      result: "Возвращённый результат"
    },
    package: {
      projectContext: "Контекст проекта",
      taskContext: "Контекст задачи",
      currentState: "Текущее состояние",
      files: "Файлы / пути",
      constraints: "Ограничения",
      commands: "Команды",
      acceptanceCriteria: "Критерии приёмки",
      expectedResponseFormat: "Ожидаемый формат ответа"
    },
    fields: {
      target: "Цель",
      status: "Статус",
      project: "Проект",
      workspace: "Рабочее пространство",
      task: "Задача",
      preparedBy: "Подготовил",
      paths: "Связанные пути",
      expectedResult: "Ожидаемый результат",
      deliveredAt: "Доставлено",
      responseFormat: "Формат ответа",
      artifacts: "Артефакты",
      blockers: "Блокеры"
    },
    actions: {
      prepare: "Собрать пакет",
      requestApproval: "Запросить согласование Owner",
      send: "Отправить handoff (mock)",
      markInProgress: "Отметить в работе",
      mockReturn: "Mock внешнего возврата",
      accept: "Принять результат",
      reject: "Отклонить результат",
      cancel: "Отменить handoff"
    },
    priorities: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      critical: "Критичный"
    },
    mockReturn: {
      summary: "Mock внешний результат возвращён в AI Company.",
      responseFormat: "Markdown summary",
      changedFiles: "Изменённые файлы",
      notes: "Только mock return — без Codex/Cursor API в V1."
    },
    rejectReasons: {
      needsRevision: "Нужна доработка перед принятием."
    },
    targets: {
      codex: "Codex",
      claude_code: "Claude Code",
      cursor: "Cursor",
      human_developer: "Human Developer",
      devops: "DevOps",
      designer: "Дизайнер",
      qa: "QA"
    },
    statuses: {
      draft: "Черновик",
      ready: "Готово",
      sent: "Отправлено",
      in_progress: "В работе",
      returned: "Возвращено",
      accepted: "Принято",
      rejected: "Отклонено",
      cancelled: "Отменено"
    }
  },
  runtimeOrchestrator: {
    pageDescription: "Single entry point для execution digital employee — coordinates domains, routes models, emits events. Mock-only в V1.",
    runPageTitle: "Запуск Runtime",
    notFoundTitle: "Runtime run не найден",
    notFoundDescription: "Этот run отсутствует в local storage.",
    backToRuntime: "Назад к Runtime",
    runsCatalog: "Недавние запуски",
    startRun: "Запустить runtime run",
    startRunFromTask: "Запуск через Orchestrator",
    startRunFromChat: "Запуск через Orchestrator",
    grantApprovalMock: "Предоставить согласование (mock)",
    waitingApprovalNote: "Run приостановлен на approval gate — для завершения нужно mock-согласование Owner.",
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
    contextTitle: "Контекст Runtime",
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
    pipelineStepStatuses: {
      pending: "Ожидает",
      active: "Активно",
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
      run_model_router: "Запуск Model Router",
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
      runtime_profile: "Профиль Runtime"
    }
  },
  memoryEngine: {
    title: "Память сотрудника",
    pageTitle: "{name} — Память",
    pageDescription: "Долговременная память, принадлежащая сотруднику — независимо от модели Claude, Qwen или runtime provider.",
    backToProfile: "Назад к профилю",
    openMemory: "Открыть память",
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
  memoryEvolution: {
    todayTitle: "Сегодня усвоено",
    runEvolutionTitle: "Эволюция памяти после этого запуска",
    todayLearned: "Уроков сегодня",
    experienceGained: "Опыт получен",
    knowledgeAdded: "Знаний добавлено",
    memoryAdded: "Записей памяти",
    empty: "Завершите runtime-задачу, чтобы развить memory и knowledge сотрудника.",
    noLessons: "Из этого completion уроки не извлечены.",
    categories: {
      finding: "Находка",
      mistake: "Ошибка",
      improvement: "Улучшение",
      knowledge: "База знаний"
    },
    flowNote: "Runtime → отчёт → усвоенные уроки → память сотрудника → знания проекта → опыт"
  },
  runtimeModelRouting: {
    title: "Model routing",
    runTaskModeTitle: "Runtime model mode",
    empty: "Выберите сотрудника, чтобы увидеть resolved Ollama routing.",
    provider: "Провайдер",
    executionProvider: "Execution provider",
    runtimeProfile: "Runtime profile",
    modelMode: "Model mode",
    catalogModel: "Selected catalog model",
    resolvedOllamaModel: "Resolved Ollama model",
    estimatedSpeed: "Estimated speed",
    estimatedContext: "Estimated context",
    expectedTimeout: "Expected timeout",
    contextTokens: "{count} tokens",
    timeoutSeconds: "{seconds}s",
    modes: {
      fast: "Fast",
      deep: "Глубокий",
      coding: "Разработка",
      qa: "QA"
    },
    modeHints: {
      fast: "deepseek-r1:8b · Atlas quick analysis",
      deep: "qwen3.6:27b · Atlas deep reasoning",
      coding: "qwen2.5-coder:7b · MAX implementation",
      qa: "deepseek-r1:8b · QA review"
    }
  },
  runtimeMonitor: {
    title: "Runtime: стоимость и производительность",
    pageDescription: "Локальные оценки стоимости моделей, длительности и throughput — без внешних billing API.",
    runs: "запуски",
    fields: {
      model: "Модель",
      provider: "Провайдер",
      duration: "Длительность",
      cpuTime: "CPU Time",
      tokens: "Est. Tokens",
      cost: "Est. Cost",
      status: "Статус",
      employee: "Сотрудник"
    },
    dashboard: {
      averageRuntime: "Средний runtime",
      longestRun: "Самый долгий run",
      timeoutRate: "Timeout Rate",
      completedToday: "Завершено сегодня",
      costToday: "Стоимость сегодня",
      fastModels: "Быстрые модели",
      heavyModels: "Тяжёлые модели",
      topEmployees: "Топ сотрудников",
      topModels: "Топ моделей",
      recentRuns: "Недавние runs"
    },
    empty: {
      fastModels: "Быстрых моделей пока нет — нужны runs со средним временем до 15с.",
      heavyModels: "Тяжёлых моделей пока нет — стоимость ниже порога.",
      topEmployees: "Активности сотрудников по runtime пока нет.",
      topModels: "Использования моделей пока нет."
    }
  },
  guidedExperience: {
    nextStepLabel: "Следующий шаг",
    learnMore: "Подробнее о flow",
    moreDetails: "Подробнее",
    hideDetails: "Скрыть",
    openDocs: "Открыть документацию",
    termsLabel: "Ключевые термины",
    openTermInHelp: "Открыть в справочном центре",
    tooltipHelpCta: "Нажмите, чтобы открыть справочный центр",
    helpCenter: {
      title: "Справочный центр",
      subtitle: "Глоссарий платформы — любой термин понятен за один клик.",
      searchPlaceholder: "Поиск терминов…",
      close: "Закрыть",
      openAria: "Открыть справочный центр",
      allTerms: "Все термины",
      noResults: "Нет терминов по запросу.",
      selectTerm: "Выберите термин для подробностей."
    },
    termSections: {
      summary: "Кратко",
      description: "Подробно",
      whereUsed: "Где используется",
      related: "Связанные страницы"
    },
    sections: {
      whatItIs: "Что это",
      purpose: "Для чего используется",
      onScreen: "Что происходит на экране",
      nextStep: "Следующий шаг",
      downstream: "Используется дальше"
    },
    pages: {
      commandCenter: {
        title: "Компания одним взглядом",
        hint: "Ежедневный кокпит Owner — здоровье компании, люди, согласования и runtime в одном экране.",
        whatItIs: "Главный операционный дашборд AI Company.",
        purpose: "Дать Owner целостную картину перед назначением работы или принятием решений.",
        onScreen: "Утренний бриф, активность сотрудников, прогресс спринта, ожидающие согласования, стоимость runtime, события хронологии и быстрые действия.",
        nextStep: "Проверьте критические алерты и согласования, затем откройте «Операционный день» для полного дневного сценария.",
        downstream: "Питает приоритеты операционного дня, уведомления и рекомендуемые действия в Run Task и Control Room.",
        learnMorePath: "/ops/day",
        docsPath: "/ops/timeline"
      },
      runTask: {
        title: "Назначить задачу цифровому сотруднику",
        hint: "Сформулируйте задачу, выберите сотрудника и запустите реальный runtime-запуск.",
        whatItIs: "Главная точка входа Owner для постановки работы цифровым сотрудникам.",
        purpose: "Превратить намерение Owner в задачу, runtime-запуск, отчёт и результат на проверку.",
        onScreen: "Текст задачи, выбор сотрудника и режима, контекст проекта/workspace, превью маршрутизации модели и история запусков.",
        nextStep: "Сформулируйте задачу, выберите Atlas или MAX, нажмите «Запустить» и следите за выполнением в Live Runtime.",
        downstream: "Создаёт задачи, runtime-запуски, отчёты, результаты, события хронологии и эволюцию памяти.",
        learnMorePath: "/ops/runtime/live",
        docsPath: "/ops/task-results"
      },
      runtime: {
        title: "Настройки Runtime",
        hint: "Настройте провайдеры, профили, health-check и просмотрите прошлые запуски.",
        whatItIs: "Плоскость управления выполнением моделей в AI Company.",
        purpose: "Управлять подключением цифровых сотрудников к Ollama или mock-провайдерам и анализировать историю запусков.",
        onScreen: "Здоровье провайдеров, runtime-профили сотрудников, маршрутизация моделей, стоимость, недавние запуски, логи и панель быстрого execution.",
        nextStep: "Проверьте health провайдера и стоимость за сегодня, затем откройте Live Runtime или Run Task для следующего запуска.",
        downstream: "Запуски формируют отчёты, результаты задач, память сотрудников и записи хронологии для Task Results и профиля сотрудника.",
        learnMorePath: "/ops/runtime/live",
        docsPath: "/ops/runs"
      },
      runtimeLive: {
        title: "Live-монитор Runtime",
        hint: "Смотрите pipeline, логи, превью prompt и результат во время выполнения.",
        whatItIs: "Наблюдение за активным или недавним runtime-запуском в реальном времени.",
        purpose: "Показать Owner, что именно получает модель и как идёт выполнение.",
        onScreen: "Шаги pipeline, live-поток, статус провайдера, время выполнения, слои контекста, превью prompt и превью результата.",
        nextStep: "Выберите или запустите run, откройте «Превью Prompt», дождитесь завершения и проверьте связанный отчёт.",
        downstream: "Завершённые запуски обновляют отчёты, результаты задач, эволюцию памяти и хронологию сотрудника.",
        learnMorePath: "/ops/runtime",
        docsPath: "/ops/runs"
      },
      operatingDay: {
        title: "Как компания проходит день",
        hint: "Пройдите рабочий день компании от утреннего брифа до вечерней сводки.",
        whatItIs: "Повествовательная карта того, как цифровая компания проводит рабочий день.",
        purpose: "Помочь Owner закрывать блокеры по порядку — люди, работа, согласования, runtime, отчёты.",
        onScreen: "Фазы: утро, сотрудники, текущая работа, встречи, согласования, метрики runtime, отчёты и вечернее подведение итогов.",
        nextStep: "Идите по фазам сверху вниз и закройте ожидающие согласования до конца дня.",
        downstream: "Связан с Command Center, Control Room, Task Results и Runtime для follow-up действий.",
        learnMorePath: "/ops",
        docsPath: "/ops/approvals"
      },
      employeeProfile: {
        title: "Профиль сотрудника",
        hint: "Идентичность, навыки, память, история runtime и живая хронология одного цифрового сотрудника.",
        whatItIs: "Долгоживущая запись цифрового сотрудника в вашей компании.",
        purpose: "Понять, кто этот сотрудник, чему научился и что сдал за время работы.",
        onScreen: "Паспорт идентичности, живая хронология, навыки, разрешения, память, знания, назначения, runtime и presence.",
        nextStep: "Просмотрите живую хронологию, затем откройте Workspace или Run Task для следующей задачи.",
        downstream: "Данные профиля влияют на маршрутизацию Run Task, эволюцию памяти, результаты задач и staffing в Control Room.",
        learnMorePath: "/ops/employees/ag-cto/workspace",
        docsPath: "/ops/employees"
      },
      taskResults: {
        title: "Итоги выполненной работы",
        hint: "Проверяйте результаты после runtime-запусков — одобряйте или запрашивайте правки.",
        whatItIs: "Очередь Owner на проверку завершённой работы сотрудников.",
        purpose: "Контролировать качество перед эволюцией памяти, рекомендациями и downstream handoffs.",
        onScreen: "Список результатов, фильтры статуса, панель проверки, сводка эволюции памяти и рекомендуемые действия.",
        nextStep: "Откройте последний результат, проверьте вывод, одобрите или запросите правки, затем посмотрите рекомендации.",
        downstream: "Одобренные результаты обновляют отчёты, память сотрудника, планировщик работ и статус delivery в Control Room.",
        learnMorePath: "/ops/reports",
        docsPath: "/ops/approvals"
      },
      controlRoom: {
        title: "Command post delivery проекта",
        hint: "Командный пункт delivery AI Photo Lab — очередь, риски, handoffs и готовность к демо.",
        whatItIs: "Операционный центр delivery на уровне проекта.",
        purpose: "Отслеживать прогресс спринта, активность runtime, риски и внешние handoffs в одном месте.",
        onScreen: "Очередь задач, снимок команды, статистика runtime, риски, чеклист демо, согласования, Codex handoffs и рекомендации.",
        nextStep: "Проверьте риски и очередь, одобрите handoffs и запустите следующую задачу через Run Task.",
        downstream: "Статус Control Room агрегируется в Command Center, Operating Day и пресеты Kickoff.",
        learnMorePath: "/ops/projects/project-ai-photo-lab/kickoff",
        docsPath: "/ops/handoffs"
      },
      kickoff: {
        title: "Старт проекта AI Photo Lab",
        hint: "Подготовьте demo-ready спринт с пресетами для Atlas и MAX.",
        whatItIs: "Экран старта delivery проекта AI Photo Lab.",
        purpose: "Согласовать цель спринта, пресеты команды, QA-чеклист и первые задачи до tracking в Control Room.",
        onScreen: "Цель спринта, статистика, preset-задачи, QA-чеклист, ссылки на документацию и запуск одним кликом.",
        nextStep: "Запустите preset-задачу для Atlas или MAX, затем перейдите в Control Room для мониторинга delivery.",
        downstream: "Задачи Kickoff идут в Runtime, Task Results, handoffs и прогресс Control Room.",
        learnMorePath: "/ops/projects/project-ai-photo-lab/control-room",
        docsPath: "/ops/sprint/sprint-apl-1"
      },
      visualLab: {
        title: "Visual Execution Lab",
        hint: "Проиграйте работу цифрового сотрудника — редактор, браузер, терминал и хронология действий.",
        whatItIs: "Визуальная песочница для понимания flow выполнения сотрудника.",
        purpose: "Объяснить поведение runtime заинтересованным лицам без live-вызова модели.",
        onScreen: "Боковая панель сессии, редактор кода, превью браузера, вывод терминала и пошаговая хронология действий.",
        nextStep: "Нажмите play на хронологии, пройдите шаги и сравните с реальным запуском в Live Runtime.",
        downstream: "Концепции связаны с Run Task, превью prompt в Live Runtime и активностью workspace сотрудника.",
        learnMorePath: "/ops/run-task",
        docsPath: "/ops/runtime/live"
      },
      workspace: {
        title: "Рабочий стол одного сотрудника",
        hint: "Ежедневный стол одного сотрудника — задачи, запуски, чаты и уведомления в его scope.",
        whatItIs: "Рабочая поверхность с scope одного цифрового сотрудника.",
        purpose: "Видеть, чем занят сотрудник сейчас, без шума всей компании.",
        onScreen: "Быстрые действия, текущая работа, недавние запуски, чаты, отчёты, уведомления и рекомендации.",
        nextStep: "Проверьте текущую активность, затем перейдите в Run Task или Task Results для детального review.",
        downstream: "Активность workspace отображается в хронологии профиля и снимках команды Control Room.",
        learnMorePath: "/ops/presence",
        docsPath: "/ops/employees"
      }
    },
    terms: platformGlossaryTermsRu,
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
    title: "Обучение",
    pageTitle: "{name} — Обучение",
    pageDescription: "Непрерывный рост компетенций — цели, сессии, рекомендации и прогресс навыков со временем.",
    backToProfile: "Назад к профилю",
    openLearning: "Открыть обучение",
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
    title: "Планирование спринта",
    pageDescription: "Спринт 1 для AI Photo Lab — цель, ёмкость, commitment, backlog и board готовы для старта цифровой команды в понедельник.",
    openSprint: "Открыть Спринт 1",
    openControlRoom: "Control Room",
    openProject: "Открыть проект",
    openExecution: "Очередь execution",
    openRuntime: "Runtime",
    start: "Запустить",
    end: "Завершить",
    workingDays: "рабочих дней",
    commitment: "Commitment",
    committed: "взято в работу",
    capacityTotal: "Ёмкость",
    capacityRemaining: "Оставшаяся ёмкость",
    definitionOfReady: "Definition of Ready",
    definitionOfDone: "Definition of Done",
    reviewNotes: "Заметки спринта",
    plannedSprints: "запланировано",
    tasks: "задач",
    storyPointsShort: " СП",
    remaining: "Осталось (burndown)",
    ideal: "Идеально",
    burndownNote: "Mock burndown — оставшиеся story points vs идеальная линия для Спринта 1.",
    dayProgress: "День {elapsed} из {total} (старт в понедельник)",
    localNote: "Только планирование — без execution задач. Данные спринта в localStorage; задачи синхронизированы из delivery backlog.",
    notFoundTitle: "Спринт не найден",
    notFoundDescription: "Активируйте AI Photo Lab и перезагрузите страницу для seed Спринта 1.",
    status: {
      planned: "Планируемые",
      active: "Активные",
      review: "Проверка",
      completed: "Завершено",
      cancelled: "Отменено"
    },
    health: {
      on_track: "По плану",
      at_risk: "Под риском",
      blocked: "Заблокировано"
    },
    columns: {
      ready: "Готово",
      in_sprint: "В спринте",
      review: "Проверка",
      done: "Готово",
      blocked: "Заблокировано"
    },
    metrics: {
      completed: "Завершено",
      remaining: "Осталось",
      blocked: "Заблокировано",
      progress: "Прогресс",
      velocity: "Velocity (mock)",
      health: "Здоровье спринта"
    },
    sections: {
      goal: "Цель спринта",
      progress: "Прогресс спринта",
      capacity: "Ёмкость и commitment",
      backlog: "Backlog спринта",
      board: "Доска спринта",
      burndown: "Burndown",
      review: "DoR / DoD / Review",
      links: "Быстрые ссылки"
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
      agenda: "Повестка",
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
      title: "Сводка дня",
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
      openWorkday: "Рабочий день"
    },
    workspace: {
      title: "Рабочий день сегодня",
      noWorkday: "Рабочий день ещё не начат.",
      openDashboard: "Дашборд рабочего дня компании"
    }
  },
  operatingDayEngine: {
    title: "Рабочий день компании",
    pageDescription: "Полный рабочий день цифровой компании — утренний brief, команда, deliveries, встречи, согласования, runtime, отчёты и вечерняя сводка.",
    localNote: "Агрегировано из локальных mock-данных — без scheduler и backend.",
    linksAria: "Быстрые ссылки рабочего дня",
    flowAria: "Поток рабочего дня",
    timeOfDay: {
      morning: "Утро",
      afternoon: "День",
      evening: "Вечер"
    },
    phases: {
      morning: "Утренний brief",
      employees: "Сотрудники",
      currentWork: "Текущая работа",
      meetings: "Встречи",
      approvals: "Согласования",
      runtime: "Runtime",
      reports: "Отчёты",
      endOfDay: "Конец дня"
    },
    sections: {
      morningBrief: "Утренний brief",
      priorities: "Приоритеты на сегодня",
      employeesStarted: "Сотрудники начали день",
      sprintProgress: "Прогресс спринта",
      risks: "Риски на сегодня",
      approvals: "Ожидающие согласования",
      meetings: "Встречи",
      deliveries: "Deliveries",
      runtime: "Runtime",
      reports: "Отчёты",
      companyHealth: "Здоровье компании",
      eveningSummary: "Вечерняя сводка"
    },
    links: {
      commandCenter: "Command Center",
      runtime: "Runtime",
      kickoff: "Kickoff",
      controlRoom: "Control Room",
      taskResults: "Task Results",
      timeline: "Timeline",
      workspace: "Workspace"
    },
    empty: {
      priorities: "Приоритеты на сегодня не выделены.",
      employeesStarted: "Сотрудники ещё не начали рабочий день.",
      risks: "На delivery board нет активных рисков.",
      deliveries: "Нет активных deliveries в работе.",
      meetings: "На сегодня нет collaboration-сессий."
    },
    evening: {
      finished: "Завершили день",
      reportsToday: "Отчётов сегодня",
      tasksActive: "Задач в работе",
      approvalsPending: "Ожидают согласования",
      runtimeCompleted: "Runtime завершено",
      avgPhase: "Средняя фаза workday",
      note: "Снимок конца дня — синхронизируйте фазы workday или завершите день из workspace сотрудников."
    }
  },
  employeeOperatingDay: {
    title: "Сегодня",
    pageTitle: "{name} — Сегодня",
    pageDescription:
      "Рабочий день сотрудника — статус workday, прогресс задач, часы, консультации, решения, отчёты и итог дня.",
    heroDescription: "Operating Day Workspace для {name}. Это не MAX Workspace.",
    notFoundDescription: "Сотрудник не найден или рабочий день недоступен.",
    openProfile: "Профиль сотрудника",
    openCurrentTask: "Открыть задачу",
    currentTaskTitle: "Текущая задача",
    daySummaryTitle: "Итог дня",
    noCurrentTask: "В очереди нет активной задачи.",
    noDaySummary: "Итог появится после задач или при завершении рабочего дня.",
    startedAt: "Начало",
    finishedAt: "Завершение",
    yes: "Да",
    no: "Нет",
    hoursShort: "ч",
    minutesShort: "мин",
    localNote: "Агрегация из Workday, Daily Journal и Work Queue — только localStorage.",
    status: {
      not_started: "Не начат",
      active: "Активен",
      paused: "На паузе",
      finished: "Завершён"
    },
    actions: {
      start: "Начать рабочий день",
      continue: "Продолжить",
      finish: "Завершить день",
      pause: "Приостановить",
      resume: "Возобновить"
    },
    metrics: {
      workdayStarted: "Рабочий день начался",
      tasksCompleted: "Задач выполнено",
      tasksRemaining: "Осталось задач",
      workHours: "Часов работы",
      consultations: "Консультаций",
      decisions: "Решений",
      reports: "Отчётов"
    },
    operatingDaySummary: {
      title: "Итог рабочего дня",
      empty: "Итог рабочего дня появится после завершения дня.",
      dayStatus: "Статус дня",
      tasksCompleted: "Выполнено задач",
      tasksRemaining: "Осталось задач",
      tasksBlocked: "Заблокировано",
      workDuration: "Время работы",
      decisions: "Решения",
      models: "Модели",
      tools: "Инструменты",
      consultations: "Консультации",
      reportsCreated: "Созданные отчёты",
      nextDayRecommendations: "Рекомендации на следующий день",
      noItems: "—",
      usageCount: "{count}×"
    }
  },
  photoLabControlRoom: {
    title: "Control Room AI Photo Lab",
    pageDescription: "Control Room delivery — MVP readiness, нагрузка команды, handoff Codex и решения Owner с одного экрана.",
    openControlRoom: "Открыть Control Room",
    openKickoff: "Kickoff понедельника",
    openProject: "Открыть проект",
    openCanvas: "Открыть Canvas",
    openExecution: "Очередь execution",
    openRuntime: "Runtime",
    openReports: "Отчёты",
    openApprovals: "Согласования",
    deadline: "Дедлайн",
    progress: "Прогресс",
    health: "Здоровье",
    riskLevel: "Уровень риска",
    mvpReady: "Готовность MVP",
    tasksDone: "готово",
    tasksActive: "активен",
    demoReady: "demo checks готовы",
    noCurrentTask: "Нет активной задачи",
    ownerDecisions: "Требуются решения Owner",
    pendingApprovals: "Ожидающие согласования",
    reviewDecision: "Проверка",
    codexNote: "Задачи направляются в Codex по директиве Owner — цифровые сотрудники аудируют и планируют; Codex реализует в ~/projects/ai-photo-lab.",
    localNote: "Mock delivery data — только localStorage, без production или вызовов Ollama.",
    notFoundTitle: "Control Room недоступен",
    notFoundDescription: "Активируйте AI Photo Lab в projects для seed delivery data.",
    healthLevels: {
      on_track: "По плану",
      at_risk: "Под риском",
      critical: "Критический"
    },
    riskLevels: {
      low: "Низкий",
      medium: "Средний",
      high: "Высокий",
      critical: "Критический"
    },
    decisionKinds: {
      approval: "Согласование",
      review: "Review",
      decision: "Решение"
    },
    riskStatuses: {
      open: "Открыт",
      mitigated: "Смягчён",
      accepted: "Принят",
      closed: "Закрыт"
    },
    stats: {
      tasks: "Delivery-задачи",
      inProgress: "В процессе",
      demoReady: "Demo checks",
      decisions: "Решения Owner",
      codex: "Handoffs Codex"
    },
    sections: {
      mvpStatus: "Статус MVP",
      deliveryProgress: "Прогресс delivery",
      digitalTeam: "Цифровая команда",
      workNow: "Работа сейчас",
      deliveryTasks: "Delivery-задачи (13)",
      runtimeActivity: "Активность Runtime",
      codexHandoff: "Codex Handoff",
      demoReadiness: "Готовность к demo",
      reports: "Отчёты",
      risks: "Риски и блокеры",
      decisions: "Решения",
      quickLinks: "Быстрые ссылки"
    },
    workNow: {
      currentlyWorking: "Сейчас работают",
      waitingApproval: "Ожидание согласования",
      blocked: "Заблокировано",
      doneToday: "Завершено сегодня"
    },
    codexCategories: {
      complex_code: "Сложные изменения кода",
      bug_fix: "Исправления багов",
      production_deploy: "Production deployment",
      pdf_report: "PDF / report engine",
      ollama_integration: "Интеграция Ollama",
      ui_implementation: "Реализация UI"
    },
    demoItems: {
      local_run: "Локальный запуск",
      production_health: "Здоровье production",
      photo_upload: "Загрузка фото",
      ai_analysis: "AI-анализ",
      visual_zones: "Visual zones",
      manual_zone_edit: "Ручное редактирование зон",
      inspection_chat: "Inspection chat",
      report_history: "Отчёт / история",
      mobile_view: "Мобильный вид",
      deployment_checklist: "Deployment checklist"
    },
    empty: {
      working: "Нет задач в активном execution.",
      waiting: "Ничего не ожидает согласования.",
      blocked: "Блокеров нет.",
      doneToday: "Завершений сегодня пока нет.",
      runtime: "Runtime runs для этого проекта нет.",
      decisions: "Решений Owner не ожидается.",
      reports: "Черновиков отчётов пока нет.",
      risks: "Риски не зафиксированы."
    }
  },
  employeeWorkspace: {
    pageTitle: "{name} — рабочее место",
    pageDescription: "Личный desktop цифрового сотрудника — текущая работа, повестка, knowledge, handoffs, runtime и активность в одном месте.",
    openWorkspace: "Рабочее пространство",
    openProfile: "Открыть профиль",
    openRuntime: "Открыть Runtime",
    openExecution: "Очередь execution",
    openKnowledge: "Открыть knowledge",
    openReports: "Открыть отчёты",
    openChat: "Открыть чат",
    openNotifications: "Все уведомления",
    openApprovals: "Все согласования",
    overviewSummary: "Этот desktop агрегирует задачи, runtime, handoffs, knowledge, отчёты, чаты и решения в scope этого сотрудника.",
    noCurrentFocus: "Нет активного фокуса",
    noMessages: "Сообщений пока нет",
    unreadCount: "{count} непрочитанных уведомлений",
    notFoundTitle: "Workspace сотрудника не найден",
    notFoundDescription: "Сотрудник не существует или не удалось загрузить snapshot workspace.",
    principleNote: "Правило workspace: одна страница — кто я, над чем работаю, что ждёт моего решения и куда перейти дальше — без execution Runtime из этого view.",
    localOnly: "Агрегировано локально из tasks, executions, runtime runs, handoffs, knowledge, отчётов, чатов и events.",
    sections: {
      overview: "Кто я",
      today: "Сегодня",
      currentTasks: "Текущие задачи",
      currentRun: "Runtime",
      knowledge: "Назначенная knowledge",
      reports: "Недавние отчёты",
      chats: "Недавние чаты",
      notifications: "Уведомления",
      approvals: "Ожидает решения",
      pendingHandoffs: "Ожидающие handoffs",
      activity: "Моя активность",
      recentExecutions: "Недавние executions",
      recentRuns: "Недавние запуски"
    },
    fields: {
      primaryModel: "Основная модель",
      currentFocus: "Текущий фокус",
      openTasks: "Открытые задачи",
      pendingDecisions: "Ожидающие решения",
      workingOn: "Работает над"
    },
    agenda: {
      approval: "Согласование",
      handoff: "Handoff"
    },
    actions: {
      startWork: "Начать работу",
      openTask: "Открыть задачу",
      openRuntime: "Открыть Runtime",
      openKnowledge: "Открыть Knowledge",
      openChat: "Открыть чат",
      createReport: "Создать отчёт"
    },
    empty: {
      today: "На сегодня пока ничего не запланировано.",
      tasks: "Нет назначенных открытых delivery-задач.",
      currentRun: "Нет активного runtime run.",
      knowledge: "Назначений knowledge пока нет.",
      reports: "Этот сотрудник пока не создал отчётов.",
      chats: "Чатов с этим сотрудником пока нет.",
      notifications: "Уведомлений для этого сотрудника нет.",
      approvals: "Нет ожидающих согласований."
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
    notFoundDescription: "Сотрудник с таким ID не найден. Откройте список сотрудников или выберите другого коллегу.",
    noDescription: "Mission description не указано.",
    noSystemPrompt: "System prompt не настроен.",
    noWorkflow: "Workflow не определён.",
    noRestrictions: "Restrictions не настроены.",
    noSkills: "Навыки не назначены",
    noSkillsHint: "Добавляйте навыки при создании или редактировании сотрудника.",
    noMemoryScope: "Memory scope не настроен",
    noMemoryScopeHint: "Memory domains появятся здесь после назначения.",
    passport: {
      whoTitle: "Кто это",
      name: "Имя",
      role: "Роль",
      workTitle: "Чем занимается",
      responsibilities: "Основные обязанности",
      capabilities: "Возможности",
      boundaries: "Что НЕ делает",
      aiStackTitle: "AI Stack",
      primaryModel: "Основная модель",
      runtimeProvider: "Runtime provider",
      active: "активен",
      backupModels: "Backup models",
      toolAccess: "Tool access",
      decisionTitle: "Decision Authority",
      autonomous: "Может сам",
      ownerRequired: "Требует Owner",
      showPrompt: "Показать",
      hidePrompt: "Скрыть",
      copyPrompt: "Скопировать",
      copied: "Скопировано",
      copyFailed: "Не удалось скопировать",
      experienceTitle: "Опыт",
      xp: "XP",
      lessonsLearned: "Lessons learned",
      knowledge: "База знаний",
      memory: "Память",
      authorityItems: {
        write_code: "писать код",
        run_runtime: "запускать runtime",
        create_handoff: "создавать handoff",
        production: "Production",
        git_push: "Git push",
        merge: "Merge",
        deployment: "Deployment",
        cloud_execution: "Cloud execution"
      }
    },
    sections: {
      overview: "Обзор",
      timeline: "Хронология",
      skills: "Навыки",
      permissions: "Разрешения",
      memory: "Память",
      knowledge: "База знаний",
      relationships: "Связи",
      assignments: "Назначения",
      activity: "Активность",
      runtime: "Runtime",
      presence: "Присутствие",
      learning: "Обучение"
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
  employeeTimelineEngine: {
    title: "Живая хронология",
    description: "История жизни цифрового сотрудника — выполненная работа, полученные знания, согласования и handoffs в одном потоке.",
    filtersLabel: "Период хронологии",
    filters: {
      today: "Сегодня",
      week: "Неделя",
      all: "Все"
    },
    columns: {
      time: "Время",
      event: "Событие",
      project: "Проект",
      description: "Описание"
    },
    summary: {
      runtimeCompleted: "Запусков завершено",
      tasksApproved: "Задач одобрено",
      knowledgeLearned: "Знаний усвоено",
      memoryEvolved: "Записей памяти"
    },
    openSource: "Открыть источник",
    empty: "Нет активности за этот период — завершите runtime-запуск или одобрите результат задачи, чтобы наполнить историю.",
    kinds: {
      runtime_completed: "Runtime завершён",
      task_approved: "Задача одобрена",
      knowledge_learned: "Знание усвоено",
      memory_evolved: "Память обновлена",
      handoff_created: "Handoff создан",
      qa_passed: "QA пройден",
      owner_approval: "Согласование Owner",
      production_approved: "Production одобрен"
    }
  },
  livingCompany: {
    now: "сейчас",
    since: "{time} назад",
    doingNow: "Сейчас делает",
    fallback: "Работает над {context}",
    phases: {
      working: "Работает",
      thinking: "Думает",
      waiting: "Ожидает",
      reviewing: "На проверке",
      completed: "Завершено",
      idle: "Простой"
    },
    verbs: {
      atlas: {
        architecture: "Анализирует архитектуру…",
        task: "Анализирует {task}…"
      },
      max: {
        upload: "Проверяет upload flow…",
        task: "Аудит {task}…"
      },
      qa: {
        regression: "Выполняет регрессионное тестирование…",
        task: "Тестирует {task}…"
      },
      devops: {
        environment: "Проверяет окружение…",
        task: "Проверяет {task}…"
      },
      default: {
        task: "Работает над {task}…"
      }
    },
    pipeline: {
      receive_request: "Принимает запрос…",
      load_employee: "Загружает профиль сотрудника…",
      load_workspace: "Загружает workspace…",
      load_memory: "Читает память…",
      load_knowledge: "Загружает knowledge…",
      load_competencies: "Загружает компетенции…",
      load_runtime_profile: "Загружает runtime profile…",
      run_model_router: "Маршрутизирует вызов модели…",
      approval_check: "Ожидает одобрение Owner…",
      tool_gateway: "Выполняет tools…",
      create_run: "Создаёт запись run…",
      emit_event: "Отправляет event…",
      create_report: "Готовит отчёт…",
      complete: "Завершает…"
    },
    taskResult: {
      working: "Готовит результат",
      ready_for_review: "Готов к вашему ревью",
      reviewing: "Запрошены правки — доработка",
      completed: "Одобрено и завершено",
      waiting: "Ожидает ревью Owner",
      idle: "В архиве"
    },
    recentActivity: "Недавняя активность",
    noRecentActivity: "Нет недавней активности"
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
