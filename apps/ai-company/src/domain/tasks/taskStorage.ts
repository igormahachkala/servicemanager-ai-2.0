import {
  createDeliveryTask,
  parseDeliveryTask,
  type CreateDeliveryTaskInput,
  type DeliveryTask,
} from './task'

const STORAGE_KEY = 'ai-company-delivery-tasks'

export function loadDeliveryTasks(): DeliveryTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseDeliveryTask).filter((item): item is DeliveryTask => item !== null)
  } catch {
    return []
  }
}

export function saveDeliveryTasks(tasks: DeliveryTask[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    /* noop */
  }
}

export function getDeliveryTaskById(id: string): DeliveryTask | null {
  return loadDeliveryTasks().find((item) => item.id === id) ?? null
}

export function getDeliveryTasksByProjectId(projectId: string): DeliveryTask[] {
  return loadDeliveryTasks().filter((item) => item.projectId === projectId)
}

export function getDeliveryTasksByWorkspaceId(workspaceId: string): DeliveryTask[] {
  return loadDeliveryTasks().filter((item) => item.workspaceId === workspaceId)
}

export function upsertDeliveryTasks(items: DeliveryTask[]): void {
  const current = loadDeliveryTasks()
  const next = [...current]
  for (const item of items) {
    const index = next.findIndex((entry) => entry.id === item.id)
    if (index >= 0) next[index] = item
    else next.push(item)
  }
  saveDeliveryTasks(next)
}

export function addDeliveryTask(input: CreateDeliveryTaskInput): DeliveryTask {
  const created = createDeliveryTask(input)
  saveDeliveryTasks([...loadDeliveryTasks(), created])
  return created
}

export { STORAGE_KEY }
