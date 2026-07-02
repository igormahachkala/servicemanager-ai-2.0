import type { GlossaryTermMessages } from '../domain/guided/platformGlossary'

export const platformGlossaryTermsEn: Record<string, GlossaryTermMessages> = {
  runtime: {
    label: 'Runtime',
    summary:
      'Local execution engine that runs digital employees — assembles context, calls models, and produces reports.',
    tooltip:
      'Local execution engine that runs digital employees — assembles context, calls models, and produces reports.',
    description:
      'Runtime is the on-device pipeline for AI Company work. It loads employee profile, memory, knowledge, and task text; routes to a provider through the Model Router; streams logs; and writes reports, task results, and memory updates when a run completes.',
    whereUsed:
      'Run Task, Live Runtime, Runtime Settings, employee runtime pages, Control Room activity, and Operating Day runtime phases.',
    related: [
      { label: 'Runtime Settings', path: '/ops/runtime' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Run Task', path: '/ops/run-task' },
    ],
  },
  workspace: {
    label: 'Workspace',
    summary:
      'Scoped working environment for one digital employee — tasks, runs, chats, and notifications in one place.',
    tooltip:
      'Scoped working environment for one digital employee — tasks, runs, chats, and notifications in one place.',
    description:
      'A Workspace is the daily desk for a single employee. It aggregates current assignments, suggested next actions, recent reports, and workspace-scoped knowledge so the Owner can manage one agent without losing company-wide context.',
    whereUsed:
      'Employee Workspace page, workspace switcher in the header, Operating Day employee sections, and Control Room team panels.',
    related: [
      { label: 'Workspaces', path: '/ops/workspaces' },
      { label: 'Employee Workspace', path: '/ops/employees/ag-max/workspace' },
      { label: 'Presence', path: '/ops/presence' },
    ],
  },
  sprint: {
    label: 'Sprint',
    summary: 'Time-boxed delivery cycle with goals, tasks, and progress tracking for the company or a project.',
    tooltip:
      'Time-boxed delivery cycle with goals, tasks, and progress tracking for the company or a project.',
    description:
      'Sprints organize work into short cycles with a stated goal, committed tasks, and burndown-style visibility. They connect Kickoff presets, Control Room queues, and Operating Day check-ins so demo and production work stay aligned.',
    whereUsed: 'Sprint page, Operating Day sprint phase, Kickoff sprint goal, and Control Room delivery tracking.',
    related: [
      { label: 'Sprint', path: '/ops/sprint' },
      { label: 'Operating Day', path: '/ops/day' },
      { label: 'Control Room', path: '/ops/projects/project-ai-photo-lab/control-room' },
    ],
  },
  controlRoom: {
    label: 'Control Room',
    summary: 'Project command post — queue, risks, runtime activity, approvals, and handoffs in one view.',
    tooltip:
      'Project command post — queue, risks, runtime activity, approvals, and handoffs in one view.',
    description:
      'Control Room is the delivery cockpit for a project such as AI Photo Lab. It surfaces the task queue, active runtime runs, risk register, demo readiness, pending approvals, and external handoffs so the Owner can steer execution without switching screens.',
    whereUsed: 'AI Photo Lab Control Room route, Kickoff next-step links, and Operating Day project sections.',
    related: [
      { label: 'Control Room', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Kickoff', path: '/ops/projects/project-ai-photo-lab/kickoff' },
      { label: 'Handoffs', path: '/ops/handoffs' },
    ],
  },
  kickoff: {
    label: 'Kickoff',
    summary: 'Structured project start — sprint goal, team presets, QA checklist, and one-click starter tasks.',
    tooltip:
      'Structured project start — sprint goal, team presets, QA checklist, and one-click starter tasks.',
    description:
      'Kickoff bootstraps a project into an executable state. It defines the sprint goal, assigns preset tasks to digital employees, embeds QA gates, and links forward to Control Room for ongoing delivery tracking.',
    whereUsed: 'AI Photo Lab Kickoff page and project onboarding flows from Projects.',
    related: [
      { label: 'Kickoff', path: '/ops/projects/project-ai-photo-lab/kickoff' },
      { label: 'Control Room', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Run Task', path: '/ops/run-task' },
    ],
  },
  approval: {
    label: 'Approval',
    summary: 'Owner gate before sensitive actions — cloud runtime, tools, production changes, or handoffs.',
    tooltip: 'Owner gate before sensitive actions — cloud runtime, tools, production changes, or handoffs.',
    description:
      'Approvals protect the company from irreversible or costly actions. Runtime may pause until the Owner approves cloud execution, tool use, publishing, or sending a handoff package to an external executor.',
    whereUsed:
      'Approvals inbox, Command Center alerts, Task Results review, Control Room gates, and Work Scheduler suggested actions.',
    related: [
      { label: 'Approvals', path: '/ops/approvals' },
      { label: 'Command Center', path: '/ops' },
      { label: 'Task Results', path: '/ops/task-results' },
    ],
  },
  taskResult: {
    label: 'Task Result',
    summary: 'Deliverable record after a Runtime run — output, review status, and follow-up actions.',
    tooltip: 'Deliverable record after a Runtime run — output, review status, and follow-up actions.',
    description:
      'Task Results capture what a digital employee produced: artifacts, summary text, review notes, approval state, and links to the originating report. They are the hand-off point between execution and the next planned work.',
    whereUsed: 'Task Results list and detail pages, employee workspace outcomes, and Work Scheduler inputs.',
    related: [
      { label: 'Task Results', path: '/ops/task-results' },
      { label: 'Reports', path: '/ops/reports' },
      { label: 'Work Scheduler', path: '/ops/task-results' },
    ],
  },
  memory: {
    label: 'Memory',
    summary: 'Durable employee recall — lessons and facts extracted from completed runs and reviews.',
    tooltip: 'Durable employee recall — lessons and facts extracted from completed runs and reviews.',
    description:
      'Memory stores what a digital employee should remember across sessions: decisions, preferences, project facts, and post-run lessons. It is updated after Task Results and reports are reviewed, not by stuffing everything into the live prompt.',
    whereUsed: 'Employee Memory page, Runtime context assembly, Task Results memory evolution, and employee profile.',
    related: [
      { label: 'Employee Memory', path: '/ops/employees/ag-max/memory' },
      { label: 'Task Results', path: '/ops/task-results' },
      { label: 'Employees', path: '/ops/employees' },
    ],
  },
  knowledge: {
    label: 'Knowledge',
    summary: 'Curated company library — documents, collections, and reference material for Runtime context.',
    tooltip:
      'Curated company library — documents, collections, and reference material for Runtime context.',
    description:
      'Knowledge is shared reference material scoped to the company or workspace. Runtime and employees pull vetted snippets into prompts so answers stay consistent with approved sources rather than ad-hoc chat history.',
    whereUsed: 'Knowledge pages, workspace knowledge tabs, and Runtime prompt assembly.',
    related: [
      { label: 'Knowledge', path: '/ops/knowledge' },
      { label: 'Knowledge Collections', path: '/ops/knowledge/collections' },
      { label: 'Workspaces', path: '/ops/workspaces' },
    ],
  },
  canvas: {
    label: 'Canvas',
    summary: 'Visual company map — structure, flows, and live status on a single interactive surface.',
    tooltip: 'Visual company map — structure, flows, and live status on a single interactive surface.',
    description:
      'Company Canvas presents organization, projects, and execution health as a spatial overview. It helps the Owner see relationships between employees, workstreams, and runtime activity at a glance.',
    whereUsed: 'Company Canvas page and Command Center preview widgets.',
    related: [
      { label: 'Company Canvas', path: '/ops/canvas' },
      { label: 'Command Center', path: '/ops' },
      { label: 'Timeline', path: '/ops/timeline' },
    ],
  },
  employee: {
    label: 'Employee',
    summary: 'Digital worker persona — profile, competencies, workspace, memory, and runtime binding.',
    tooltip: 'Digital worker persona — profile, competencies, workspace, memory, and runtime binding.',
    description:
      'An Employee is a configured AI agent with identity, role, tools, routing preferences, and career-long competencies. Tasks are assigned to employees; Runtime executes on their behalf while preserving Owner oversight.',
    whereUsed: 'Employees roster, profiles, workspaces, Run Task picker, and Operating Day staffing views.',
    related: [
      { label: 'Employees', path: '/ops/employees' },
      { label: 'Run Task', path: '/ops/run-task' },
      { label: 'Employee Profile', path: '/ops/employees/ag-max' },
    ],
  },
  runtimeProvider: {
    label: 'Runtime Provider',
    summary: 'Backend that executes model calls — local, cloud, or hybrid, selected per run profile.',
    tooltip: 'Backend that executes model calls — local, cloud, or hybrid, selected per run profile.',
    description:
      'Runtime Provider is the execution backend behind a run: which API or local engine fulfills the Model Router decision. Provider choice affects latency, cost, privacy, and whether Approval is required before cloud use.',
    whereUsed: 'Runtime Settings, Live Runtime logs, provider panels on run pages, and Cost Monitor.',
    related: [
      { label: 'Runtime Settings', path: '/ops/runtime' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Run History', path: '/ops/runs' },
    ],
  },
  modelRouter: {
    label: 'Model Router',
    summary: 'Selects model and provider from employee profile, task type, mode, and cost limits.',
    tooltip: 'Selects model and provider from employee profile, task type, mode, and cost limits.',
    description:
      'The Model Router maps each run to a catalog model and provider. Inputs include employee runtime profile, task classification, fast/deep/coding/qa mode, and budget guards — so the right capability is used without manual model picking every time.',
    whereUsed: 'Run Task routing preview, Runtime Settings, Live Runtime side panel, and employee runtime pages.',
    related: [
      { label: 'Runtime Settings', path: '/ops/runtime' },
      { label: 'Run Task', path: '/ops/run-task' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
    ],
  },
  promptBuilder: {
    label: 'Prompt Builder',
    summary: 'Assembles structured instructions — system role, task, context, tools, and output policy.',
    tooltip:
      'Assembles structured instructions — system role, task, context, tools, and output policy.',
    description:
      'Prompt Builder composes the final prompt sent to the model: persona, memory snippets, knowledge refs, tool definitions, and output constraints. Run Task and Live Runtime expose previews so the Owner can verify what will be sent before execution.',
    whereUsed: 'Run Task, Live Runtime prompt preview, Runtime execution panels, and Visual Lab.',
    related: [
      { label: 'Run Task', path: '/ops/run-task' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Visual Lab', path: '/ops/visual-lab' },
    ],
  },
  operatingDay: {
    label: 'Operating Day',
    summary: 'Owner daily flow — brief, employees, sprint, approvals, runtime, and end-of-day wrap-up.',
    tooltip:
      'Owner daily flow — brief, employees, sprint, approvals, runtime, and end-of-day wrap-up.',
    description:
      'Operating Day sequences how the Owner runs the company across a single day: morning brief, who is working, sprint status, approval backlog, runtime health, and closing summary. It links to the screens needed at each phase.',
    whereUsed: 'Operating Day page, Command Center next-step links, and header quick navigation.',
    related: [
      { label: 'Operating Day', path: '/ops/day' },
      { label: 'Command Center', path: '/ops' },
      { label: 'Approvals', path: '/ops/approvals' },
    ],
  },
  handoff: {
    label: 'Handoff',
    summary: 'Approved package of context and instructions for an external executor after Owner sign-off.',
    tooltip:
      'Approved package of context and instructions for an external executor after Owner sign-off.',
    description:
      'Handoffs bridge AI Company and external tools — Codex, Cursor, or humans. Runtime prepares context, artifacts, and steps; the Owner approves; then the package is exported for execution outside the local Runtime loop.',
    whereUsed: 'Handoffs inbox, Control Room external work, Kickoff follow-ups, and approval workflows.',
    related: [
      { label: 'Handoffs', path: '/ops/handoffs' },
      { label: 'Control Room', path: '/ops/projects/project-ai-photo-lab/control-room' },
      { label: 'Approvals', path: '/ops/approvals' },
    ],
  },
  execution: {
    label: 'Execution',
    summary: 'Active and queued work — runs, tool calls, and pipeline steps across the company.',
    tooltip: 'Active and queued work — runs, tool calls, and pipeline steps across the company.',
    description:
      'Execution covers in-flight Runtime runs, tool invocations, and orchestrated steps. The Execution Queue and Live Runtime show what is running now, what is blocked on approval, and what finished recently.',
    whereUsed: 'Execution Queue page, Live Runtime, Run History, and Command Center runtime widgets.',
    related: [
      { label: 'Execution Queue', path: '/ops/execution' },
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Run History', path: '/ops/runs' },
    ],
  },
  report: {
    label: 'Report',
    summary: 'Structured narrative output from a completed run — findings, steps, and attachments.',
    tooltip: 'Structured narrative output from a completed run — findings, steps, and attachments.',
    description:
      'Reports document what happened during a Runtime run in readable form. They feed Task Results, memory updates, Operating Day summaries, and Owner review before work is marked done.',
    whereUsed: 'Reports library, Task Result details, employee workspace, and Command Center recent reports.',
    related: [
      { label: 'Reports', path: '/ops/reports' },
      { label: 'Task Results', path: '/ops/task-results' },
      { label: 'Command Center', path: '/ops' },
    ],
  },
  timeline: {
    label: 'Timeline',
    summary: 'Chronological company feed — runs, approvals, handoffs, and notable events.',
    tooltip: 'Chronological company feed — runs, approvals, handoffs, and notable events.',
    description:
      'Timeline aggregates events across tenants of work into one audit-friendly stream. It complements Command Center snapshots when the Owner needs history rather than current state.',
    whereUsed: 'Company Timeline page, Mission Feed redirects, and Command Center cross-links.',
    related: [
      { label: 'Company Timeline', path: '/ops/timeline' },
      { label: 'Activity', path: '/ops/activity' },
      { label: 'Command Center', path: '/ops' },
    ],
  },
  workScheduler: {
    label: 'Work Scheduler',
    summary: 'Suggests next actions after a Task Result — approve, rerun, hand off, or dismiss.',
    tooltip: 'Suggests next actions after a Task Result — approve, rerun, hand off, or dismiss.',
    description:
      'Work Scheduler turns completed output into a plan: prioritized suggestions tied to the Task Result, often requiring Owner approval before launching the next Runtime task or external handoff.',
    whereUsed: 'Task Result details, employee workspace, Control Room panels, and post-run review flows.',
    related: [
      { label: 'Task Results', path: '/ops/task-results' },
      { label: 'Run Task', path: '/ops/run-task' },
      { label: 'Approvals', path: '/ops/approvals' },
    ],
  },
  costMonitor: {
    label: 'Cost Monitor',
    summary: 'Tracks token spend and provider usage per run, employee, and day.',
    tooltip: 'Tracks token spend and provider usage per run, employee, and day.',
    description:
      'Cost Monitor surfaces Runtime spend against limits: tokens, estimated cost, and provider breakdown. It helps the Owner decide when to approve cloud runs or switch modes before budgets are exceeded.',
    whereUsed: 'Live Runtime monitor panels, Runtime Settings, and employee runtime dashboards.',
    related: [
      { label: 'Live Runtime', path: '/ops/runtime/live' },
      { label: 'Runtime Settings', path: '/ops/runtime' },
      { label: 'Run History', path: '/ops/runs' },
    ],
  },
}
