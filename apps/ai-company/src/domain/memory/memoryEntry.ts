import type { MemoryType } from './memoryTypes'
import type { MemoryImportance } from './memoryImportance'
import type { MemoryRetention } from './memoryRetention'

export type MemorySource =
  | 'conversation'
  | 'discussion'
  | 'task'
  | 'workspace'
  | 'manual'
  | 'system'
  | 'document'
  | 'run'

export type MemoryEntry = {
  id: string
  employeeId: string
  type: MemoryType
  title: string
  summary: string
  content: string
  importance: MemoryImportance
  retention: MemoryRetention
  tags: string[]
  workspaceId: string | null
  source: MemorySource
  createdAt: string
  updatedAt: string
}

export type CreateMemoryInput = {
  employeeId: string
  type: MemoryType
  title: string
  summary: string
  content: string
  importance: MemoryImportance
  retention?: MemoryRetention
  tags?: string[]
  workspaceId?: string | null
  source?: MemorySource
}

export type MemoryFilter = {
  type?: MemoryType | 'all'
  importance?: MemoryImportance | 'all'
  workspaceId?: string | 'all'
  tag?: string | 'all'
}

export type MemoryStats = {
  total: number
  byType: Record<MemoryType, number>
  byImportance: Record<MemoryImportance, number>
  withWorkspace: number
  recentWeek: number
}
