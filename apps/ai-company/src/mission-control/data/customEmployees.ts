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
  skills: string[]
  restrictions: string[]
  systemPrompt: string
  workflow: string
  memoryScope: string[]
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

export const SKILL_OPTIONS = [
  'Business Analysis',
  'Architecture',
  'Coding',
  'Testing',
  'Research',
  'Documentation',
  'Marketing',
  'Finance',
  'DevOps',
  'Product Management',
]

export const RESTRICTION_OPTIONS = [
  'No Production Deploy',
  'No Backend Changes',
  'No Database Write',
  'No Git Push',
  'No Delete Operations',
  'Requires Approval',
]

export const MEMORY_SCOPE_OPTIONS = [
  'AI Company',
  'ServiceManager.AI',
  'MAX Assistant',
  'Photo Inspection AI',
  'Finance',
  'Operations',
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
    skills: [],
    restrictions: [],
    systemPrompt: '',
    workflow: '',
    memoryScope: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
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
    fallbackModels: parseStringArray(value.fallbackModels),
    tools: parseStringArray(value.tools),
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
    skills: parseStringArray(value.skills),
    restrictions: parseStringArray(value.restrictions),
    systemPrompt: typeof value.systemPrompt === 'string' ? value.systemPrompt : '',
    workflow: typeof value.workflow === 'string' ? value.workflow : '',
    memoryScope: parseStringArray(value.memoryScope),
    createdAt: value.createdAt,
  }
}

export function optionLabel(options: Record<string, string>, value: string): string {
  return options[value] ?? value
}

export type PermissionSummaryLabels = {
  permissionLabels: Record<string, string>
  readShort: string
  writeShort: string
  readWriteShort: string
  empty: string
}

export function summarizePermissions(
  permissions: CustomEmployeePermissions,
  labels: PermissionSummaryLabels,
): string {
  const parts: string[] = []

  for (const category of PERMISSION_CATEGORIES) {
    const name = labels.permissionLabels[category.key] ?? category.label

    if (category.key === 'productionDeploy') {
      if (permissions.productionDeploy) parts.push(name)
      continue
    }

    const perm = permissions[category.key]
    if (perm.read && perm.write) parts.push(`${name} ${labels.readWriteShort}`)
    else if (perm.read) parts.push(`${name} ${labels.readShort}`)
    else if (perm.write) parts.push(`${name} ${labels.writeShort}`)
  }

  return parts.length > 0 ? parts.join(', ') : labels.empty
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

export function employeeToDraft(employee: CustomEmployee): CustomEmployeeDraft {
  const { id: _id, createdAt: _createdAt, ...rest } = employee
  return {
    ...rest,
    fallbackModels: [...employee.fallbackModels],
    tools: [...employee.tools],
    skills: [...employee.skills],
    restrictions: [...employee.restrictions],
    memoryScope: [...employee.memoryScope],
    permissions: {
      github: { ...employee.permissions.github },
      docker: { ...employee.permissions.docker },
      postgresql: { ...employee.permissions.postgresql },
      figma: { ...employee.permissions.figma },
      n8n: { ...employee.permissions.n8n },
      filesystem: { ...employee.permissions.filesystem },
      servicemanagerApi: { ...employee.permissions.servicemanagerApi },
      productionDeploy: employee.permissions.productionDeploy,
    },
  }
}

export function duplicateCustomEmployee(
  source: CustomEmployee,
  copyOfLabel: string,
): CustomEmployee {
  const draft = employeeToDraft(source)
  draft.name = `${copyOfLabel} ${source.name}`.trim()
  draft.codename = `${source.codename}-copy`
  return createCustomEmployee(draft)
}

export function customEmployeesByStatus(status: CustomEmployeeStatus): CustomEmployee[] {
  return loadCustomEmployees().filter((employee) => employee.status === status)
}

export function customEmployeeToAgent(employee: CustomEmployee): Agent {
  const lifecycle = employee.status === 'planned' ? 'planned' : 'active'
  const status =
    employee.status === 'active' ? 'idle' : employee.status === 'disabled' ? 'offline' : 'offline'

  const activityParts = [
    employee.skills.length > 0 ? employee.skills.slice(0, 2).join(', ') : '',
    employee.description.trim(),
  ].filter(Boolean)

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
    lastActivity: activityParts[0]
      ? activityParts[0].slice(0, 48)
      : `Created · ${new Date(employee.createdAt).toLocaleDateString()}`,
  }
}

export function customEmployeesAsAgents(status?: CustomEmployeeStatus): Agent[] {
  const list = status
    ? loadCustomEmployees().filter((employee) => employee.status === status)
    : loadCustomEmployees()
  return list.map(customEmployeeToAgent)
}
