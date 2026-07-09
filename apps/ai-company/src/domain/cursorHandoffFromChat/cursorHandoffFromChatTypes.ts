/**
 * Cursor Handoff from MAX Chat V1 (AI-COMPANY-110C).
 * Cursor — external tool, not employee. No Cursor API in V1.
 */

export const CURSOR_HANDOFF_FROM_CHAT_VERSION = 'v1' as const

export const CURSOR_HANDOFF_FROM_CHAT_STATUSES = [
  'proposal',
  'copied',
  'sent',
  'result_pending',
  'rejected',
  'max_task_created',
] as const

export type CursorHandoffFromChatStatus = (typeof CURSOR_HANDOFF_FROM_CHAT_STATUSES)[number]

export const CURSOR_HANDOFF_FROM_CHAT_HISTORY_KINDS = [
  'created',
  'copied',
  'marked_sent',
  'rejected',
  'result_pending',
  'max_task_created',
] as const

export type CursorHandoffFromChatHistoryKind =
  (typeof CURSOR_HANDOFF_FROM_CHAT_HISTORY_KINDS)[number]

export type CursorHandoffFromChatHistoryEntry = {
  id: string
  kind: CursorHandoffFromChatHistoryKind
  at: string
  messageId: string | null
}

export type CursorHandoffFromChatProposal = {
  id: string
  version: typeof CURSOR_HANDOFF_FROM_CHAT_VERSION
  chatId: string
  employeeId: string
  ownerMessageId: string
  proposalMessageId: string
  ownerPrompt: string
  title: string
  goal: string
  markdown: string
  fileScope: string[]
  workingBranch: string
  status: CursorHandoffFromChatStatus
  workItemId: string | null
  history: CursorHandoffFromChatHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export type BuildCursorHandoffFromChatInput = {
  chatId: string
  employeeId: string
  ownerMessageId: string
  ownerPrompt: string
}

export type CursorHandoffFromChatContext = {
  recentOwnerMessages: string[]
  employeeCodename: string
}
