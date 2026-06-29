import type { MemoryEvolutionRecord, MemoryEvolutionStats, MemoryEvolutionTodaySummary } from './memoryEvolution'

const STORAGE_KEY = 'ai-company-memory-evolution'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseLesson(value: unknown): MemoryEvolutionRecord['lessons'][number] | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.content !== 'string' ||
    (value.category !== 'finding' &&
      value.category !== 'mistake' &&
      value.category !== 'improvement' &&
      value.category !== 'knowledge')
  ) {
    return null
  }
  return {
    id: value.id,
    category: value.category,
    title: value.title,
    content: value.content,
  }
}

function parseRecord(value: unknown): MemoryEvolutionRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.runId !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !Array.isArray(value.lessons)
  ) {
    return null
  }

  const lessons = value.lessons.map(parseLesson).filter((item): item is NonNullable<typeof item> => item !== null)

  return {
    id: value.id,
    runId: value.runId,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    employeeId: value.employeeId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    lessons,
    memoryEntryIds: Array.isArray(value.memoryEntryIds)
      ? value.memoryEntryIds.filter((item): item is string => typeof item === 'string')
      : [],
    knowledgeItemIds: Array.isArray(value.knowledgeItemIds)
      ? value.knowledgeItemIds.filter((item): item is string => typeof item === 'string')
      : [],
    experienceEventId: typeof value.experienceEventId === 'string' ? value.experienceEventId : null,
    experiencePoints: typeof value.experiencePoints === 'number' ? value.experiencePoints : 0,
    createdAt: value.createdAt,
  }
}

export function loadEvolutionRecords(): MemoryEvolutionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseRecord).filter((item): item is MemoryEvolutionRecord => item !== null)
  } catch {
    return []
  }
}

export function saveEvolutionRecords(records: MemoryEvolutionRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* noop */
  }
}

export function getEvolutionByRunId(runId: string): MemoryEvolutionRecord | null {
  return loadEvolutionRecords().find((item) => item.runId === runId) ?? null
}

export function getEvolutionForEmployee(employeeId: string): MemoryEvolutionRecord[] {
  return loadEvolutionRecords()
    .filter((item) => item.employeeId === employeeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function upsertEvolutionRecord(record: MemoryEvolutionRecord): MemoryEvolutionRecord {
  const records = loadEvolutionRecords().filter((item) => item.runId !== record.runId)
  saveEvolutionRecords([record, ...records])
  return record
}

function isToday(iso: string): boolean {
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function computeEvolutionStats(employeeId?: string): MemoryEvolutionStats {
  const records = employeeId
    ? getEvolutionForEmployee(employeeId)
    : loadEvolutionRecords()
  const today = records.filter((item) => isToday(item.createdAt))

  return {
    totalEvolutions: records.length,
    todayLessons: today.reduce((sum, item) => sum + item.lessons.length, 0),
    todayExperience: today.reduce((sum, item) => sum + item.experiencePoints, 0),
    todayKnowledge: today.reduce((sum, item) => sum + item.knowledgeItemIds.length, 0),
    todayMemory: today.reduce((sum, item) => sum + item.memoryEntryIds.length, 0),
  }
}

export function getTodayEvolutionSummary(employeeId: string): MemoryEvolutionTodaySummary {
  const records = getEvolutionForEmployee(employeeId).filter((item) => isToday(item.createdAt))
  const learnedToday = records.flatMap((item) => item.lessons)

  return {
    learnedToday,
    experienceGained: records.reduce((sum, item) => sum + item.experiencePoints, 0),
    knowledgeAdded: records.reduce((sum, item) => sum + item.knowledgeItemIds.length, 0),
    memoryAdded: records.reduce((sum, item) => sum + item.memoryEntryIds.length, 0),
    records,
  }
}
