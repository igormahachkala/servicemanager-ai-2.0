/**
 * Reference scenario V1: MAX consults Atlas, consumes answer in downstream task.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import type { EmployeeConversation } from './employeeConversation'
import {
  appendEmployeeConversationMessage,
  consumeEmployeeConversationMessage,
  createEmployeeConversation,
  recordEmployeeConversationDecision,
} from './employeeConversationStorage'

export const MAX_ATLAS_CONSULTATION_SCENARIO_ID = 'max-atlas-architecture-consult-v1' as const

export type MaxAtlasConsultationScenarioInput = {
  originTaskId: string
  consumerTaskId: string
  projectId?: string
  workspaceId?: string
  workerLoopId?: string | null
  runtimeRunId?: string | null
}

export type MaxAtlasConsultationScenarioResult = {
  scenarioId: typeof MAX_ATLAS_CONSULTATION_SCENARIO_ID
  conversation: EmployeeConversation
  questionMessageId: string
  answerMessageId: string
  decisionId: string
  consumedSummary: string
}

const ATLAS_EMPLOYEE_ID = EMPLOYEE_ROUTE_IDS.atlas
const MAX_EMPLOYEE_ID = EMPLOYEE_ROUTE_IDS.max
const AI_COMPANY_PROJECT = 'project-ai-company'
const MAX_WORKSPACE = 'ws-max'

export function runMaxAtlasConsultationScenarioV1(
  input: MaxAtlasConsultationScenarioInput,
): MaxAtlasConsultationScenarioResult {
  const conversation = createEmployeeConversation({
    kind: 'consultation',
    title: 'MAX → Atlas: architecture consult',
    participants: [
      { employeeId: MAX_EMPLOYEE_ID, role: 'initiator', displayName: 'MAX' },
      { employeeId: ATLAS_EMPLOYEE_ID, role: 'responder', displayName: 'Atlas' },
    ],
    context: {
      companyId: DEFAULT_COMPANY_ID,
      workspaceId: input.workspaceId ?? MAX_WORKSPACE,
      projectId: input.projectId ?? AI_COMPANY_PROJECT,
      originTaskId: input.originTaskId,
      consumerTaskId: input.consumerTaskId,
      workerLoopId: input.workerLoopId ?? null,
      runtimeRunId: input.runtimeRunId ?? null,
      subject: 'Architecture guidance for MAX implementation task',
      tags: ['101F', 'consultation', 'max-atlas'],
    },
  })

  const withQuestion = appendEmployeeConversationMessage(conversation.id, {
    authorEmployeeId: MAX_EMPLOYEE_ID,
    kind: 'question',
    body:
      'Atlas, для задачи по ai-company: нужен ли отдельный domain-модуль employeeConversation или расширить Owner conversation? Какие границы с Worker Loop и handoff?',
    metadata: {
      scenarioId: MAX_ATLAS_CONSULTATION_SCENARIO_ID,
      originTaskId: input.originTaskId,
    },
  })

  const questionMessage = withQuestion.messages[withQuestion.messages.length - 1]
  if (!questionMessage) {
    throw new Error('MAX question message was not persisted')
  }

  const withAnswer = appendEmployeeConversationMessage(withQuestion.id, {
    authorEmployeeId: ATLAS_EMPLOYEE_ID,
    kind: 'answer',
    body:
      'Отдельный domain employeeConversation — правильная граница. Owner chat остаётся в mission-control. Employee↔Employee — internal consult с Context, Decision и AttachmentRef. Worker Loop ссылается на conversationId/messageId; handoff — только если нужен external executor.',
    inReplyToMessageId: questionMessage.id,
    metadata: {
      scenarioId: MAX_ATLAS_CONSULTATION_SCENARIO_ID,
      responderModelMode: 'deep',
    },
  })

  const answerMessage = withAnswer.messages[withAnswer.messages.length - 1]
  if (!answerMessage) {
    throw new Error('Atlas answer message was not persisted')
  }

  const withDecision = recordEmployeeConversationDecision(withAnswer.id, {
    messageId: answerMessage.id,
    proposedByEmployeeId: MAX_EMPLOYEE_ID,
    summary: 'Использовать отдельный domain employeeConversation; Worker Loop ссылается на consult message.',
    rationale: answerMessage.body.slice(0, 160),
    status: 'accepted',
    acknowledgerEmployeeIds: [ATLAS_EMPLOYEE_ID],
    consumerTaskId: input.consumerTaskId,
    consumerRunId: input.runtimeRunId ?? null,
  })

  const decision = withDecision.decisions[withDecision.decisions.length - 1]
  if (!decision) {
    throw new Error('Decision was not persisted')
  }

  const consumed = consumeEmployeeConversationMessage(withDecision.id, {
    messageId: answerMessage.id,
    consumerTaskId: input.consumerTaskId,
    consumerRunId: input.runtimeRunId ?? null,
  })

  const consumedMessage = consumed.messages.find((item) => item.id === answerMessage.id)
  const consumedSummary =
    consumedMessage?.body ??
    'Atlas guidance consumed for MAX downstream task implementation.'

  return {
    scenarioId: MAX_ATLAS_CONSULTATION_SCENARIO_ID,
    conversation: consumed,
    questionMessageId: questionMessage.id,
    answerMessageId: answerMessage.id,
    decisionId: decision.id,
    consumedSummary,
  }
}
