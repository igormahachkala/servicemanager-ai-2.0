import type {
  Agent,
  DashboardMetrics,
  FeedEvent,
  Squad,
  SystemHealth,
  Task,
  Tool,
} from './types'

export const dashboardMetrics: DashboardMetrics = {
  activeAgents: 2,
  runningTasks: 2,
  queueDepth: 5,
  toolsHealthy: 17,
  toolsTotal: 19,
}

export const systemHealth: SystemHealth[] = [
  { id: 'orch', label: 'Orchestrator', status: 'up', detail: 'p99 95ms' },
  { id: 'mem', label: 'Memory store', status: 'up', detail: 'sync ok' },
  { id: 'gw', label: 'Tool gateway', status: 'up', detail: 'all probes ok' },
]

export const squads: Squad[] = [
  { id: 'sq-core', name: 'Core Engineering', domain: 'Engineering', leadAgent: 'Atlas', headcount: 2, capacityPct: 72 },
  { id: 'sq-exec', name: 'Executive', domain: 'Leadership', leadAgent: 'Apex', headcount: 3, capacityPct: 0 },
  { id: 'sq-ops', name: 'Operations', domain: 'Operations', leadAgent: 'Nova', headcount: 2, capacityPct: 0 },
]

export const agents: Agent[] = [
  {
    id: 'ag-cto',
    codename: 'Atlas',
    role: 'AI CTO',
    squad: 'Core Engineering',
    model: 'Claude',
    status: 'busy',
    lifecycle: 'active',
    currentTaskId: 'TSK-V1-001',
    loadPct: 68,
    tools: ['GitHub', 'Cursor', 'PostgreSQL', 'Docker'],
    lastActivity: 'Reviewed V1 employee roster · 2m ago',
  },
  {
    id: 'ag-max',
    codename: 'MAX',
    role: 'MAX Senior Developer',
    squad: 'Core Engineering',
    model: 'Claude Code',
    status: 'busy',
    lifecycle: 'active',
    currentTaskId: 'TSK-V1-002',
    loadPct: 74,
    tools: ['GitHub', 'Cursor', 'Codex', 'Docker'],
    lastActivity: 'Polishing Employee Inspector · now',
  },
  {
    id: 'ag-arch',
    codename: 'Daedalus',
    role: 'AI Architect',
    squad: 'Core Engineering',
    model: 'DeepSeek',
    status: 'offline',
    lifecycle: 'planned',
    currentTaskId: null,
    loadPct: 0,
    tools: ['GitHub', 'PostgreSQL'],
    lastActivity: 'Awaiting V1 activation',
  },
  {
    id: 'ag-qa',
    codename: 'Sentinel',
    role: 'AI QA',
    squad: 'Core Engineering',
    model: 'GPT',
    status: 'offline',
    lifecycle: 'planned',
    currentTaskId: null,
    loadPct: 0,
    tools: ['GitHub', 'Docker'],
    lastActivity: 'Awaiting V1 activation',
  },
  {
    id: 'ag-devops',
    codename: 'Helm',
    role: 'AI DevOps',
    squad: 'Operations',
    model: 'Llama',
    status: 'offline',
    lifecycle: 'planned',
    currentTaskId: null,
    loadPct: 0,
    tools: ['Docker', 'GitHub', 'n8n'],
    lastActivity: 'Awaiting V1 activation',
  },
  {
    id: 'ag-asst',
    codename: 'Nova',
    role: 'AI Assistant',
    squad: 'Operations',
    model: 'MiMo',
    status: 'offline',
    lifecycle: 'planned',
    currentTaskId: null,
    loadPct: 0,
    tools: ['Open WebUI', 'n8n'],
    lastActivity: 'Awaiting V1 activation',
  },
  {
    id: 'ag-ceo',
    codename: 'Apex',
    role: 'AI CEO',
    squad: 'Executive',
    model: 'Claude',
    status: 'offline',
    lifecycle: 'planned',
    currentTaskId: null,
    loadPct: 0,
    tools: ['Figma'],
    lastActivity: 'Awaiting V1 activation',
  },
  {
    id: 'ag-cfo',
    codename: 'Ledger',
    role: 'AI CFO',
    squad: 'Executive',
    model: 'GPT',
    status: 'offline',
    lifecycle: 'planned',
    currentTaskId: null,
    loadPct: 0,
    tools: ['PostgreSQL'],
    lastActivity: 'Awaiting V1 activation',
  },
  {
    id: 'ag-coo',
    codename: 'Ops',
    role: 'AI COO',
    squad: 'Executive',
    model: 'Qwen',
    status: 'offline',
    lifecycle: 'planned',
    currentTaskId: null,
    loadPct: 0,
    tools: ['n8n', 'Ollama'],
    lastActivity: 'Awaiting V1 activation',
  },
]

export const tasks: Task[] = [
  { id: 'TSK-V1-002', title: 'Polish standalone AI Company V1', assignee: 'MAX', priority: 'P0', status: 'running', slaMinutes: 180, slaBreached: false },
  { id: 'TSK-V1-001', title: 'V1 employee roster and tools registry', assignee: 'Atlas', priority: 'P1', status: 'running', slaMinutes: 240, slaBreached: false },
  { id: 'TSK-V1-003', title: 'Activate AI Architect agent', assignee: 'Daedalus', priority: 'P2', status: 'backlog', slaMinutes: 480, slaBreached: false },
  { id: 'TSK-V1-004', title: 'QA gate for local build', assignee: 'Sentinel', priority: 'P2', status: 'backlog', slaMinutes: 360, slaBreached: false },
  { id: 'TSK-V1-005', title: 'DevOps deploy pipeline (future phase)', assignee: 'Helm', priority: 'P3', status: 'backlog', slaMinutes: 720, slaBreached: false },
]

