/**
 * Orchestration: Owner message in MAX Chat → Cursor Handoff Proposal (110C).
 */

import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import { createEmployeeWorkItem } from '../employeeWorkQueue/employeeWorkQueueStorage'
import type { Chat } from '../chats/chat'
import { parseChatRef } from '../chats/chatTypes'
import {
  appendConversationSystemMessage,
  appendEmployeeCursorHandoffProposal,
  appendOwnerMessage as appendConversationOwnerMessage,
  resolveEmployee,
} from '../../mission-control/data/conversation'
import {
  appendMobileEmployeeChatMessage,
} from '../../mobile/chat/mobileEmployeeChatStorage'
import { createMobileEmployeeChatMessageId } from '../../mobile/chat/mobileEmployeeChat'
import { detectCursorHandoffIntent } from './cursorHandoffFromChatDetect'
import {
  createCursorHandoffFromChatProposal,
  getCursorHandoffFromChatById,
  linkCursorHandoffWorkItem,
  markCursorHandoffCopied,
  markCursorHandoffSent,
  rejectCursorHandoffFromChat,
} from './cursorHandoffFromChatStorage'

function createHandoffId(): string {
  return `chfc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isMaxEmployeeChat(chat: Chat): boolean {
  return chat.participants.some(
    (participant) =>
      participant.type === 'employee' && participant.employeeId === MAX_WORKER_EMPLOYEE_ID,
  )
}

export function resolveMaxChatEmployeeId(chat: Chat): string | null {
  const employee = chat.participants.find(
    (participant) =>
      participant.type === 'employee' && participant.employeeId === MAX_WORKER_EMPLOYEE_ID,
  )
  return employee?.employeeId ?? null
}

function recentOwnerMessages(chat: Chat, limit = 6): string[] {
  return chat.messages
    .filter((message) => message.authorType === 'owner' && message.type === 'message')
    .slice(-limit)
    .map((message) => message.content)
}

export type ProcessCursorHandoffResult = {
  handled: boolean
  handoffId: string | null
}

export function tryProcessCursorHandoffFromOwnerMessage(input: {
  chatId: string
  chat: Chat
  ownerContent: string
  ownerName: string
}): ProcessCursorHandoffResult {
  if (!isMaxEmployeeChat(input.chat)) {
    return { handled: false, handoffId: null }
  }
  if (!detectCursorHandoffIntent(input.ownerContent)) {
    return { handled: false, handoffId: null }
  }

  const ref = parseChatRef(input.chatId)
  if (ref?.source !== 'conversation') {
    return { handled: false, handoffId: null }
  }

  const employeeId = ref.employeeId
  const employee = resolveEmployee(employeeId)
  if (!employee) return { handled: false, handoffId: null }

  const withOwner = appendConversationOwnerMessage(employeeId, input.ownerContent, input.ownerName)
  if (!withOwner) return { handled: false, handoffId: null }

  const ownerMessage = withOwner.messages[withOwner.messages.length - 1]
  if (!ownerMessage) return { handled: false, handoffId: null }

  const handoffId = createHandoffId()
  const summary = `MAX подготовил задачу для Cursor`

  const withProposal = appendEmployeeCursorHandoffProposal(employeeId, employee, {
    handoffId,
    handoffSummary: summary,
  })
  if (!withProposal) return { handled: false, handoffId: null }

  const proposalMessage = withProposal.messages[withProposal.messages.length - 1]
  if (!proposalMessage) return { handled: false, handoffId: null }

  createCursorHandoffFromChatProposal({
    handoffId,
    chatId: input.chatId,
    employeeId,
    ownerMessageId: ownerMessage.id,
    ownerPrompt: input.ownerContent,
    proposalMessageId: proposalMessage.id,
    recentOwnerMessages: recentOwnerMessages(input.chat),
  })

  appendConversationSystemMessage(
    employeeId,
    `Cursor handoff создан (${handoffId}). Owner копирует markdown в Cursor вручную.`,
  )

  return { handled: true, handoffId }
}

export function copyCursorHandoffFromChat(handoffId: string): {
  ok: boolean
  markdown: string | null
} {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) return { ok: false, markdown: null }

  const system = appendConversationSystemMessage(
    proposal.employeeId,
    'Handoff скопирован в буфер обмена — вставьте в Cursor / Cursor Automation.',
  )
  markCursorHandoffCopied(handoffId, system?.messages.at(-1)?.id ?? null)

  return { ok: true, markdown: proposal.markdown }
}

export function markCursorHandoffFromChatSent(handoffId: string): boolean {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) return false

  const system = appendConversationSystemMessage(
    proposal.employeeId,
    'Handoff отмечен как отправленный в Cursor. Ожидаем результат (result pending).',
  )
  markCursorHandoffSent(handoffId, system?.messages.at(-1)?.id ?? null)
  return true
}

export function rejectCursorHandoffFromChatFlow(handoffId: string): boolean {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) return false

  const system = appendConversationSystemMessage(
    proposal.employeeId,
    'Cursor handoff отклонён Owner.',
  )
  rejectCursorHandoffFromChat(handoffId, system?.messages.at(-1)?.id ?? null)
  return true
}

export function createMaxTaskFromCursorHandoff(handoffId: string): string | null {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) return null
  if (proposal.workItemId) return proposal.workItemId

  const workItem = createEmployeeWorkItem({
    employeeId: proposal.employeeId,
    title: `[Cursor follow-up] ${proposal.title}`,
    summary: 'Review/integration после Cursor handoff из MAX Chat.',
    taskText: proposal.goal,
    priority: 'high',
  })

  linkCursorHandoffWorkItem(handoffId, workItem.id, null)

  if (!proposal.chatId.startsWith('mobile:')) {
    appendConversationSystemMessage(
      proposal.employeeId,
      `Создана задача MAX (${workItem.id}) для follow-up после Cursor handoff.`,
    )
  }

  return workItem.id
}

export function mobileMaxChatId(employeeId: string): string {
  return `mobile:${employeeId}`
}

export function tryProcessMobileCursorHandoffFromOwnerMessage(input: {
  employeeId: string
  ownerMessageId: string
  ownerContent: string
  recentOwnerMessages: string[]
}): { handoffId: string; proposalMessageId: string } | null {
  if (!detectCursorHandoffIntent(input.ownerContent)) return null

  const handoffId = createHandoffId()
  const proposalMessageId = createMobileEmployeeChatMessageId()

  createCursorHandoffFromChatProposal({
    handoffId,
    chatId: mobileMaxChatId(input.employeeId),
    employeeId: input.employeeId,
    ownerMessageId: input.ownerMessageId,
    ownerPrompt: input.ownerContent,
    proposalMessageId,
    recentOwnerMessages: input.recentOwnerMessages,
  })

  appendMobileEmployeeChatMessage(input.employeeId, {
    id: proposalMessageId,
    role: 'system',
    kind: 'system_status',
    content: `Cursor handoff создан (${handoffId}).`,
  })

  return { handoffId, proposalMessageId }
}

export function copyMobileCursorHandoff(
  handoffId: string,
  employeeId: string,
): {
  ok: boolean
  markdown: string | null
} {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) return { ok: false, markdown: null }

  appendMobileEmployeeChatMessage(employeeId, {
    role: 'system',
    kind: 'system_status',
    content: 'Handoff скопирован — вставьте в Cursor / Cursor Automation.',
  })
  markCursorHandoffCopied(handoffId, null)
  return { ok: true, markdown: proposal.markdown }
}

export function markMobileCursorHandoffSent(handoffId: string, employeeId: string): boolean {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) return false
  appendMobileEmployeeChatMessage(employeeId, {
    role: 'system',
    kind: 'system_status',
    content: 'Handoff отмечен как отправленный в Cursor. Result pending.',
  })
  markCursorHandoffSent(handoffId, null)
  return true
}

export function rejectMobileCursorHandoff(handoffId: string, employeeId: string): boolean {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) return false
  appendMobileEmployeeChatMessage(employeeId, {
    role: 'system',
    kind: 'system_status',
    content: 'Cursor handoff отклонён Owner.',
  })
  rejectCursorHandoffFromChat(handoffId, null)
  return true
}

export function createMaxTaskFromMobileCursorHandoff(
  handoffId: string,
  employeeId: string,
): string | null {
  const workItemId = createMaxTaskFromCursorHandoff(handoffId)
  if (!workItemId) return null
  appendMobileEmployeeChatMessage(employeeId, {
    role: 'system',
    kind: 'system_status',
    content: `Создана задача MAX (${workItemId}) для follow-up после Cursor handoff.`,
  })
  return workItemId
}
