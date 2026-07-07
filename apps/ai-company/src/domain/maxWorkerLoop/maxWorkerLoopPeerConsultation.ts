/**
 * MAX Worker Loop — consult_peer phase (AI-COMPANY-102C).
 * Bridges Decision Plan → Employee Conversation V1; domain-only, no chat UI / network.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import type { DecisionPlan } from '../decisionPlan'
import { digestTaskText } from '../decisionPlan'
import {
  appendEmployeeConversationMessage,
  consumeEmployeeConversationMessage,
  createEmployeeConversation,
  recordEmployeeConversationDecision,
} from '../employeeConversation/employeeConversationStorage'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import type { MaxWorkerLoopRecord } from './maxWorkerLoop'

export const MAX_WORKER_PEER_CONSULT_SCENARIO_ID = 'max-worker-loop-peer-consult-v1' as const

export type MaxWorkerLoopPeerConsultationStatus = 'skipped' | 'completed' | 'failed'

export type MaxWorkerLoopPeerConsultationSnapshot = {
  status: MaxWorkerLoopPeerConsultationStatus
  required: boolean
  skipReason: string | null
  peerEmployeeId: string | null
  peerDisplayName: string | null
  consultReason: string | null
  conversationId: string | null
  questionMessageId: string | null
  answerMessageId: string | null
  decisionId: string | null
  questionBody: string | null
  answerBody: string | null
  decisionSummary: string | null
  consumedSummary: string | null
  taskEnrichment: string | null
  completedAt: string | null
}

type RunPeerConsultInput = {
  loop: Pick<MaxWorkerLoopRecord, 'id' | 'input' | 'deliveryTaskId'>
  decisionPlan: DecisionPlan
  now?: Date
}

type PeerAnswerContext = {
  taskTitle: string | null
  taskText: string
  reason: string
  peerDisplayName: string
}

const MAX_EMPLOYEE_ID = EMPLOYEE_ROUTE_IDS.max

const PEER_ANSWER_BUILDERS: Record<string, (ctx: PeerAnswerContext) => string> = {
  [EMPLOYEE_ROUTE_IDS.atlas]: (ctx) =>
    `Для «${ctx.taskTitle?.trim() || digestTaskText(ctx.taskText, 80)}»: держите границы domain-слоёв, не смешивайте Worker Loop state с Employee Conversation aggregate. ` +
    'Consult — internal only; handoff — только при external executor. Trade-off: отдельный модуль employeeConversation vs расширение Owner chat — выбираем отдельный domain с Context/Decision refs.',
  [EMPLOYEE_ROUTE_IDS.sentinel]: (ctx) =>
    `Для «${ctx.taskTitle?.trim() || digestTaskText(ctx.taskText, 80)}»: сформируйте acceptance checklist, smoke/e2e scope и demo-readiness критерии до merge. ` +
    'Фиксируйте expected checks в Runtime Report; regressions — через Playwright acceptance pack, без shell в V1 safe path.',
}

function buildConsultQuestion(input: {
  peerDisplayName: string
  peerEmployeeId: string
  taskTitle: string | null
  taskText: string
  reason: string
}): string {
  const scope = input.taskTitle?.trim() || digestTaskText(input.taskText, 120)
  if (input.peerEmployeeId === EMPLOYEE_ROUTE_IDS.atlas) {
    return `${input.peerDisplayName}, по задаче «${scope}»: ${input.reason} Какие архитектурные границы, слои и trade-offs учесть?`
  }
  if (input.peerEmployeeId === EMPLOYEE_ROUTE_IDS.sentinel) {
    return `${input.peerDisplayName}, по задаче «${scope}»: ${input.reason} Какой acceptance scope и QA checklist предложишь?`
  }
  return `${input.peerDisplayName}, по задаче «${scope}»: ${input.reason}`
}

function buildPeerAnswer(peerEmployeeId: string, ctx: PeerAnswerContext): string {
  const builder = PEER_ANSWER_BUILDERS[peerEmployeeId]
  if (builder) return builder(ctx)
  return `${ctx.peerDisplayName}: учитывайте контекст задачи и invariants платформы (multi-tenant, ticket owner = CLIENT).`
}

function buildSkippedSnapshot(skipReason: string, now: Date): MaxWorkerLoopPeerConsultationSnapshot {
  return {
    status: 'skipped',
    required: false,
    skipReason,
    peerEmployeeId: null,
    peerDisplayName: null,
    consultReason: null,
    conversationId: null,
    questionMessageId: null,
    answerMessageId: null,
    decisionId: null,
    questionBody: null,
    answerBody: null,
    decisionSummary: null,
    consumedSummary: null,
    taskEnrichment: null,
    completedAt: now.toISOString(),
  }
}

export function runMaxWorkerLoopPeerConsultation(
  input: RunPeerConsultInput,
): MaxWorkerLoopPeerConsultationSnapshot {
  const now = input.now ?? new Date()
  const peer = input.decisionPlan.peerConsultation

  if (!peer.required || !peer.peerEmployeeId) {
    return buildSkippedSnapshot(
      peer.skipReason ?? 'Decision Plan: консультация с коллегой не требуется для этой задачи.',
      now,
    )
  }

  const taskTitle = input.loop.input.title?.trim() ?? input.decisionPlan.taskTitle
  const taskText = input.loop.input.taskText
  const consultReason = peer.reason ?? 'Decision Plan определил необходимость peer consult.'
  const peerDisplayName = peer.peerDisplayName ?? peer.peerEmployeeId
  const originTaskId = input.loop.deliveryTaskId ?? input.decisionPlan.taskId ?? input.loop.id
  const consumerTaskId = originTaskId

  const questionBody = buildConsultQuestion({
    peerDisplayName,
    peerEmployeeId: peer.peerEmployeeId,
    taskTitle,
    taskText,
    reason: consultReason,
  })

  const answerBody = buildPeerAnswer(peer.peerEmployeeId, {
    taskTitle,
    taskText,
    reason: consultReason,
    peerDisplayName,
  })

  const conversation = createEmployeeConversation({
    kind: 'consultation',
    title: `MAX → ${peerDisplayName}: peer consult`,
    participants: [
      { employeeId: MAX_EMPLOYEE_ID, role: 'initiator', displayName: 'MAX' },
      { employeeId: peer.peerEmployeeId, role: 'responder', displayName: peerDisplayName },
    ],
    context: {
      companyId: DEFAULT_COMPANY_ID,
      workspaceId: input.loop.input.workspaceId,
      projectId: input.loop.input.projectId,
      originTaskId,
      consumerTaskId,
      workerLoopId: input.loop.id,
      runtimeRunId: null,
      subject: consultReason,
      tags: ['102C', 'consultation', 'max-worker-loop', peer.peerEmployeeId],
    },
  })

  const withQuestion = appendEmployeeConversationMessage(conversation.id, {
    authorEmployeeId: MAX_EMPLOYEE_ID,
    kind: 'question',
    body: questionBody,
    metadata: {
      scenarioId: MAX_WORKER_PEER_CONSULT_SCENARIO_ID,
      decisionPlanId: input.decisionPlan.id,
      workerLoopId: input.loop.id,
    },
  })

  const questionMessage = withQuestion.messages[withQuestion.messages.length - 1]
  if (!questionMessage) {
    throw new Error('MAX peer consult question was not persisted')
  }

  const withAnswer = appendEmployeeConversationMessage(withQuestion.id, {
    authorEmployeeId: peer.peerEmployeeId,
    kind: 'answer',
    body: answerBody,
    inReplyToMessageId: questionMessage.id,
    metadata: {
      scenarioId: MAX_WORKER_PEER_CONSULT_SCENARIO_ID,
      responderModelMode: peer.peerEmployeeId === EMPLOYEE_ROUTE_IDS.atlas ? 'deep' : 'qa',
    },
  })

  const answerMessage = withAnswer.messages[withAnswer.messages.length - 1]
  if (!answerMessage) {
    throw new Error('Peer consult answer was not persisted')
  }

  const decisionSummary = `Применить guidance ${peerDisplayName} в Worker Loop task.`

  const withDecision = recordEmployeeConversationDecision(withAnswer.id, {
    messageId: answerMessage.id,
    proposedByEmployeeId: MAX_EMPLOYEE_ID,
    summary: decisionSummary,
    rationale: answerBody.slice(0, 160),
    status: 'accepted',
    acknowledgerEmployeeIds: [peer.peerEmployeeId],
    consumerTaskId,
    consumerRunId: null,
  })

  const decision = withDecision.decisions[withDecision.decisions.length - 1]
  if (!decision) {
    throw new Error('Peer consult decision was not persisted')
  }

  const consumed = consumeEmployeeConversationMessage(withDecision.id, {
    messageId: answerMessage.id,
    consumerTaskId,
    consumerRunId: null,
  })

  const consumedMessage = consumed.messages.find((item) => item.id === answerMessage.id)
  const consumedSummary =
    consumedMessage?.body ?? `${peerDisplayName} guidance consumed for MAX downstream task.`

  const taskEnrichment = `[Peer consult · ${peerDisplayName}]\n${consumedSummary}`

  return {
    status: 'completed',
    required: true,
    skipReason: null,
    peerEmployeeId: peer.peerEmployeeId,
    peerDisplayName,
    consultReason,
    conversationId: consumed.id,
    questionMessageId: questionMessage.id,
    answerMessageId: answerMessage.id,
    decisionId: decision.id,
    questionBody,
    answerBody,
    decisionSummary,
    consumedSummary,
    taskEnrichment,
    completedAt: now.toISOString(),
  }
}

export function summarizeConsultPeerPhase(snapshot: MaxWorkerLoopPeerConsultationSnapshot): string {
  if (snapshot.status === 'skipped') {
    return snapshot.skipReason ?? 'Консультация не требуется'
  }
  if (snapshot.status === 'failed') {
    return snapshot.skipReason ?? 'Ошибка peer consult'
  }
  return `${snapshot.peerDisplayName ?? snapshot.peerEmployeeId}: ${snapshot.decisionSummary ?? 'решение принято'}`
}

export function buildTaskConstraintsWithPeerConsultation(
  baseConstraints: string,
  snapshot: MaxWorkerLoopPeerConsultationSnapshot | null,
): string {
  if (!snapshot || snapshot.status !== 'completed' || !snapshot.taskEnrichment) {
    return baseConstraints
  }
  const trimmed = baseConstraints.trim()
  if (!trimmed) return snapshot.taskEnrichment
  return `${trimmed}\n\n${snapshot.taskEnrichment}`
}

export function buildTaskTextWithPeerConsultation(
  baseTaskText: string,
  snapshot: MaxWorkerLoopPeerConsultationSnapshot | null,
): string {
  if (!snapshot || snapshot.status !== 'completed' || !snapshot.consumedSummary) {
    return baseTaskText
  }
  return `${baseTaskText.trim()}\n\n--- Peer consult (${snapshot.peerDisplayName ?? 'colleague'}) ---\n${snapshot.consumedSummary}`
}

export function parseMaxWorkerLoopPeerConsultationSnapshot(
  value: unknown,
): MaxWorkerLoopPeerConsultationSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const status =
    record.status === 'skipped' || record.status === 'completed' || record.status === 'failed'
      ? record.status
      : null
  if (!status) return null

  return {
    status,
    required: record.required === true,
    skipReason: typeof record.skipReason === 'string' ? record.skipReason : null,
    peerEmployeeId: typeof record.peerEmployeeId === 'string' ? record.peerEmployeeId : null,
    peerDisplayName: typeof record.peerDisplayName === 'string' ? record.peerDisplayName : null,
    consultReason: typeof record.consultReason === 'string' ? record.consultReason : null,
    conversationId: typeof record.conversationId === 'string' ? record.conversationId : null,
    questionMessageId: typeof record.questionMessageId === 'string' ? record.questionMessageId : null,
    answerMessageId: typeof record.answerMessageId === 'string' ? record.answerMessageId : null,
    decisionId: typeof record.decisionId === 'string' ? record.decisionId : null,
    questionBody: typeof record.questionBody === 'string' ? record.questionBody : null,
    answerBody: typeof record.answerBody === 'string' ? record.answerBody : null,
    decisionSummary: typeof record.decisionSummary === 'string' ? record.decisionSummary : null,
    consumedSummary: typeof record.consumedSummary === 'string' ? record.consumedSummary : null,
    taskEnrichment: typeof record.taskEnrichment === 'string' ? record.taskEnrichment : null,
    completedAt: typeof record.completedAt === 'string' ? record.completedAt : null,
  }
}
