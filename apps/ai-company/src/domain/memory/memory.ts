import { MEMORY_TYPES } from './memoryTypes'
import type { MemoryType } from './memoryTypes'
import { MEMORY_IMPORTANCE_LEVELS, IMPORTANCE_WEIGHT } from './memoryImportance'
import type { MemoryImportance } from './memoryImportance'
import type { MemoryRetention } from './memoryRetention'
import type {
  CreateMemoryInput,
  MemoryEntry,
  MemoryFilter,
  MemorySource,
  MemoryStats,
} from './memoryEntry'

export type { MemoryEntry, CreateMemoryInput, MemoryFilter, MemoryStats, MemorySource } from './memoryEntry'
export type { MemoryType } from './memoryTypes'
export type { MemoryImportance } from './memoryImportance'
export type { MemoryRetention } from './memoryRetention'
export { MEMORY_TYPES, MEMORY_TYPE_META } from './memoryTypes'
export { MEMORY_IMPORTANCE_LEVELS, IMPORTANCE_WEIGHT } from './memoryImportance'
export { MEMORY_RETENTION_POLICIES } from './memoryRetention'

const STORAGE_KEY = 'ai-company-employee-memory'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseMemoryType(value: unknown): MemoryType | null {
  return typeof value === 'string' && (MEMORY_TYPES as readonly string[]).includes(value)
    ? (value as MemoryType)
    : null
}

function parseImportance(value: unknown): MemoryImportance {
  if (
    value === 'low' ||
    value === 'normal' ||
    value === 'high' ||
    value === 'critical'
  ) {
    return value
  }
  return 'normal'
}

function parseRetention(value: unknown): MemoryRetention {
  if (
    value === 'session' ||
    value === 'short' ||
    value === 'long' ||
    value === 'permanent'
  ) {
    return value
  }
  return 'long'
}

function parseSource(value: unknown): MemorySource {
  const allowed: MemorySource[] = [
    'conversation',
    'discussion',
    'task',
    'workspace',
    'manual',
    'system',
    'document',
    'run',
  ]
  return allowed.includes(value as MemorySource) ? (value as MemorySource) : 'manual'
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseEntry(value: unknown): MemoryEntry | null {
  if (!isRecord(value)) return null
  const type = parseMemoryType(value.type)
  if (
    !type ||
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    employeeId: value.employeeId,
    type,
    title: value.title,
    summary: value.summary,
    content: value.content,
    importance: parseImportance(value.importance),
    retention: parseRetention(value.retention),
    tags: parseTags(value.tags),
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    source: parseSource(value.source),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadMemoryEntries(): MemoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseEntry).filter((item): item is MemoryEntry => item !== null)
  } catch {
    return []
  }
}

export function saveMemoryEntries(entries: MemoryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* noop */
  }
}

