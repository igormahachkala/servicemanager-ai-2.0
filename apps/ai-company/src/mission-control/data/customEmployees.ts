import type { Agent } from './types'

export type CustomEmployeeStatus = 'active' | 'planned' | 'disabled'

export type IntegrationPermission = {
  read: boolean
  write: boolean
}

export type CustomEmployeePermissions = {
  github: IntegrationPermission
  docker: IntegrationPermission
  postgresql: IntegrationPermission
  figma: IntegrationPermission
  n8n: IntegrationPermission
  filesystem: IntegrationPermission
  servicemanagerApi: IntegrationPermission
  productionDeploy: boolean
}

export type CustomEmployee = {
  id: string
  name: string
  codename: string
  role: string
  status: CustomEmployeeStatus
  primaryModel: string
  fallbackModels: string[]
  tools: string[]
  permissions: CustomEmployeePermissions
  description: string
  createdAt: string
}

export type CustomEmployeeDraft = Omit<CustomEmployee, 'id' | 'createdAt'>

export const PERMISSION_CATEGORIES = [
  { key: 'github' as const, label: 'GitHub', hasWrite: true },
  { key: 'docker' as const, label: 'Docker', hasWrite: true },
  { key: 'postgresql' as const, label: 'PostgreSQL', hasWrite: true },
  { key: 'figma' as const, label: 'Figma', hasWrite: true },
  { key: 'n8n' as const, label: 'n8n', hasWrite: true },
  { key: 'filesystem' as const, label: 'Filesystem', hasWrite: true },
  { key: 'servicemanagerApi' as const, label: 'ServiceManager API', hasWrite: true },
  { key: 'productionDeploy' as const, label: 'Production Deploy', hasWrite: false },
]

export const MODEL_OPTIONS = [
  'Claude',
  'Claude Code',
  'GPT',
  'DeepSeek',
  'Llama',
  'Qwen',
  'MiMo',
  'Codex',
]

export const TOOL_OPTIONS = [
  'GitHub',
  'Cursor',
  'Docker',
  'PostgreSQL',
  'Figma',
  'n8n',
  'Ollama',
  'Open WebUI',
  'Codex',
  'OpenHands',
  'Aider',
]

const STORAGE_KEY = 'ai-company-custom-employees'

export function defaultPermissions(): CustomEmployeePermissions {
  return {
    github: { read: true, write: false },
    docker: { read: true, write: false },
    postgresql: { read: true, write: false },
    figma: { read: true, write: false },
    n8n: { read: true, write: false },
    filesystem: { read: true, write: false },
    servicemanagerApi: { read: true, write: false },
    productionDeploy: false,
  }
}

export function emptyDraft(): CustomEmployeeDraft {
  return {
    name: '',
    codename: '',
    role: '',
    status: 'planned',
    primaryModel: '',
    fallbackModels: [],
    tools: [],
    permissions: defaultPermissions(),
    description: '',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePermission(value: unknown, fallback: IntegrationPermission): IntegrationPermission {
  if (!isRecord(value)) return fallback
  return {
    read: typeof value.read === 'boolean' ? value.read : fallback.read,
    write: typeof value.write === 'boolean' ? value.write : fallback.write,
  }
}

function parseEmployee(value: unknown): CustomEmployee | null {
  if (!isRecord(value)) return null
  const defaults = defaultPermissions()
  const fallbackModels = Array.isArray(value.fallbackModels)
    ? value.fallbackModels.filter((item): item is string => typeof item === 'string')
    : []
  const tools = Array.isArray(value.tools)
    ? value.tools.filter((item): item is string => typeof item === 'string')
    : []
  const permissionsRaw = isRecord(value.permissions) ? value.permissions : {}

  const status =
    value.status === 'active' || value.status === 'planned' || value.status === 'disabled'
      ? value.status
      : 'planned'

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.codename !== 'string' ||
    typeof value.role !== 'string' ||
    typeof value.primaryModel !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    name: value.name,
    codename: value.codename,
    role: value.role,
    status,
    primaryModel: value.primaryModel,
    fallbackModels,
    tools,
    permissions: {
      github: parsePermission(permissionsRaw.github, defaults.github),
      docker: parsePermission(permissionsRaw.docker, defaults.docker),
      postgresql: parsePermission(permissionsRaw.postgresql, defaults.postgresql),
      figma: parsePermission(permissionsRaw.figma, defaults.figma),
      n8n: parsePermission(permissionsRaw.n8n, defaults.n8n),
      filesystem: parsePermission(permissionsRaw.filesystem, defaults.filesystem),
      servicemanagerApi: parsePermission(permissionsRaw.servicemanagerApi, defaults.servicemanagerApi),
      productionDeploy:
        typeof permissionsRaw.productionDeploy === 'boolean'
          ? permissionsRaw.productionDeploy
          : defaults.productionDeploy,
    },
    description: value.description,
    createdAt: value.createdAt,
  }
}

export function loadCustomEmployees(): CustomEmployee[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseEmployee).filter((item): item is CustomEmployee => item !== null)
  } catch {
    return []
  }
}

export function saveCustomEmployees(employees: CustomEmployee[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees))
  } catch {
    /* noop */
  }
}

export function createCustomEmployee(draft: CustomEmployeeDraft): CustomEmployee {
  const employee: CustomEmployee = {
    ...draft,
    id: `custom-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  const next = [...loadCustomEmployees(), employee]
  saveCustomEmployees(next)
  return employee
}

export function customEmployeesByStatus(status: CustomEmployeeStatus): CustomEmployee[] {
  return loadCustomEmployees().filter((employee) => employee.status === status)
}

export function customEmployeeToAgent(employee: CustomEmployee): Agent {
  const lifecycle = employee.status === 'planned' ? 'planned' : 'active'
  const status =
    employee.status === 'active' ? 'idle' : employee.status === 'disabled' ? 'offline' : 'offline'

  return {
    id: employee.id,
    codename: employee.codename,
    role: employee.role,
    squad: 'Custom',
    model: employee.primaryModel,
    status,
    lifecycle,
    currentTaskId: null,
    loadPct: 0,
    tools: employee.tools,
    lastActivity: employee.description.trim()
      ? employee.description.slice(0, 48)
      : `Created · ${new Date(employee.createdAt).toLocaleDateString()}`,
  }
}

export function customEmployeesAsAgents(status?: CustomEmployeeStatus): Agent[] {
  const list = status
    ? loadCustomEmployees().filter((employee) => employee.status === status)
    : loadCustomEmployees()
  return list.map(customEmployeeToAgent)
}
