export {
  CONVERSATION_MEMORY_MESSAGE_WINDOW,
  CONVERSATION_MEMORY_STORAGE_KEY,
  CONVERSATION_MEMORY_SYNC_EVENT,
  CONVERSATION_MEMORY_SUMMARY_MAX_CHARS,
  CONVERSATION_MEMORY_VERSION,
  emptyWorkingMemory,
} from './conversationMemoryTypes'

export type {
  ConversationMemoryContextItem,
  ConversationMemoryRecentMessage,
  EmployeeConversationContext,
  EmployeeConversationMemoryRecord,
  EmployeeConversationMemoryStore,
  EmployeeWorkingMemory,
} from './conversationMemoryTypes'

export {
  getEmployeeWorkingMemory,
  loadEmployeeConversationMemoryStore,
  parseEmployeeConversationMemoryStore,
  saveEmployeeConversationMemoryStore,
  saveEmployeeWorkingMemory,
} from './conversationMemoryStorage'

export {
  buildHeuristicConversationSummary,
  splitMessagesForContextWindow,
} from './conversationMemorySummary'

export {
  buildEmployeeConversationContext,
  formatEmployeeConversationContextForPrompt,
  getConversationMemoryStats,
} from './conversationMemoryContext'

export {
  recordConversationExchange,
  refreshEmployeeWorkingMemory,
} from './conversationMemoryWorkingMemory'