export function getMemoriesByEmployee(employeeId: string): MemoryEntry[] {
  return loadMemoryEntries()
    .filter((entry) => entry.employeeId === employeeId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function createMemory(input: CreateMemoryInput): MemoryEntry {
  const now = new Date().toISOString()
  const entry: MemoryEntry = {
    id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: input.employeeId,
    type: input.type,
    title: input.title.trim(),
    summary: input.summary.trim(),
    content: input.content.trim(),
    importance: input.importance,
    retention: input.retention ?? 'long',
    tags: input.tags ?? [],
    workspaceId: input.workspaceId ?? null,
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
  }

  saveMemoryEntries([...loadMemoryEntries(), entry])
  return entry
}

export function filterMemories(entries: MemoryEntry[], filter: MemoryFilter): MemoryEntry[] {
  return entries.filter((entry) => {
    if (filter.type && filter.type !== 'all' && entry.type !== filter.type) return false
    if (filter.importance && filter.importance !== 'all' && entry.importance !== filter.importance) {
      return false
    }
    if (filter.workspaceId && filter.workspaceId !== 'all') {
      if (filter.workspaceId === 'none' && entry.workspaceId !== null) return false
      if (filter.workspaceId !== 'none' && entry.workspaceId !== filter.workspaceId) return false
    }
    if (filter.tag && filter.tag !== 'all' && !entry.tags.includes(filter.tag)) return false
    return true
  })
}

export function searchMemories(entries: MemoryEntry[], query: string): MemoryEntry[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return entries

  return entries.filter((entry) => {
    const haystack = [
      entry.title,
      entry.summary,
      entry.content,
      entry.type,
      entry.source,
      ...entry.tags,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

export function computeMemoryStats(entries: MemoryEntry[]): MemoryStats {
  const byType = {} as Record<MemoryType, number>
  for (const type of MEMORY_TYPES) byType[type] = 0

  const byImportance = {} as Record<MemoryImportance, number>
  for (const level of MEMORY_IMPORTANCE_LEVELS) byImportance[level] = 0

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  let withWorkspace = 0
  let recentWeek = 0

  for (const entry of entries) {
    byType[entry.type] += 1
    byImportance[entry.importance] += 1
    if (entry.workspaceId) withWorkspace += 1
    if (new Date(entry.updatedAt).getTime() >= weekAgo) recentWeek += 1
  }

  return {
    total: entries.length,
    byType,
    byImportance,
    withWorkspace,
    recentWeek,
  }
}

export function collectTags(entries: MemoryEntry[]): string[] {
  const set = new Set<string>()
  for (const entry of entries) {
    for (const tag of entry.tags) set.add(tag)
  }
  return [...set].sort()
}

export function ensureSeedMemories(employeeId: string): void {
  const existing = getMemoriesByEmployee(employeeId)
  if (existing.length > 0) return

  const now = Date.now()
  const daysAgo = (days: number) => new Date(now - days * 86400000).toISOString()

  const seeds: Omit<CreateMemoryInput, 'employeeId'>[] = [
    {
      type: 'conversation',
      title: 'Owner alignment on V1 priorities',
      summary: 'Clarified platform scope: Employee-centric, no direct tool access.',
      content:
        'Owner confirmed that Memory belongs to Employee identity, not to any LLM runtime. Future context assembly will read from this store.',
      importance: 'high',
      retention: 'permanent',
      tags: ['platform', 'v1', 'owner'],
      workspaceId: null,
      source: 'conversation',
    },
    {
      type: 'decision',
      title: 'Tool Registry as mandatory gateway',
      summary: 'All external integrations must flow through Tool Registry.',
      content:
        'Decision recorded per ADR-002. Employees never invoke MCP/GitHub/Docker directly.',
      importance: 'critical',
      retention: 'permanent',
      tags: ['architecture', 'tools'],
      workspaceId: null,
      source: 'system',
    },
    {
      type: 'knowledge',
      title: 'Workspace vs Employee memory boundary',
      summary: 'Project knowledge lives in Workspace; Employee memory is personal context.',
      content:
        'Workspace Knowledge (future) is separate from Employee Memory. Assignment links Employee to Workspace scope.',
      importance: 'normal',
      retention: 'long',
      tags: ['workspace', 'knowledge'],
      workspaceId: null,
      source: 'document',
    },
    {
      type: 'experience',
      title: 'Mission Control rollout patterns',
      summary: 'Local-first UI with localStorage persistence before Runtime.',
      content:
        'Pattern: domain layer → hook → page → components. Build green before backend.',
      importance: 'normal',
      retention: 'long',
      tags: ['mission-control', 'patterns'],
      workspaceId: null,
      source: 'task',
    },
  ]

  const seeded: MemoryEntry[] = seeds.map((seed, index) => {
    const timestamp = daysAgo(seeds.length - index)
    return {
      id: `memory-seed-${employeeId}-${index}`,
      employeeId,
      type: seed.type,
      title: seed.title,
      summary: seed.summary,
      content: seed.content,
      importance: seed.importance,
      retention: seed.retention ?? 'long',
      tags: seed.tags ?? [],
      workspaceId: seed.workspaceId ?? null,
      source: seed.source ?? 'system',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })

  saveMemoryEntries([...loadMemoryEntries(), ...seeded])
}

/** Future capabilities — not implemented in V1. */
export const MEMORY_FUTURE_CAPABILITIES = [
  'semanticSearch',
  'embeddings',
  'vectorDb',
  'summaries',
  'llmContextBuilder',
] as const

export type MemoryFutureCapability = (typeof MEMORY_FUTURE_CAPABILITIES)[number]

export function sortByImportance(entries: MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort((a, b) => {
    const diff = IMPORTANCE_WEIGHT[b.importance] - IMPORTANCE_WEIGHT[a.importance]
    if (diff !== 0) return diff
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}
