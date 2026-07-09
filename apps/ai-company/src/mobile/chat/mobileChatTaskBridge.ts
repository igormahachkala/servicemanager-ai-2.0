import { createEmployeeWorkItem, type WorkItem } from '../../domain/employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import type { MobileEmployeeChatTaskProposal } from './mobileEmployeeChat'

export function createWorkItemFromChatProposal(proposal: MobileEmployeeChatTaskProposal): WorkItem {
  return createEmployeeWorkItem({
    employeeId: MAX_WORKER_EMPLOYEE_ID,
    title: proposal.title,
    taskText: proposal.taskText,
    summary: proposal.expectedResult ?? null,
    priority: proposal.priority ?? 'medium',
    structuredPayload: proposal.structuredPayload ?? null,
  })
}
