/**
 * MAX Delegation Engine — Owner explainability (AI-COMPANY-112B).
 */

import type {
  DelegationCandidate,
  DelegationDecision,
  DelegationExplainability,
  DelegationPlan,
  DelegationReason,
} from './delegationEngineTypes'

export function formatOwnerDelegationExplanation(input: {
  recommendedCodename: string
  reason: DelegationReason
  confidence: number
  matchedTaskSignals: string[]
  conversationHints: string[]
  workingMemoryHints: string[]
}): string {
  const confidencePct = Math.round(input.confidence * 100)
  const parts: string[] = [
    `Почему MAX выбрал ${input.recommendedCodename}: ${input.reason.summary}`,
  ]

  if (input.matchedTaskSignals.length > 0) {
    parts.push(`Сигналы задачи: ${input.matchedTaskSignals.join(', ')}.`)
  }

  if (input.conversationHints.length > 0) {
    parts.push(`Контекст чата: ${input.conversationHints.join('; ')}.`)
  }

  if (input.workingMemoryHints.length > 0) {
    parts.push(`Working memory: ${input.workingMemoryHints.join('; ')}.`)
  }

  parts.push(`Уверенность: ${confidencePct}%.`)

  return parts.join(' ')
}

export function buildDelegationExplainability(input: {
  decision: Omit<DelegationDecision, 'explainability'>
  candidates: DelegationCandidate[]
  matchedTaskSignals: string[]
  conversationHints: string[]
  workingMemoryHints: string[]
}): DelegationExplainability {
  const winner = input.candidates.find(
    (item) => item.employeeId === input.decision.recommendedEmployeeId,
  )

  const alternatives = input.candidates
    .filter((item) => item.employeeId !== input.decision.recommendedEmployeeId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      employeeId: item.employeeId,
      codename: item.codename,
      score: item.score,
      whyNotChosen:
        winner && item.score < winner.score
          ? `Score ${item.score} ниже выбранного (${winner.score}).`
          : item.availability === 'placeholder'
            ? `${item.codename} пока placeholder — MAX предпочёл активного исполнителя.`
            : null,
    }))

  const rationale = [
    input.decision.reason.headline,
    input.decision.reason.summary,
    `Confidence ${Math.round(input.decision.confidence * 100)}%.`,
  ]

  if (input.conversationHints.length > 0) {
    rationale.push(`Conversation hints: ${input.conversationHints.join('; ')}`)
  }

  if (input.workingMemoryHints.length > 0) {
    rationale.push(`Working memory hints: ${input.workingMemoryHints.join('; ')}`)
  }

  const ownerExplanation = formatOwnerDelegationExplanation({
    recommendedCodename: input.decision.recommendedCodename,
    reason: input.decision.reason,
    confidence: input.decision.confidence,
    matchedTaskSignals: input.matchedTaskSignals,
    conversationHints: input.conversationHints,
    workingMemoryHints: input.workingMemoryHints,
  })

  return {
    ownerExplanation,
    rationale,
    alternatives,
    matchedTaskSignals: input.matchedTaskSignals,
    conversationHints: input.conversationHints,
    workingMemoryHints: input.workingMemoryHints,
  }
}

export function summarizeDelegationPlanForOwner(plan: DelegationPlan): string {
  return plan.decision.explainability.ownerExplanation
}
