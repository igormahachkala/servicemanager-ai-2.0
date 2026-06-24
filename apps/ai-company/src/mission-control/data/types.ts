export type AgentStatus = 'online' | 'idle' | 'busy' | 'offline'
export type TaskStatus = 'backlog' | 'running' | 'blocked' | 'done'
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type HealthStatus = 'up' | 'degraded' | 'down'
export type FeedSeverity = 'info' | 'warn' | 'error' | 'success'
export type ToolStatus = 'healthy' | 'degraded' | 'offline'

export type ToolCategory = 'models' | 'coding-agents' | 'integrations'

export type AgentLifecycle = 'active' | 'planned'

export type Agent = {
  id: string
  codename: string
  role: string
  squad: string
  model: string
  status: AgentStatus
  lifecycle: AgentLifecycle
  currentTaskId: string | null
  loadPct: number
  tools: string[]
  lastActivity: string
}

export type Squad = {
  id: string
  name: string
  domain: string
  leadAgent: string
  headcount: number
  capacityPct: number
}

export type Task = {
  id: string
  title: string
  assignee: string
  priority: TaskPriority
  status: TaskStatus
  slaMinutes: number
  slaBreached: boolean
}

export type FeedEvent = {
  id: string
  at: string
  severity: FeedSeverity
  type: string
  source: string
  message: string
  taskId?: string
}

export type Tool = {
  id: string
  name: string
  category: ToolCategory
  version: string
  scope: string
  status: ToolStatus
  lastCheck: string
  usedBy: string[]
}

export type SystemHealth = {
  id: string
  label: string
  status: HealthStatus
  detail: string
}

export type DashboardMetrics = {
  activeAgents: number
  runningTasks: number
  queueDepth: number
  toolsHealthy: number
  toolsTotal: number
}
