/**
 * Conversation Memory V1 — types (AI-COMPANY-111A).
 * Per-employee working memory + context window for MAX chat.
 */

export const CONVERSATION_MEMORY_VERSION = 'v1' as const

export const CONVERSATION_MEMORY_STORAGE_KEY = 'ai-company-employee-conversation-memory'

export const CONVERSATION_MEMORY_SYNC_EVENT = 'ai-company-employee-conversation-memory-sync'

/** Max messages included in the live context window sent to MAX. */
export const CONVERSATION_MEMORY_MESSAGE_WINDOW = 50

/** Max chars for the rolling summary of older messages. */
export const CONVERSATION_MEMORY_SUMMARY_MAX_CHARS = 600

export type EmployeeWorkingMemory = {
  /** What the employee is executing right now (from queue + runtime). */
  currentlyDoing: string[]
  /** Commitments MAX made in chat (proposals, follow-ups). */
  promisedToDo: string[]
  /** Items waiting for Owner confirmation. */
  awaitingConfirmation: string[]
  /** Heuristic summary of messages older than the context window. */
  conversationSummary: string | null
  updatedAt: string
}

export type EmployeeConversationMemoryRecord = {
  version: typeof CONVERSATION_MEMORY_VERSION
  employeeId: string
  workingMemory: EmployeeWorkingMemory
}

export type EmployeeConversationMemoryStore = {
  version: typeof CONVERSATION_MEMORY_VERSION
  employees: Record<string, EmployeeConversationMemoryRecord>
}

export type ConversationMemoryContextItem = {
  label: string
  detail: string | null
}

export type ConversationMemoryRecentMessage = {
  role: 'owner' | 'max' | 'system'
  kind: string
  content: string
  createdAt: string
}

/** Snapshot assembled before each MAX response. */
export type EmployeeConversationContext = {
  employeeId: string
  messageWindow: ConversationMemoryRecentMessage[]
  olderMessageCount: number
  conversationSummary: string | null
  workingMemory: EmployeeWorkingMemory
  activeTasks: ConversationMemoryContextItem[]
  recentReports: ConversationMemoryContextItem[]
  pendingHandoffs: ConversationMemoryContextItem[]
  recentDecisions: ConversationMemoryContextItem[]
}

export function emptyWorkingMemory(now: string = new Date().toISOString()): EmployeeWorkingMemory {
  return {
    currentlyDoing: [],
    promisedToDo: [],
    awaitingConfirmation: [],
    conversationSummary: null,
    updatedAt: now,
  }
}
