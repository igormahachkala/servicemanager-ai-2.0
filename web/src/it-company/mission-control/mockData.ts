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
  { id: 'overview', label: 'Overview', hint: 'Mission status' },
  { id: 'employees', label: 'Employees', hint: 'Digital staff' },
  { id: 'tasks', label: 'Tasks', hint: 'Pending work' },
  { id: 'builds', label: 'Builds', hint: 'CI / deploy flow' },
  { id: 'prs', label: 'PRs', hint: 'Review queue' },
  { id: 'mcp', label: 'MCP', hint: 'Connector state' },
]

export const MISSION_CONTROL_WORKSPACE: MissionControlWorkspaceCard[] = [
  { id: 'board', title: 'Workspace board', value: '12 lanes', note: 'Task stream, review queue and delivery progress' },
  { id: 'focus', title: 'Current focus', value: '3 blockers', note: 'Waiting review, build failure, acceptance flow' },
  { id: 'throughput', title: 'Throughput', value: '18 items', note: 'Mock trend for Mission Control layout' },
  { id: 'stability', title: 'Stability', value: '96%', note: 'Placeholder metric for future telemetry' },
]

export const MISSION_CONTROL_INSPECTOR: MissionControlInspectorItem[] = [
  { id: 'owner', title: 'Owner', value: 'Platform team', status: 'ok' },
  { id: 'sprint', title: 'Sprint', value: 'Mission Control foundation', status: 'ok' },
  { id: 'risk', title: 'Risk', value: 'Acceptance contract pending', status: 'warn' },
  { id: 'deploy', title: 'Deploy', value: 'Stage ready', status: 'ok' },
  { id: 'review', title: 'Review', value: '2 pending PRs', status: 'warn' },
]

export const MISSION_CONTROL_ACTIVITY: MissionControlActivityItem[] = [
  {
    id: 'mc-a1',
    time: '10:42',
    employee: 'developer',
    title: 'TASK_COMPLETED',
    description: 'Closed ticket lifecycle wiring in the service layer and prepared the next diff.',
  },
  {
    id: 'mc-a2',
    time: '10:18',
    employee: 'devops',
    title: 'BUILD_SUCCESS',
    description: 'Stage build passed after cleanup of unused mobile symbols.',
  },
  {
    id: 'mc-a3',
    time: '09:51',
    employee: 'qa',
    title: 'TASK_STARTED',
    description: 'Started validation of the new Mission Control and acceptance lifecycle states.',
  },
  {
    id: 'mc-a4',
    time: '09:22',
    employee: 'pm',
    title: 'PR_OPENED',
    description: 'Opened planning work for Mission Control foundation and future telemetry widgets.',
  },
]
