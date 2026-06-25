export type AssignmentStatus = 'active' | 'paused' | 'ended'

export type Assignment = {
  id: string
  employeeId: string
  workspaceId: string
  role: string
  loadPercent: number
  status: AssignmentStatus
  createdAt: string
  updatedAt: string
}

export type CreateAssignmentInput = {
  employeeId: string
  workspaceId: string
  role: string
  loadPercent: number
  status?: AssignmentStatus
}

const STORAGE_KEY = 'ai-company-assignments'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampLoad(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function parseAssignment(value: unknown): Assignment | null {
  if (!isRecord(value)) return null

  const status =
    value.status === 'active' || value.status === 'paused' || value.status === 'ended'
      ? value.status
      : 'active'

  if (
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.role !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const loadPercent = clampLoad(typeof value.loadPercent === 'number' ? value.loadPercent : 0)

  return {
    id: value.id,
    employeeId: value.employeeId,
    workspaceId: value.workspaceId,
    role: value.role,
    loadPercent,
    status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadAssignments(): Assignment[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseAssignment).filter((item): item is Assignment => item !== null)
  } catch {
    return []
  }
}

export function saveAssignments(assignments: Assignment[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
  } catch {
    /* noop */
  }
}

export function getAssignmentById(id: string): Assignment | null {
  return loadAssignments().find((item) => item.id === id) ?? null
}

export function getAssignmentsByWorkspaceId(workspaceId: string): Assignment[] {
  return loadAssignments().filter((item) => item.workspaceId === workspaceId)
}

export function getAssignmentsByEmployeeId(employeeId: string): Assignment[] {
  return loadAssignments().filter((item) => item.employeeId === employeeId)
}

export function createAssignment(input: CreateAssignmentInput): Assignment {
  const now = new Date().toISOString()
  const assignment: Assignment = {
    id: `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: input.employeeId,
    workspaceId: input.workspaceId,
    role: input.role.trim(),
    loadPercent: clampLoad(input.loadPercent),
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }

  saveAssignments([...loadAssignments(), assignment])
  return assignment
}

export function updateAssignment(
  id: string,
  patch: Partial<Pick<Assignment, 'role' | 'loadPercent' | 'status'>>,
): Assignment | null {
  const assignments = loadAssignments()
  const index = assignments.findIndex((item) => item.id === id)
  if (index === -1) return null

  const now = new Date().toISOString()
  const current = assignments[index]
  const updated: Assignment = {
    ...current,
    role: patch.role !== undefined ? patch.role.trim() : current.role,
    loadPercent: patch.loadPercent !== undefined ? clampLoad(patch.loadPercent) : current.loadPercent,
    status: patch.status ?? current.status,
    updatedAt: now,
  }

  const next = [...assignments]
  next[index] = updated
  saveAssignments(next)
  return updated
}

export function removeAssignment(id: string): boolean {
  const assignments = loadAssignments()
  const next = assignments.filter((item) => item.id !== id)
  if (next.length === assignments.length) return false
  saveAssignments(next)
  return true
}
