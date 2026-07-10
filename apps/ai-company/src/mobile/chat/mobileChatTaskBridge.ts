import { createEmployeeWorkItem, type WorkItem } from '../../domain/employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import type { MobileEmployeeChatTaskProposal } from './mobileEmployeeChat'

/** @deprecated pass employeeId explicitly */
export function createMaxWorkItemFromChatProposal(
  proposal: MobileEmployeeChatTaskProposal,
): WorkItem {
  return createWorkItemFromChatProposal(proposal, MAX_WORKER_EMPLOYEE_ID)
}

export function createWorkItemFromChatProposal(
  proposal: MobileEmployeeChatTaskProposal,
  employeeId: string,
): WorkItem {
  return createEmployeeWorkItem({
    employeeId,
    title: proposal.title,
    taskText: proposal.taskText,
    summary: proposal.expectedResult ?? null,
    priority: proposal.priority ?? 'medium',
    structuredPayload: proposal.structuredPayload ?? null,
  })
}
