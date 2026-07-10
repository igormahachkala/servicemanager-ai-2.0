/**
 * Sync working memory from chat session + domain sources (111A).
 */

import { buildMobileOwnerDecisionsSnapshot } from '../mobileOwnerDecisions/mobileOwnerDecisionsSnapshot'
import { listDelegationReviews } from '../delegationReview'
import { DELEGATION_DECIDER_EMPLOYEE_ID } from '../delegationEngine'
import { loadEmployeeWorkItems } from '../employeeWorkQueue'
import { loadCursorHandoffFromChatProposals } from '../cursorHandoffFromChat'
import { loadMaxWorkerLoopRecords } from '../maxWorkerLoop/maxWorkerLoopStorage'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import type { MobileEmployeeChatMessage } from '../../mobile/chat/mobileEmployeeChat'
import {
  buildHeuristicConversationSummary,
  splitMessagesForContextWindow,
} from './conversationMemorySummary'
import { getEmployeeWorkingMemory, saveEmployeeWorkingMemory } from './conversationMemoryStorage'
import type { EmployeeWorkingMemory } from './conversationMemoryTypes'

const OPEN_HANDOFF_STATUSES = new Set(['proposal', 'copied', 'sent', 'result_pending'])

const ACTIVE_TASK_STATUSES = new Set(['pending', 'scheduled', 'in_progress', 'blocked'])

function uniqueItems(items: string[], max: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
    if (result.length >= max) break
  }
  return result
}

function syncCurrentlyDoing(employeeId: string): string[] {
  const items: string[] = []

  for (const loop of loadMaxWorkerLoopRecords()) {
    if (loop.employeeId !== employeeId) continue
    if (loop.status !== 'running' && loop.status !== 'queued' && loop.status !== 'waiting_approval') {
      continue
    }
    const title = loop.input.title?.trim()
    if (title) items.push(`Worker loop: ${title}`)
  }

  for (const task of loadEmployeeWorkItems()) {
    if (task.employeeId !== employeeId) continue
    if (!ACTIVE_TASK_STATUSES.has(task.status)) continue
    if (task.status === 'in_progress') {
      items.push(`In progress: ${task.title}`)
    }
  }

  return uniqueItems(items, 6)
}

function syncPromisedToDo(messages: MobileEmployeeChatMessage[]): string[] {
  const items: string[] = []

  for (const message of messages) {
    if (message.role !== 'max') continue
    if (message.kind === 'task_proposal' && message.taskProposal && !message.workItemId) {
      items.push(`Task proposal: ${message.taskProposal.title}`)
    }
    if (
      message.kind === 'delegation_proposal' &&
      message.delegationProposal &&
      message.delegationProposal.status === 'pending'
    ) {
      items.push(
        `Delegation proposal: ${message.delegationProposal.recommendedDisplayName} — ${message.delegationProposal.taskProposal.title}`,
      )
    }
    if (
      message.kind === 'delegation_event' &&
      message.delegationProposal &&
      message.delegationProposal.status === 'awaiting_execution'
    ) {
      items.push(
        `Awaiting delegation transfer: ${message.delegationProposal.recommendedDisplayName} — ${message.delegationProposal.taskProposal.title}`,
      )
    }
    if (
      message.kind === 'delegation_event' &&
      message.delegationProposal &&
      message.delegationProposal.status === 'delegated'
    ) {
      items.push(
        `Delegated to ${message.delegationProposal.recommendedDisplayName}: ${message.delegationProposal.taskProposal.title}`,
      )
    }
    if (message.kind === 'clarification' && /могу|could|готов|готова|предлож/i.test(message.content)) {
      items.push(message.content.slice(0, 100))
    }
  }

  return uniqueItems(items, 6)
}

function syncAwaitingConfirmation(employeeId: string, messages: MobileEmployeeChatMessage[]): string[] {
  const items: string[] = []

  for (const message of messages) {
    if (message.kind === 'task_proposal' && message.taskProposal && !message.workItemId) {
      items.push(`Confirm task: ${message.taskProposal.title}`)
    }
    if (
      message.kind === 'delegation_proposal' &&
      message.delegationProposal &&
      message.delegationProposal.status === 'pending'
    ) {
      items.push(
        `Owner должен подтвердить передачу задачи ${message.delegationProposal.recommendedDisplayName}.`,
      )
    }
  }

  for (const handoff of loadCursorHandoffFromChatProposals()) {
    if (handoff.employeeId !== employeeId) continue
    if (!OPEN_HANDOFF_STATUSES.has(handoff.status)) continue
    items.push(`Cursor handoff: ${handoff.title} (${handoff.status})`)
  }

  for (const decision of buildMobileOwnerDecisionsSnapshot()) {
    if (decision.employeeId && decision.employeeId !== employeeId) continue
    if (decision.canApprove || decision.canReject) {
      items.push(`Decision: ${decision.title}`)
    }
  }

  const canonical = resolveCanonicalEmployeeId(employeeId)
  for (const review of listDelegationReviews()) {
    if (review.status === 'awaiting_review' && review.reviewerEmployeeId === canonical) {
      items.push(`Review pending: ${review.taskTitle}`)
    }
    if (
      review.status === 'rework_requested' &&
      review.builderEmployeeId === canonical &&
      review.reworkWorkItemId
    ) {
      items.push(`Rework requested: ${review.taskTitle}`)
    }
    if (review.status === 'awaiting_review' && review.builderEmployeeId === canonical) {
      items.push(`Awaiting MAX review: ${review.taskTitle}`)
    }
  }

  if (canonical === resolveCanonicalEmployeeId(DELEGATION_DECIDER_EMPLOYEE_ID)) {
    for (const review of listDelegationReviews({ status: 'awaiting_review' })) {
      items.push(`Owner awaits MAX review: ${review.taskTitle}`)
    }
  }

  return uniqueItems(items, 8)
}

export function refreshEmployeeWorkingMemory(
  employeeId: string,
  messages: MobileEmployeeChatMessage[],
): EmployeeWorkingMemory {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const previous = getEmployeeWorkingMemory(canonical)
  const { olderMessages } = splitMessagesForContextWindow(messages)

  const workingMemory: EmployeeWorkingMemory = {
    currentlyDoing: syncCurrentlyDoing(canonical),
    promisedToDo: syncPromisedToDo(messages),
    awaitingConfirmation: syncAwaitingConfirmation(canonical, messages),
    conversationSummary: buildHeuristicConversationSummary(
      olderMessages,
      previous.conversationSummary,
    ),
    updatedAt: new Date().toISOString(),
  }

  return saveEmployeeWorkingMemory(canonical, workingMemory)
}

export function recordConversationExchange(input: {
  employeeId: string
  messages: MobileEmployeeChatMessage[]
}): EmployeeWorkingMemory {
  return refreshEmployeeWorkingMemory(input.employeeId, input.messages)
}
