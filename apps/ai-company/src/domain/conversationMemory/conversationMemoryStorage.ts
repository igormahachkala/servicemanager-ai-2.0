/**
 * Conversation Memory V1 — localStorage (AI-COMPANY-111A).
 */

import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  CONVERSATION_MEMORY_STORAGE_KEY,
  CONVERSATION_MEMORY_SYNC_EVENT,
  CONVERSATION_MEMORY_VERSION,
  emptyWorkingMemory,
  type EmployeeConversationMemoryRecord,
  type EmployeeConversationMemoryStore,
  type EmployeeWorkingMemory,
} from './conversationMemoryTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CONVERSATION_MEMORY_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
}

function parseWorkingMemory(value: unknown): EmployeeWorkingMemory | null {
  if (!isRecord(value)) return null
  return {
    currentlyDoing: parseStringArray(value.currentlyDoing, 8),
    promisedToDo: parseStringArray(value.promisedToDo, 8),
    awaitingConfirmation: parseStringArray(value.awaitingConfirmation, 8),
    conversationSummary:
      typeof value.conversationSummary === 'string' ? value.conversationSummary : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso(),
  }
}

function parseRecord(value: unknown): EmployeeConversationMemoryRecord | null {
  if (!isRecord(value)) return null
  if (value.version !== CONVERSATION_MEMORY_VERSION || typeof value.employeeId !== 'string') {
    return null
  }
  const workingMemory = parseWorkingMemory(value.workingMemory)
  if (!workingMemory) return null
  return {
    version: CONVERSATION_MEMORY_VERSION,
    employeeId: value.employeeId,
    workingMemory,
  }
}

export function parseEmployeeConversationMemoryStore(
  value: unknown,
): EmployeeConversationMemoryStore | null {
  if (!isRecord(value)) return null
  if (value.version !== CONVERSATION_MEMORY_VERSION || !isRecord(value.employees)) return null

  const employees: Record<string, EmployeeConversationMemoryRecord> = {}
  for (const [key, recordValue] of Object.entries(value.employees)) {
    const record = parseRecord(recordValue)
    if (record) employees[key] = record
  }

  return { version: CONVERSATION_MEMORY_VERSION, employees }
}

function emptyStore(): EmployeeConversationMemoryStore {
  return { version: CONVERSATION_MEMORY_VERSION, employees: {} }
}

export function loadEmployeeConversationMemoryStore(): EmployeeConversationMemoryStore {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = localStorage.getItem(CONVERSATION_MEMORY_STORAGE_KEY)
    if (!raw) return emptyStore()
    return parseEmployeeConversationMemoryStore(JSON.parse(raw)) ?? emptyStore()
  } catch {
    return emptyStore()
  }
}

export function saveEmployeeConversationMemoryStore(store: EmployeeConversationMemoryStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CONVERSATION_MEMORY_STORAGE_KEY, JSON.stringify(store))
    emitSync()
  } catch {
    /* noop */
  }
}

export function getEmployeeWorkingMemory(employeeId: string): EmployeeWorkingMemory {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const store = loadEmployeeConversationMemoryStore()
  const existing = store.employees[canonical]
  return existing?.workingMemory ?? emptyWorkingMemory()
}

function workingMemorySignature(workingMemory: EmployeeWorkingMemory): string {
  return JSON.stringify({
    currentlyDoing: workingMemory.currentlyDoing,
    promisedToDo: workingMemory.promisedToDo,
    awaitingConfirmation: workingMemory.awaitingConfirmation,
    conversationSummary: workingMemory.conversationSummary,
  })
}

export function saveEmployeeWorkingMemory(
  employeeId: string,
  workingMemory: EmployeeWorkingMemory,
): EmployeeWorkingMemory {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const store = loadEmployeeConversationMemoryStore()
  const existing = store.employees[canonical]?.workingMemory
  const next: EmployeeWorkingMemory = {
    ...workingMemory,
    updatedAt: nowIso(),
  }

  if (existing && workingMemorySignature(existing) === workingMemorySignature(next)) {
    return existing
  }

  saveEmployeeConversationMemoryStore({
    ...store,
    employees: {
      ...store.employees,
      [canonical]: {
        version: CONVERSATION_MEMORY_VERSION,
        employeeId: canonical,
        workingMemory: next,
      },
    },
  })

  return next
}