export const feedEvents: FeedEvent[] = [
  { id: 'ev-01', at: '2026-06-24T18:42:01Z', severity: 'info', type: 'agent.action', source: 'MAX', message: 'Updated Employee Inspector for V1' },
  { id: 'ev-02', at: '2026-06-24T18:41:44Z', severity: 'success', type: 'task.transition', source: 'Atlas', message: 'TSK-V1-001 → running', taskId: 'TSK-V1-001' },
  { id: 'ev-03', at: '2026-06-24T18:40:12Z', severity: 'info', type: 'system.alert', source: 'mission-ops', message: '7 agents in planned state — V1 rollout' },
  { id: 'ev-04', at: '2026-06-24T18:38:55Z', severity: 'success', type: 'deploy', source: 'MAX', message: 'npm run build · apps/ai-company OK' },
  { id: 'ev-05', at: '2026-06-24T18:37:03Z', severity: 'info', type: 'agent.action', source: 'Atlas', message: 'Tools registry updated — 3 categories' },
]

export const tools: Tool[] = [
  { id: 'mdl-qwen', name: 'Qwen', category: 'models', version: '2.5', scope: 'inference', status: 'healthy', lastCheck: '1m ago', usedBy: ['AI COO'] },
  { id: 'mdl-ds', name: 'DeepSeek', category: 'models', version: 'V3', scope: 'inference', status: 'healthy', lastCheck: '2m ago', usedBy: ['AI Architect'] },
  { id: 'mdl-llama', name: 'Llama', category: 'models', version: '3.3', scope: 'inference', status: 'healthy', lastCheck: '3m ago', usedBy: ['AI DevOps'] },
  { id: 'mdl-claude', name: 'Claude', category: 'models', version: '4.x', scope: 'inference', status: 'healthy', lastCheck: '1m ago', usedBy: ['AI CTO', 'AI CEO'] },
  { id: 'mdl-gpt', name: 'GPT', category: 'models', version: '5.x', scope: 'inference', status: 'healthy', lastCheck: '2m ago', usedBy: ['AI QA', 'AI CFO'] },
  { id: 'mdl-mimo', name: 'MiMo', category: 'models', version: '1.0', scope: 'inference', status: 'healthy', lastCheck: '4m ago', usedBy: ['AI Assistant'] },
  { id: 'ca-claude', name: 'Claude Code', category: 'coding-agents', version: '1.0', scope: 'exec', status: 'healthy', lastCheck: 'now', usedBy: ['MAX Senior Developer'] },
  { id: 'ca-codex', name: 'Codex', category: 'coding-agents', version: '5.x', scope: 'exec', status: 'healthy', lastCheck: '2m ago', usedBy: ['MAX Senior Developer'] },
  { id: 'ca-mimo', name: 'MiMo Code', category: 'coding-agents', version: '1.0', scope: 'exec', status: 'healthy', lastCheck: '5m ago', usedBy: ['AI Assistant'] },
  { id: 'ca-oh', name: 'OpenHands', category: 'coding-agents', version: '0.9', scope: 'exec', status: 'degraded', lastCheck: '3m ago', usedBy: ['Core Engineering'] },
  { id: 'ca-aider', name: 'Aider', category: 'coding-agents', version: '0.82', scope: 'exec', status: 'healthy', lastCheck: '6m ago', usedBy: ['Core Engineering'] },
  { id: 'ca-cursor', name: 'Cursor', category: 'coding-agents', version: '2.x', scope: 'exec', status: 'healthy', lastCheck: 'now', usedBy: ['AI CTO', 'MAX Senior Developer'] },
  { id: 'int-gh', name: 'GitHub', category: 'integrations', version: 'MCP 1.4', scope: 'read/write', status: 'healthy', lastCheck: '1m ago', usedBy: ['Core Engineering'] },
  { id: 'int-fig', name: 'Figma', category: 'integrations', version: 'MCP 2.2', scope: 'read', status: 'healthy', lastCheck: '2m ago', usedBy: ['AI CEO'] },
  { id: 'int-dkr', name: 'Docker', category: 'integrations', version: '24.x', scope: 'exec', status: 'healthy', lastCheck: '3m ago', usedBy: ['AI DevOps', 'MAX'] },
  { id: 'int-pg', name: 'PostgreSQL', category: 'integrations', version: '16', scope: 'read', status: 'healthy', lastCheck: '4m ago', usedBy: ['AI CTO', 'AI CFO'] },
  { id: 'int-n8n', name: 'n8n', category: 'integrations', version: '1.8', scope: 'exec', status: 'healthy', lastCheck: '5m ago', usedBy: ['Operations'] },
  { id: 'int-oll', name: 'Ollama', category: 'integrations', version: '0.5', scope: 'inference', status: 'healthy', lastCheck: '6m ago', usedBy: ['AI COO'] },
  { id: 'int-owu', name: 'Open WebUI', category: 'integrations', version: '0.6', scope: 'read/write', status: 'healthy', lastCheck: '7m ago', usedBy: ['AI Assistant'] },
]

export const domains = ['Engineering', 'Leadership', 'Operations'] as const

export function agentsBySquad(squadName: string): Agent[] {
  return agents.filter((a) => a.squad === squadName)
}

export function runningTasks(): Task[] {
  return tasks.filter((t) => t.status === 'running')
}

export function recentAlerts(): FeedEvent[] {
  return feedEvents.filter((e) => e.severity === 'warn' || e.severity === 'error').slice(0, 3)
}

export function toolsByCategory(category: Tool['category']): Tool[] {
  return tools.filter((t) => t.category === category)
}

export const activeAgents = agents.filter((a) => a.lifecycle === 'active')
export const plannedAgents = agents.filter((a) => a.lifecycle === 'planned')
