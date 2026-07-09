/**
 * Heuristic rolling summary for messages outside the context window (111A).
 * No extra LLM call — deterministic extraction only.
 */

import type { MobileEmployeeChatMessage } from '../../mobile/chat/mobileEmployeeChat'
import {
  CONVERSATION_MEMORY_MESSAGE_WINDOW,
  CONVERSATION_MEMORY_SUMMARY_MAX_CHARS,
} from './conversationMemoryTypes'

function truncate(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function describeMessage(message: MobileEmployeeChatMessage): string | null {
  if (message.role === 'system') return null
  const prefix = message.role === 'owner' ? 'Owner' : 'MAX'
  if (message.kind === 'task_proposal' && message.taskProposal?.title) {
    return `${prefix} proposed task «${truncate(message.taskProposal.title, 60)}»`
  }
  if (message.kind === 'cursor_handoff') {
    return `${prefix} prepared Cursor handoff`
  }
  if (message.kind === 'report_link' && message.reportId) {
    return `${prefix} linked report ${message.reportId}`
  }
  const snippet = truncate(message.content, 72)
  if (!snippet) return null
  return `${prefix}: ${snippet}`
}

export function splitMessagesForContextWindow(
  messages: MobileEmployeeChatMessage[],
): {
  windowMessages: MobileEmployeeChatMessage[]
  olderMessages: MobileEmployeeChatMessage[]
} {
  const eligible = messages.filter((item) => !item.pending)
  if (eligible.length <= CONVERSATION_MEMORY_MESSAGE_WINDOW) {
    return { windowMessages: eligible, olderMessages: [] }
  }
  const olderMessages = eligible.slice(0, eligible.length - CONVERSATION_MEMORY_MESSAGE_WINDOW)
  const windowMessages = eligible.slice(-CONVERSATION_MEMORY_MESSAGE_WINDOW)
  return { windowMessages, olderMessages }
}

export function buildHeuristicConversationSummary(
  olderMessages: MobileEmployeeChatMessage[],
  previousSummary: string | null,
): string | null {
  if (olderMessages.length === 0) {
    return previousSummary?.trim() || null
  }

  const lines: string[] = []
  if (previousSummary?.trim()) {
    lines.push(truncate(previousSummary.trim(), 200))
  }

  const highlights = olderMessages
    .map(describeMessage)
    .filter((item): item is string => item !== null)
    .slice(-12)

  if (highlights.length > 0) {
    lines.push(`Earlier (${olderMessages.length} msgs): ${highlights.join('; ')}`)
  } else {
    lines.push(`Earlier: ${olderMessages.length} messages in history.`)
  }

  const joined = lines.join(' ')
  return truncate(joined, CONVERSATION_MEMORY_SUMMARY_MAX_CHARS)
}
