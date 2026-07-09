/**
 * Cursor Handoff from Chat — localStorage (110C).
 */

import {
  CURSOR_HANDOFF_FROM_CHAT_VERSION,
  type BuildCursorHandoffFromChatInput,
  type CursorHandoffFromChatHistoryEntry,
  type CursorHandoffFromChatHistoryKind,
  type CursorHandoffFromChatProposal,
  type CursorHandoffFromChatStatus,
} from './cursorHandoffFromChatTypes'
import { buildCursorHandoffFromChatMarkdown } from './cursorHandoffFromChatMarkdown'
import { resolveEmployee } from '../../mission-control/data/conversation'

export const CURSOR_HANDOFF_FROM_CHAT_STORAGE_KEY = 'ai-company-cursor-handoff-from-chat'

export const CURSOR_HANDOFF_FROM_CHAT_SYNC_EVENT = 'ai-company-cursor-handoff-from-chat-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CURSOR_HANDOFF_FROM_CHAT_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseHistoryEntry(value: unknown): CursorHandoffFromChatHistoryEntry | null {
  if (!isRecord(value)) return null
  const kind = value.kind
  if (
    kind !== 'created' &&
    kind !== 'copied' &&
    kind !== 'marked_sent' &&
    kind !== 'rejected' &&
    kind !== 'result_pending' &&
    kind !== 'max_task_created'
  ) {
    return null
  }
  if (typeof value.id !== 'string' || typeof value.at !== 'string') return null
  return {
    id: value.id,
    kind,
    at: value.at,
    messageId: typeof value.messageId === 'string' ? value.messageId : null,
  }
}

function parseProposal(value: unknown): CursorHandoffFromChatProposal | null {
  if (!isRecord(value)) return null
  const status = value.status
  if (
    status !== 'proposal' &&
    status !== 'copied' &&
    status !== 'sent' &&
    status !== 'result_pending' &&
    status !== 'rejected' &&
    status !== 'max_task_created'
  ) {
    return null
  }

  const history = Array.isArray(value.history)
    ? value.history.map(parseHistoryEntry).filter((item): item is CursorHandoffFromChatHistoryEntry => item !== null)
    : []

  if (
    typeof value.id !== 'string' ||
    typeof value.chatId !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.ownerMessageId !== 'string' ||
    typeof value.proposalMessageId !== 'string' ||
    typeof value.ownerPrompt !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.goal !== 'string' ||
    typeof value.markdown !== 'string' ||
    !Array.isArray(value.fileScope) ||
    typeof value.workingBranch !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    version: CURSOR_HANDOFF_FROM_CHAT_VERSION,
    chatId: value.chatId,
    employeeId: value.employeeId,
    ownerMessageId: value.ownerMessageId,
    proposalMessageId: value.proposalMessageId,
    ownerPrompt: value.ownerPrompt,
    title: value.title,
    goal: value.goal,
    markdown: value.markdown,
    fileScope: value.fileScope.filter((item): item is string => typeof item === 'string'),
    workingBranch: value.workingBranch,
    status,
    workItemId: typeof value.workItemId === 'string' ? value.workItemId : null,
    history,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadCursorHandoffFromChatProposals(): CursorHandoffFromChatProposal[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CURSOR_HANDOFF_FROM_CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseProposal).filter((item): item is CursorHandoffFromChatProposal => item !== null)
  } catch {
    return []
  }
}

function saveProposals(proposals: CursorHandoffFromChatProposal[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CURSOR_HANDOFF_FROM_CHAT_STORAGE_KEY, JSON.stringify(proposals))
    emitSync()
  } catch {
    /* noop */
  }
}

function upsertProposal(proposal: CursorHandoffFromChatProposal): CursorHandoffFromChatProposal {
  const all = loadCursorHandoffFromChatProposals()
  const index = all.findIndex((item) => item.id === proposal.id)
  if (index >= 0) {
    const next = [...all]
    next[index] = proposal
    saveProposals(next)
    return proposal
  }
  saveProposals([...all, proposal])
  return proposal
}

export function getCursorHandoffFromChatById(handoffId: string): CursorHandoffFromChatProposal | null {
  return loadCursorHandoffFromChatProposals().find((item) => item.id === handoffId) ?? null
}

export function getCursorHandoffFromChatByMessageId(messageId: string): CursorHandoffFromChatProposal | null {
  return (
    loadCursorHandoffFromChatProposals().find((item) => item.proposalMessageId === messageId) ?? null
  )
}

export function createCursorHandoffFromChatProposal(
  input: BuildCursorHandoffFromChatInput & {
    handoffId: string
    proposalMessageId: string
    recentOwnerMessages: string[]
  },
): CursorHandoffFromChatProposal {
  const employee = resolveEmployee(input.employeeId)
  const built = buildCursorHandoffFromChatMarkdown({
    ownerPrompt: input.ownerPrompt,
    context: {
      recentOwnerMessages: input.recentOwnerMessages,
      employeeCodename: employee?.codename ?? 'MAX',
    },
  })

  const now = nowIso()
  const proposal: CursorHandoffFromChatProposal = {
    id: input.handoffId,
    version: CURSOR_HANDOFF_FROM_CHAT_VERSION,
    chatId: input.chatId,
    employeeId: input.employeeId,
    ownerMessageId: input.ownerMessageId,
    proposalMessageId: input.proposalMessageId,
    ownerPrompt: input.ownerPrompt,
    title: built.title,
    goal: built.goal,
    markdown: built.markdown,
    fileScope: built.fileScope,
    workingBranch: built.workingBranch,
    status: 'proposal',
    workItemId: null,
    history: [
      {
        id: createId('chfch'),
        kind: 'created',
        at: now,
        messageId: null,
      },
    ],
    createdAt: now,
    updatedAt: now,
  }

  return upsertProposal(proposal)
}

function appendHistory(
  proposal: CursorHandoffFromChatProposal,
  kind: CursorHandoffFromChatHistoryKind,
  messageId: string | null,
  status: CursorHandoffFromChatStatus,
): CursorHandoffFromChatProposal {
  const now = nowIso()
  return upsertProposal({
    ...proposal,
    status,
    updatedAt: now,
    history: [
      ...proposal.history,
      {
        id: createId('chfch'),
        kind,
        at: now,
        messageId,
      },
    ],
  })
}

export function markCursorHandoffCopied(
  handoffId: string,
  systemMessageId: string | null,
): CursorHandoffFromChatProposal | null {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal || proposal.status === 'rejected') return null
  const nextStatus: CursorHandoffFromChatStatus =
    proposal.status === 'proposal' ? 'copied' : proposal.status
  return appendHistory(proposal, 'copied', systemMessageId, nextStatus)
}

export function markCursorHandoffSent(
  handoffId: string,
  systemMessageId: string | null,
): CursorHandoffFromChatProposal | null {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal || proposal.status === 'rejected') return null
  const sent = appendHistory(proposal, 'marked_sent', systemMessageId, 'sent')
  return appendHistory(sent, 'result_pending', null, 'result_pending')
}

export function rejectCursorHandoffFromChat(
  handoffId: string,
  systemMessageId: string | null,
): CursorHandoffFromChatProposal | null {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) return null
  return appendHistory(proposal, 'rejected', systemMessageId, 'rejected')
}

export function linkCursorHandoffWorkItem(
  handoffId: string,
  workItemId: string,
  systemMessageId: string | null,
): CursorHandoffFromChatProposal | null {
  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal || proposal.status === 'rejected') return null
  const withTask = appendHistory(proposal, 'max_task_created', systemMessageId, 'max_task_created')
  return upsertProposal({ ...withTask, workItemId })
}
