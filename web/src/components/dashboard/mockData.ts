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
    label: 'Active projects',
    value: '4',
    hint: '1 demo · 3 delivery streams',
    tone: 'blue',
  },
  {
    id: 'employees-working',
    label: 'Employees working',
    value: '7',
    hint: '2 in runtime · 1 in handoff',
    tone: 'green',
  },
  {
    id: 'acceptance-queue',
    label: 'Acceptance queue',
    value: '3',
    hint: '2 waiting client review',
    tone: 'amber',
  },
  {
    id: 'open-alerts',
    label: 'Open alerts',
    value: '1',
    hint: 'Runtime timeout risk',
    tone: 'red',
  },
]

export const DASHBOARD_ACTIONS: DashboardActionItem[] = [
  {
    id: 'canvas',
    title: 'Open Canvas',
    description: 'Inspect the living company graph for the active project.',
    to: '/ops/canvas?projectId=project-ai-photo-lab',
    cta: 'Open Canvas',
  },
  {
    id: 'control-room',
    title: 'Project Control Room',
    description: 'Review project health, work in motion, and delivery signals.',
    to: '/ops/projects/project-ai-photo-lab/control-room',
    cta: 'Open Control Room',
  },
  {
    id: 'runtime',
    title: 'Live Runtime',
    description: 'Check provider health, runs, and execution pipeline status.',
    to: '/ops/runtime/live',
    cta: 'Open Runtime',
  },
  {
    id: 'timeline',
    title: 'Company Timeline',
    description: 'See recent work events, approvals, and report activity.',
    to: '/ops/timeline',
    cta: 'Open Timeline',
  },
]

export const DASHBOARD_EVENTS: DashboardEventItem[] = [
  {
    id: 'event-1',
    time: '09:42',
    title: 'AI CTO completed a runtime review',
    description: 'Runtime logs were checked and the Ollama provider stayed healthy.',
    tone: 'green',
  },
  {
    id: 'event-2',
    time: '09:28',
    title: 'MAX opened an acceptance queue item',
    description: 'Ticket #248 is waiting for client acceptance.',
    tone: 'amber',
  },
  {
    id: 'event-3',
    time: '09:14',
    title: 'QA generated a report draft',
    description: 'Delivery evidence is ready for review in the report stream.',
    tone: 'blue',
  },
  {
    id: 'event-4',
    time: '08:56',
    title: 'DevOps flagged a runtime warning',
    description: 'The latest execution completed with a partial warning, not a hard failure.',
    tone: 'red',
  },
]

export const DASHBOARD_TEAM_LOAD: DashboardTeamLoadItem[] = [
  {
    id: 'employee-ai-cto',
    name: 'AI CTO',
    role: 'Architectural review',
    load: 82,
    note: 'Focused on runtime and platform boundaries',
  },
  {
    id: 'employee-max',
    name: 'MAX',
    role: 'Assistant delivery',
    load: 64,
    note: 'Supporting acceptance and chat surfaces',
  },
  {
    id: 'employee-qa',
    name: 'QA',
    role: 'Verification',
    load: 48,
    note: 'Preparing smoke coverage for delivery',
  },
]

export const DASHBOARD_ACCEPTANCE_QUEUE: DashboardAcceptanceQueueItem[] = [
  {
    id: 'acceptance-1',
    ticket: '#251',
    title: 'Conveyor belt inspection follow-up',
    owner: 'Client acceptance pending',
    status: 'awaiting_acceptance',
    hint: 'Requires a final client decision',
  },
  {
    id: 'acceptance-2',
    ticket: '#248',
    title: 'Lighting issue in the hall',
    owner: 'Needs photo evidence',
    status: 'needs_review',
    hint: 'Awaiting a clearer field photo',
  },
  {
    id: 'acceptance-3',
    ticket: '#243',
    title: 'Air curtain tuning',
    owner: 'Blocked by missing comment',
    status: 'blocked',
    hint: 'Acceptance comment is required before close',
  },
]
