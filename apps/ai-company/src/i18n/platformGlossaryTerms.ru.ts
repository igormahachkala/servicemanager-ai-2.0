import type { GlossaryTermMessages } from '../domain/guided/platformGlossary'

export const platformGlossaryTermsRu: Record<string, GlossaryTermMessages> = {
  runtime: {
    label: 'Runtime',
    summary:
      'Локальный execution engine для digital employees — собирает context, вызывает модели и создаёт reports.',
    tooltip:
      'Локальный execution engine для digital employees — собирает context, вызывает модели и создаёт reports.',
    description:
      'Runtime — on-device pipeline работы AI Company. Загружает profile, memory, knowledge и текст задачи; через Model Router вызывает provider; пишет logs; по завершении сохраняет reports, task results и обновления memory.',
    whereUsed:
      'Run Task, Live Runtime, Runtime Settings, runtime-страницы сотрудников, Control Room и фазы runtime в Operating Day.',
    related: [
      { label: 'Runtime Settings', path: '/ops/runtime' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Run Task', path: '/ops/run-task' },
    ],
  },
  workspace: {
    label: 'Workspace',
    summary:
      'Scope рабочей среды одного digital employee — задачи, runs, chats и notifications в одном месте.',
    tooltip:
      'Scope рабочей среды одного digital employee — задачи, runs, chats и notifications в одном месте.',
    description:
      'Workspace — daily desk одного сотрудника: текущие assignments, suggested actions, recent reports и workspace-scoped knowledge. Owner управляет одним agent без потери company-wide context.',
    whereUsed:
      'Employee Workspace, workspace switcher в header, секции сотрудников в Operating Day и панели команды в Control Room.',
    related: [
      { label: 'Workspaces', path: '/ops/workspaces' },
      { label: 'Employee Workspace', path: '/ops/employees/ag-max/workspace' },
      { label: 'Presence', path: '/ops/presence' },
    ],
  },
  sprint: {
    label: 'Sprint',
    summary: 'Time-boxed цикл delivery с goals, tasks и отслеживанием прогресса компании или проекта.',
    tooltip: 'Time-boxed цикл delivery с goals, tasks и отслеживанием прогресса компании или проекта.',
    description:
      'Sprint организует работу короткими циклами: stated goal, committed tasks и visibility прогресса. Связывает Kickoff presets, Control Room queue и Operating Day check-ins.',
    whereUsed: 'Sprint page, фаза sprint в Operating Day, sprint goal в Kickoff и delivery tracking в Control Room.',
    related: [
      { label: 'Sprint', path: '/ops/sprint' },
      { label: 'Operating Day', path: '/ops/day' },
      { label: 'Control Room', path: '/ops/projects/project-ai-photo-lab/control-room' },
    ],
  },
  controlRoom: {
    label: 'Control Room',
    summary: 'Project command post — queue, risks, runtime, approvals и handoffs на одном экране.',
    tooltip: 'Project command post — queue, risks, runtime, approvals и handoffs на одном экране.',
    description:
      'Control Room — delivery cockpit проекта (например AI Photo Lab): task queue, active runs, risk register, demo readiness, pending approvals и external handoffs для Owner без переключения экранов.',
    whereUsed: 'AI Photo Lab Control Room, ссылки из Kickoff и project-секции Operating Day.',
    related: [
      { label: 'Control Room', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Kickoff', path: '/ops/projects/project-ai-photo-lab/kickoff' },
      { label: 'Handoffs', path: '/ops/handoffs' },
    ],
  },
  kickoff: {
    label: 'Kickoff',
    summary: 'Structured старт проекта — sprint goal, team presets, QA checklist и one-click tasks.',
    tooltip: 'Structured старт проекта — sprint goal, team presets, QA checklist и one-click tasks.',
    description:
      'Kickoff переводит проект в executable state: sprint goal, preset tasks для digital employees, QA gates и переход в Control Room для ongoing delivery.',
    whereUsed: 'AI Photo Lab Kickoff и onboarding flows из Projects.',
    related: [
      { label: 'Kickoff', path: '/ops/projects/project-ai-photo-lab/kickoff' },
      { label: 'Control Room', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Run Task', path: '/ops/run-task' },
    ],
  },
  approval: {
    label: 'Approval',
    summary: 'Gate Owner перед sensitive actions — cloud runtime, tools, production changes или handoffs.',
    tooltip: 'Gate Owner перед sensitive actions — cloud runtime, tools, production changes или handoffs.',
    description:
      'Approvals защищают от необратимых или costly actions. Runtime может ждать approval cloud execution, tool use, publishing или отправки handoff external executor.',
    whereUsed:
      'Approvals inbox, Command Center alerts, Task Results review, Control Room gates и Work Scheduler suggestions.',
    related: [
      { label: 'Approvals', path: '/ops/approvals' },
      { label: 'Command Center', path: '/ops' },
      { label: 'Task Results', path: '/ops/task-results' },
    ],
  },
  taskResult: {
    label: 'Task Result',
    summary: 'Deliverable после Runtime run — output, review status и follow-up actions.',
    tooltip: 'Deliverable после Runtime run — output, review status и follow-up actions.',
    description:
      'Task Results фиксируют результат digital employee: artifacts, summary, review notes, approval state и ссылки на report. Точка перехода между execution и следующей planned work.',
    whereUsed: 'Task Results list/detail, workspace outcomes и inputs Work Scheduler.',
    related: [
      { label: 'Task Results', path: '/ops/task-results' },
      { label: 'Reports', path: '/ops/reports' },
      { label: 'Work Scheduler', path: '/ops/task-results' },
    ],
  },
  memory: {
    label: 'Memory',
    summary: 'Durable recall сотрудника — уроки и факты из completed runs и reviews.',
    tooltip: 'Durable recall сотрудника — уроки и факты из completed runs и reviews.',
    description:
      'Memory хранит то, что employee должен помнить между sessions: decisions, preferences, project facts и post-run lessons. Обновляется после review Task Results и reports, а не через переполнение live prompt.',
    whereUsed: 'Employee Memory, Runtime context assembly, memory evolution в Task Results и employee profile.',
    related: [
      { label: 'Employee Memory', path: '/ops/employees/ag-max/memory' },
      { label: 'Task Results', path: '/ops/task-results' },
      { label: 'Employees', path: '/ops/employees' },
    ],
  },
  knowledge: {
    label: 'Knowledge',
    summary: 'Curated library компании — documents, collections и reference material для Runtime context.',
    tooltip:
      'Curated library компании — documents, collections и reference material для Runtime context.',
    description:
      'Knowledge — shared reference material company/workspace scope. Runtime подтягивает vetted snippets в prompts для consistency с approved sources.',
    whereUsed: 'Knowledge pages, workspace knowledge tabs и Runtime prompt assembly.',
    related: [
      { label: 'Knowledge', path: '/ops/knowledge' },
      { label: 'Knowledge Collections', path: '/ops/knowledge/collections' },
      { label: 'Workspaces', path: '/ops/workspaces' },
    ],
  },
  canvas: {
    label: 'Canvas',
    summary: 'Visual map компании — structure, flows и live status на одной interactive surface.',
    tooltip: 'Visual map компании — structure, flows и live status на одной interactive surface.',
    description:
      'Company Canvas показывает organization, projects и execution health spatial overview. Помогает Owner видеть связи employees, workstreams и runtime activity.',
    whereUsed: 'Company Canvas page и preview widgets Command Center.',
    related: [
      { label: 'Company Canvas', path: '/ops/canvas' },
      { label: 'Command Center', path: '/ops' },
      { label: 'Timeline', path: '/ops/timeline' },
    ],
  },
  employee: {
    label: 'Employee',
    summary: 'Digital worker persona — profile, competencies, workspace, memory и runtime binding.',
    tooltip: 'Digital worker persona — profile, competencies, workspace, memory и runtime binding.',
    description:
      'Employee — configured AI agent с identity, role, tools, routing preferences и career-long competencies. Tasks назначаются employee; Runtime executes от его имени под oversight Owner.',
    whereUsed: 'Employees roster, profiles, workspaces, Run Task picker и Operating Day staffing.',
    related: [
      { label: 'Employees', path: '/ops/employees' },
      { label: 'Run Task', path: '/ops/run-task' },
      { label: 'Employee Profile', path: '/ops/employees/ag-max' },
    ],
  },
  runtimeProvider: {
    label: 'Runtime Provider',
    summary: 'Backend model calls — local, cloud или hybrid по run profile.',
    tooltip: 'Backend model calls — local, cloud или hybrid по run profile.',
    description:
      'Runtime Provider — execution backend run: какой API или local engine выполняет решение Model Router. Влияет на latency, cost, privacy и необходимость Approval перед cloud.',
    whereUsed: 'Runtime Settings, Live Runtime logs, provider panels и Cost Monitor.',
    related: [
      { label: 'Runtime Settings', path: '/ops/runtime' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Run History', path: '/ops/runs' },
    ],
  },
  modelRouter: {
    label: 'Model Router',
    summary: 'Выбирает model и provider из profile, task type, mode и cost limits.',
    tooltip: 'Выбирает model и provider из profile, task type, mode и cost limits.',
    description:
      'Model Router мапит run на catalog model и provider: runtime profile, task classification, fast/deep/coding/qa mode и budget guards — без ручного выбора модели каждый раз.',
    whereUsed: 'Run Task routing preview, Runtime Settings, Live Runtime side panel и employee runtime.',
    related: [
      { label: 'Runtime Settings', path: '/ops/runtime' },
      { label: 'Run Task', path: '/ops/run-task' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
    ],
  },
  promptBuilder: {
    label: 'Prompt Builder',
    summary: 'Собирает structured instructions — system role, task, context, tools и output policy.',
    tooltip: 'Собирает structured instructions — system role, task, context, tools и output policy.',
    description:
      'Prompt Builder формирует final prompt: persona, memory snippets, knowledge refs, tool definitions и output constraints. Run Task и Live Runtime показывают preview перед execution.',
    whereUsed: 'Run Task, Live Runtime prompt preview, Runtime execution panels и Visual Lab.',
    related: [
      { label: 'Run Task', path: '/ops/run-task' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Visual Lab', path: '/ops/visual-lab' },
    ],
  },
  operatingDay: {
    label: 'Operating Day',
    summary: 'Owner daily flow — brief, employees, sprint, approvals, runtime и end-of-day wrap-up.',
    tooltip: 'Owner daily flow — brief, employees, sprint, approvals, runtime и end-of-day wrap-up.',
    description:
      'Operating Day задаёт последовательность управления компанией за день: morning brief, who is working, sprint status, approval backlog, runtime health и closing summary с ссылками на нужные экраны.',
    whereUsed: 'Operating Day page, Command Center next steps и quick navigation.',
    related: [
      { label: 'Operating Day', path: '/ops/day' },
      { label: 'Command Center', path: '/ops' },
      { label: 'Approvals', path: '/ops/approvals' },
    ],
  },
  handoff: {
    label: 'Handoff',
    summary: 'Approved package context и instructions для external executor после sign-off Owner.',
    tooltip: 'Approved package context и instructions для external executor после sign-off Owner.',
    description:
      'Handoffs связывают AI Company с Codex, Cursor или humans. Runtime готовит context и artifacts; Owner approves; package экспортируется для execution вне local Runtime loop.',
    whereUsed: 'Handoffs inbox, Control Room external work, Kickoff follow-ups и approval workflows.',
    related: [
      { label: 'Handoffs', path: '/ops/handoffs' },
      { label: 'Control Room', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Approvals', path: '/ops/approvals' },
    ],
  },
  execution: {
    label: 'Execution',
    summary: 'Active и queued work — runs, tool calls и pipeline steps компании.',
    tooltip: 'Active и queued work — runs, tool calls и pipeline steps компании.',
    description:
      'Execution — in-flight Runtime runs, tool invocations и orchestrated steps. Execution Queue и Live Runtime показывают что running, blocked on approval или finished recently.',
    whereUsed: 'Execution Queue, Live Runtime, Run History и runtime widgets Command Center.',
    related: [
      { label: 'Execution Queue', path: '/ops/execution' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Run History', path: '/ops/runs' },
    ],
  },
  report: {
    label: 'Report',
    summary: 'Structured narrative output completed run — findings, steps и attachments.',
    tooltip: 'Structured narrative output completed run — findings, steps и attachments.',
    description:
      'Reports документируют Runtime run в readable form. Питают Task Results, memory updates, Operating Day summaries и Owner review перед закрытием work.',
    whereUsed: 'Reports library, Task Result details, employee workspace и Command Center recent reports.',
    related: [
      { label: 'Reports', path: '/ops/reports' },
      { label: 'Task Results', path: '/ops/task-results' },
      { label: 'Command Center', path: '/ops' },
    ],
  },
  timeline: {
    label: 'Timeline',
    summary: 'Chronological feed компании — runs, approvals, handoffs и notable events.',
    tooltip: 'Chronological feed компании — runs, approvals, handoffs и notable events.',
    description:
      'Timeline агрегирует events в audit-friendly stream. Дополняет Command Center snapshots когда Owner нужна history, а не current state.',
    whereUsed: 'Company Timeline, Mission Feed redirects и cross-links Command Center.',
    related: [
      { label: 'Company Timeline', path: '/ops/timeline' },
      { label: 'Activity', path: '/ops/activity' },
      { label: 'Command Center', path: '/ops' },
    ],
  },
  workScheduler: {
    label: 'Work Scheduler',
    summary: 'Suggested next actions после Task Result — approve, rerun, hand off или dismiss.',
    tooltip: 'Suggested next actions после Task Result — approve, rerun, hand off или dismiss.',
    description:
      'Work Scheduler превращает completed output в plan: prioritized suggestions по Task Result, часто с Owner approval перед next Runtime task или external handoff.',
    whereUsed: 'Task Result details, employee workspace, Control Room panels и post-run review.',
    related: [
      { label: 'Task Results', path: '/ops/task-results' },
      { label: 'Run Task', path: '/ops/run-task' },
      { label: 'Approvals', path: '/ops/approvals' },
    ],
  },
  costMonitor: {
    label: 'Cost Monitor',
    summary: 'Token spend и provider usage per run, employee и day.',
    tooltip: 'Token spend и provider usage per run, employee и day.',
    description:
      'Cost Monitor показывает Runtime spend против limits: tokens, estimated cost и provider breakdown. Помогает Owner решать cloud runs и switch modes до превышения budget.',
    whereUsed: 'Live Runtime monitor panels, Runtime Settings и employee runtime dashboards.',
    related: [
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Runtime Settings', path: '/ops/runtime' },
      { label: 'Run History', path: '/ops/runs' },
    ],
  },
}
