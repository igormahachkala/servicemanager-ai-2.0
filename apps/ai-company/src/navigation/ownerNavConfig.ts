/**
 * Owner-first navigation V2 (AI-COMPANY-105B).
 * Deep technical routes remain reachable — grouped under Management / Technical.
 */

import { EMPLOYEE_ROUTE_IDS } from '../mission-control/data/employeeIdResolver'

export const OWNER_NAV_GROUP_IDS = [
  'company',
  'employees',
  'tasks',
  'decisions',
  'reports',
  'management',
  'technical',
] as const

export type OwnerNavGroupId = (typeof OWNER_NAV_GROUP_IDS)[number]

export type OwnerNavItemId =
  | 'commandCenter'
  | 'morningReport'
  | 'operatingDay'
  | 'companyCanvas'
  | 'organization'
  | 'timeline'
  | 'employees'
  | 'maxToday'
  | 'maxWorkspace'
  | 'presence'
  | 'chats'
  | 'runTask'
  | 'tasks'
  | 'execution'
  | 'taskResults'
  | 'approvals'
  | 'handoffs'
  | 'knowledgeCandidates'
  | 'reports'
  | 'runs'
  | 'employeeJournal'
  | 'runtimeSettings'
  | 'toolsRegistry'
  | 'knowledge'
  | 'maxMemory'
  | 'audit'
  | 'notifications'
  | 'workday'
  | 'projects'
  | 'workspaces'
  | 'sprint'
  | 'collaboration'
  | 'visualLab'
  | 'toolExecutions'
  | 'runtimeLive'
  | 'activity'
  | 'companies'

export type OwnerNavItemConfig = {
  id: OwnerNavItemId
  group: OwnerNavGroupId
  to: string
  end?: boolean
  icon: string
}

const MAX = EMPLOYEE_ROUTE_IDS.max

export const OWNER_NAV_ITEMS: OwnerNavItemConfig[] = [
  // Company
  { id: 'commandCenter', group: 'company', to: '/ops', end: true, icon: '◫' },
  { id: 'morningReport', group: 'company', to: '/ops/morning-report', icon: '🌅' },
  { id: 'operatingDay', group: 'company', to: '/ops/day', icon: '☀' },
  { id: 'companyCanvas', group: 'company', to: '/ops/canvas', icon: '🗺' },
  { id: 'organization', group: 'company', to: '/ops/organization', icon: '⬡' },
  { id: 'timeline', group: 'company', to: '/ops/timeline', icon: '⏱' },

  // Employees
  { id: 'employees', group: 'employees', to: '/ops/employees', icon: '◎' },
  { id: 'maxToday', group: 'employees', to: `/ops/employees/${MAX}/today`, icon: '📅' },
  { id: 'maxWorkspace', group: 'employees', to: `/ops/employees/${MAX}/workspace`, icon: '◧' },
  { id: 'presence', group: 'employees', to: '/ops/presence', icon: '◉' },
  { id: 'chats', group: 'employees', to: '/ops/chats', icon: '💬' },

  // Tasks
  { id: 'runTask', group: 'tasks', to: '/ops/run-task', icon: '▶' },
  { id: 'tasks', group: 'tasks', to: '/ops/tasks', icon: '▤' },
  { id: 'execution', group: 'tasks', to: '/ops/execution', icon: '⚡' },
  { id: 'taskResults', group: 'tasks', to: '/ops/task-results', icon: '✎' },

  // Owner decisions
  { id: 'approvals', group: 'decisions', to: '/ops/approvals', icon: '✓' },
  { id: 'handoffs', group: 'decisions', to: '/ops/handoffs', icon: '📦' },
  { id: 'knowledgeCandidates', group: 'decisions', to: '/ops/task-results', icon: '📚' },

  // Reports
  { id: 'reports', group: 'reports', to: '/ops/reports', icon: '📋' },
  { id: 'employeeJournal', group: 'reports', to: '/ops/morning-report', icon: '📓' },
  { id: 'runs', group: 'reports', to: '/ops/runs', icon: '▶' },

  // Management
  { id: 'runtimeSettings', group: 'management', to: '/ops/runtime', icon: '⎈' },
  { id: 'toolsRegistry', group: 'management', to: '/ops/tools', icon: '⚙' },
  { id: 'knowledge', group: 'management', to: '/ops/knowledge', icon: '📚' },
  { id: 'maxMemory', group: 'management', to: `/ops/employees/${MAX}/memory`, icon: '🧠' },
  { id: 'notifications', group: 'management', to: '/ops/notifications', icon: '🔔' },
  { id: 'audit', group: 'management', to: '/ops/audit', icon: '🔍' },
  { id: 'companies', group: 'management', to: '/ops/companies', icon: '🏢' },

  // Technical (second level)
  { id: 'workday', group: 'technical', to: '/ops/workday', icon: '🌅' },
  { id: 'projects', group: 'technical', to: '/ops/projects', icon: '◈' },
  { id: 'workspaces', group: 'technical', to: '/ops/workspaces', icon: '◧' },
  { id: 'sprint', group: 'technical', to: '/ops/sprint', icon: '🏃' },
  { id: 'collaboration', group: 'technical', to: '/ops/collaboration', icon: '🤝' },
  { id: 'visualLab', group: 'technical', to: '/ops/visual-lab', icon: '🖥' },
  { id: 'toolExecutions', group: 'technical', to: '/ops/tool-executions', icon: '⇢' },
  { id: 'runtimeLive', group: 'technical', to: '/ops/runtime/live', icon: '●' },
  { id: 'activity', group: 'technical', to: '/ops/activity', icon: '◉' },
]

export const OWNER_NAV_PRIMARY_GROUPS: OwnerNavGroupId[] = [
  'company',
  'employees',
  'tasks',
  'decisions',
  'reports',
  'management',
]

export function groupOwnerNavItems(): Map<OwnerNavGroupId, OwnerNavItemConfig[]> {
  const map = new Map<OwnerNavGroupId, OwnerNavItemConfig[]>()
  for (const groupId of OWNER_NAV_GROUP_IDS) {
    map.set(groupId, [])
  }
  for (const item of OWNER_NAV_ITEMS) {
    map.get(item.group)!.push(item)
  }
  return map
}
