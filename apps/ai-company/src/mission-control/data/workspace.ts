export type WorkspaceStatus = 'draft' | 'active' | 'maintenance' | 'archived'

export type Workspace = {
  id: string
  name: string
  description: string
  status: WorkspaceStatus
  createdAt: string
  updatedAt: string
}

export type CreateWorkspaceInput = {
  name: string
  description: string
  status?: WorkspaceStatus
}

const STORAGE_KEY = 'ai-company-workspaces'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
    status,
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
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }

  saveWorkspaces([...loadWorkspaces(), workspace])
  return workspace
}

export function updateWorkspace(id: string, patch: Partial<Pick<Workspace, 'name' | 'description' | 'status'>>): Workspace | null {
  const workspaces = loadWorkspaces()
  const index = workspaces.findIndex((item) => item.id === id)
  if (index === -1) return null

  const now = new Date().toISOString()
  const updated: Workspace = {
    ...workspaces[index],
    ...patch,
    updatedAt: now,
  }

  const next = [...workspaces]
  next[index] = updated
  saveWorkspaces(next)
  return updated
}
