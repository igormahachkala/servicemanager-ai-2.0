export type WorkspaceStatus = 'draft' | 'active' | 'maintenance' | 'archived'

export type WorkspaceType = 'general' | 'product' | 'engineering' | 'operations' | 'research'

export type Workspace = {
  id: string
  name: string
  description: string
  type: WorkspaceType
  status: WorkspaceStatus
  owner: string
  createdAt: string
  updatedAt: string
}

export type CreateWorkspaceInput = {
  name: string
  description: string
  type?: WorkspaceType
  status?: WorkspaceStatus
  owner?: string
}

const STORAGE_KEY = 'ai-company-workspaces'

const WORKSPACE_TYPES: WorkspaceType[] = [
  'general',
  'product',
  'engineering',
  'operations',
  'research',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseWorkspaceType(value: unknown): WorkspaceType {
  if (typeof value === 'string' && WORKSPACE_TYPES.includes(value as WorkspaceType)) {
    return value as WorkspaceType
  }
  return 'general'
}

function parseWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value)) return null

  const status =
    value.status === 'draft' ||
    value.status === 'active' ||
    value.status === 'maintenance' ||
    value.status === 'archived'
      ? value.status
      : 'draft'

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    name: value.name,
    description: value.description,
    type: parseWorkspaceType(value.type),
    status,
    owner: typeof value.owner === 'string' ? value.owner : '',
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadWorkspaces(): Workspace[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseWorkspace).filter((item): item is Workspace => item !== null)
  } catch {
    return []
  }
}

export function saveWorkspaces(workspaces: Workspace[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces))
  } catch {
    /* noop */
  }
}

export function getWorkspaceById(id: string): Workspace | null {
  return loadWorkspaces().find((workspace) => workspace.id === id) ?? null
}

export function createWorkspace(input: CreateWorkspaceInput): Workspace {
  const now = new Date().toISOString()
  const workspace: Workspace = {
    id: `workspace-${Date.now()}`,
    name: input.name.trim(),
    description: input.description.trim(),
    type: input.type ?? 'general',
    status: input.status ?? 'active',
    owner: (input.owner ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  }

  saveWorkspaces([...loadWorkspaces(), workspace])
  return workspace
}

export function updateWorkspace(
  id: string,
  patch: Partial<Pick<Workspace, 'name' | 'description' | 'type' | 'status' | 'owner'>>,
): Workspace | null {
  const workspaces = loadWorkspaces()
  const index = workspaces.findIndex((item) => item.id === id)
  if (index === -1) return null

  const now = new Date().toISOString()
  const current = workspaces[index]
  const updated: Workspace = {
    ...current,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    description: patch.description !== undefined ? patch.description.trim() : current.description,
    type: patch.type ?? current.type,
    status: patch.status ?? current.status,
    owner: patch.owner !== undefined ? patch.owner.trim() : current.owner,
    updatedAt: now,
  }

  const next = [...workspaces]
  next[index] = updated
  saveWorkspaces(next)
  return updated
}

export { WORKSPACE_TYPES }
