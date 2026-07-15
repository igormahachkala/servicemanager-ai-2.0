/**
 * Build MAX conversation context from chat + domain snapshots (111A).
 */

import { buildMobileOwnerDecisionsSnapshot } from '../mobileOwnerDecisions/mobileOwnerDecisionsSnapshot'
import { loadEmployeeWorkItems } from '../employeeWorkQueue'
import { loadCursorHandoffFromChatProposals } from '../cursorHandoffFromChat'
import { buildMobileReportsSnapshot } from '../../mobile/reports/mobileReportsSnapshot'
import { getMobileEmployeeChatSession } from '../../mobile/chat/mobileEmployeeChatStorage'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { computeEmployeeWorkingMemory } from './conversationMemoryWorkingMemory'
import {
  CONVERSATION_MEMORY_MESSAGE_WINDOW,
  type ConversationMemoryContextItem,
  type ConversationMemoryRecentMessage,
  type EmployeeConversationContext,
} from './conversationMemoryTypes'
import { splitMessagesForContextWindow } from './conversationMemorySummary'

const ACTIVE_TASK_STATUSES = new Set(['pending', 'scheduled', 'in_progress', 'blocked'])
const OPEN_HANDOFF_STATUSES = new Set(['proposal', 'copied', 'sent', 'result_pending'])

function toRecentMessage(
  message: ReturnType<typeof getMobileEmployeeChatSession>['messages'][number],
): ConversationMemoryRecentMessage {
  return {
    role: message.role,
    kind: message.kind,
    content: message.content,
    createdAt: message.createdAt,
  }
}

function buildActiveTasks(employeeId: string): ConversationMemoryContextItem[] {
  return loadEmployeeWorkItems()
    .filter(
      (item) => item.employeeId === employeeId && ACTIVE_TASK_STATUSES.has(item.status),
    )
    .sort((a, b) => {
      const rank = (status: string) =>
        status === 'in_progress' ? 0 : status === 'blocked' ? 1 : 2
      return rank(a.status) - rank(b.status) || b.updatedAt.localeCompare(a.updatedAt)
    })
    .slice(0, 6)
    .map((item) => ({
      label: item.title,
      detail: `[${item.status}] ${item.summary ?? item.taskText?.slice(0, 80) ?? ''}`.trim(),
    }))
}

function buildRecentReports(employeeId: string): ConversationMemoryContextItem[] {
  const snapshot = buildMobileReportsSnapshot()
  return snapshot.items
    .filter((item) => !item.employeeId || item.employeeId === employeeId)
    .slice(0, 5)
    .map((item) => ({
      label: item.title,
      detail: item.summary.slice(0, 120),
    }))
}

function buildPendingHandoffs(employeeId: string): ConversationMemoryContextItem[] {
  return loadCursorHandoffFromChatProposals()
    .filter(
      (item) => item.employeeId === employeeId && OPEN_HANDOFF_STATUSES.has(item.status),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((item) => ({
      label: item.title,
      detail: `${item.status} — ${item.goal.slice(0, 100)}`,
    }))
}

function buildRecentDecisions(employeeId: string): ConversationMemoryContextItem[] {
  return buildMobileOwnerDecisionsSnapshot()
    .filter((item) => !item.employeeId || item.employeeId === employeeId)
    .slice(0, 5)
    .map((item) => ({
      label: item.title,
      detail: item.reason?.slice(0, 100) ?? item.risk,
    }))
}

export function buildEmployeeConversationContext(
  employeeId: string,
): EmployeeConversationContext {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const session = getMobileEmployeeChatSession(canonical)
  const workingMemory = computeEmployeeWorkingMemory(canonical, session.messages)
  const { windowMessages, olderMessages } = splitMessagesForContextWindow(session.messages)

  return {
    employeeId: canonical,
    messageWindow: windowMessages.map(toRecentMessage),
    olderMessageCount: olderMessages.length,
    conversationSummary: workingMemory.conversationSummary,
    workingMemory,
    activeTasks: buildActiveTasks(canonical),
    recentReports: buildRecentReports(canonical),
    pendingHandoffs: buildPendingHandoffs(canonical),
    recentDecisions: buildRecentDecisions(canonical),
  }
}

export function formatEmployeeConversationContextForPrompt(
  context: EmployeeConversationContext,
  currentOwnerMessage: string,
): string {
  const sections: string[] = []

  if (context.conversationSummary) {
    sections.push(`Conversation summary:\n${context.conversationSummary}`)
  }

  const wm = context.workingMemory
  if (
    wm.currentlyDoing.length > 0 ||
    wm.promisedToDo.length > 0 ||
    wm.awaitingConfirmation.length > 0
  ) {
    const lines: string[] = ['Working memory:']
    if (wm.currentlyDoing.length > 0) {
      lines.push(`- Currently doing: ${wm.currentlyDoing.join('; ')}`)
    }
    if (wm.promisedToDo.length > 0) {
      lines.push(`- Promised: ${wm.promisedToDo.join('; ')}`)
    }
    if (wm.awaitingConfirmation.length > 0) {
      lines.push(`- Awaiting Owner confirmation: ${wm.awaitingConfirmation.join('; ')}`)
    }
    sections.push(lines.join('\n'))
  }

  if (context.activeTasks.length > 0) {
    sections.push(
      `Active tasks:\n${context.activeTasks.map((item) => `- ${item.label}${item.detail ? ` — ${item.detail}` : ''}`).join('\n')}`,
    )
  }

  if (context.recentReports.length > 0) {
    sections.push(
      `Recent reports:\n${context.recentReports.map((item) => `- ${item.label}${item.detail ? `: ${item.detail}` : ''}`).join('\n')}`,
    )
  }

  if (context.pendingHandoffs.length > 0) {
    sections.push(
      `Open Cursor handoffs:\n${context.pendingHandoffs.map((item) => `- ${item.label}${item.detail ? ` — ${item.detail}` : ''}`).join('\n')}`,
    )
  }

  if (context.recentDecisions.length > 0) {
    sections.push(
      `Recent Owner decisions:\n${context.recentDecisions.map((item) => `- ${item.label}${item.detail ? `: ${item.detail}` : ''}`).join('\n')}`,
    )
  }

  if (context.messageWindow.length > 0) {
    const transcript = context.messageWindow
      .filter((item) => item.role !== 'system')
      .slice(-CONVERSATION_MEMORY_MESSAGE_WINDOW)
      .map((item) => {
        const speaker = item.role === 'owner' ? 'Owner' : 'MAX'
        return `${speaker}: ${item.content.replace(/\s+/g, ' ').trim()}`
      })
      .join('\n')
    if (transcript) {
      sections.push(`Recent messages:\n${transcript}`)
    }
  }

  sections.push(`Owner: ${currentOwnerMessage.trim()}\n\nMAX:`)

  return sections.join('\n\n')
}

export function getConversationMemoryStats(context: EmployeeConversationContext): {
  messageCount: number
  windowSize: number
  olderCount: number
  hasWorkingMemory: boolean
} {
  return {
    messageCount: context.messageWindow.length + context.olderMessageCount,
    windowSize: context.messageWindow.length,
    olderCount: context.olderMessageCount,
    hasWorkingMemory:
      context.workingMemory.currentlyDoing.length > 0 ||
      context.workingMemory.promisedToDo.length > 0 ||
      context.workingMemory.awaitingConfirmation.length > 0 ||
      Boolean(context.conversationSummary),
  }
}
