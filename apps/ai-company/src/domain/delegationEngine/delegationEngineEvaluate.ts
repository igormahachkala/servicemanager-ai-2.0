/**
 * MAX Delegation Engine — evaluate API (AI-COMPANY-112B).
 * Decision layer only. Does not invoke Runtime, Worker Loop, or Tool Dispatcher.
 */

import { resolveRosterEntry } from '../../mission-control/data/discussion'
import {
  DELEGATION_CONVERSATION_HINT_PATTERNS,
  DELEGATION_MAX_FALLBACK_RULE,
  DELEGATION_RULES,
  maxDelegationRuleScore,
  scoreDelegationSignals,
} from './delegationEngineCatalog'
import { buildDelegationExplainability } from './delegationEngineExplain'
import {
  DELEGATION_DECIDER_EMPLOYEE_ID,
  DELEGATION_ENGINE_VERSION,
  buildDelegationTaskCorpus,
  digestDelegationTaskText,
  type DelegationCandidate,
  type DelegationCatalogRule,
  type DelegationCategory,
  type DelegationDecision,
  type DelegationPlan,
  type DelegationReason,
  type DelegationReasonCode,
  type EvaluateDelegationInput,
} from './delegationEngineTypes'
import type { EmployeeConversationContext, EmployeeWorkingMemory } from '../conversationMemory/conversationMemoryTypes'

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

function createPlanId(now?: Date): string {
  const stamp = now?.getTime() ?? Date.now()
  return `delegation-${stamp}-${Math.random().toString(36).slice(2, 7)}`
}

function resolveCodename(employeeId: string, fallback: string): string {
  return resolveRosterEntry(employeeId)?.codename ?? fallback
}

function resolveRole(employeeId: string, fallback: string): string {
  return resolveRosterEntry(employeeId)?.role ?? fallback
}

function scoreCatalogRule(corpus: string, rule: DelegationCatalogRule): DelegationCandidate {
  const scored = scoreDelegationSignals(corpus, rule.signals)
  return {
    employeeId: rule.targetEmployeeId,
    codename: rule.targetCodename,
    role: rule.targetRole,
    specialization: rule.specialization,
    score: scored.score,
    matchedRuleIds: scored.matchedRuleIds.length > 0 ? [rule.id] : [],
    matchedSignals: scored.matchedSignals,
    availability: rule.availability,
    rank: 0,
  }
}

function extractConversationHints(context: EmployeeConversationContext | null | undefined): {
  hints: string[]
  boosts: Record<string, number>
} {
  if (!context) return { hints: [], boosts: {} }

  const corpus = [
    ...context.messageWindow.map((item) => item.content),
    context.conversationSummary ?? '',
    ...context.activeTasks.map((item) => `${item.label} ${item.detail ?? ''}`),
    ...context.recentDecisions.map((item) => `${item.label} ${item.detail ?? ''}`),
  ].join('\n')

  const hints: string[] = []
  const boosts: Record<string, number> = {}

  for (const hint of DELEGATION_CONVERSATION_HINT_PATTERNS) {
    const hit = hint.patterns.find((pattern) => corpus.toLowerCase().includes(pattern))
    if (hit) {
      hints.push(`${hint.codename} упомянут в контексте («${hit}»)`)
      boosts[hint.employeeId] = (boosts[hint.employeeId] ?? 0) + hint.weight
    }
  }

  return { hints, boosts }
}

function extractWorkingMemoryHints(memory: EmployeeWorkingMemory | null | undefined): {
  hints: string[]
  boosts: Record<string, number>
} {
  if (!memory) return { hints: [], boosts: {} }

  const corpus = [
    ...memory.currentlyDoing,
    ...memory.promisedToDo,
    ...memory.awaitingConfirmation,
    memory.conversationSummary ?? '',
  ].join('\n')

  const hints: string[] = []
  const boosts: Record<string, number> = {}

  for (const hint of DELEGATION_CONVERSATION_HINT_PATTERNS) {
    const hit = hint.patterns.find((pattern) => corpus.toLowerCase().includes(pattern))
    if (hit) {
      hints.push(`Working memory указывает на ${hint.codename}`)
      boosts[hint.employeeId] = (boosts[hint.employeeId] ?? 0) + 1
    }
  }

  return { hints, boosts }
}

function applyBoosts(
  candidates: DelegationCandidate[],
  boosts: Record<string, number>,
  boostTag: 'conversation-boost' | 'memory-boost',
): DelegationCandidate[] {
  return candidates.map((item) => {
    const boost = boosts[item.employeeId] ?? 0
    if (boost <= 0) return item
    return {
      ...item,
      score: item.score + boost,
      matchedSignals: [...item.matchedSignals, boostTag],
    }
  })
}

function rankCandidates(candidates: DelegationCandidate[]): DelegationCandidate[] {
  return [...candidates]
    .sort((a, b) => b.score - a.score || a.codename.localeCompare(b.codename))
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

function computeConfidence(
  winner: DelegationCandidate,
  rule: DelegationCatalogRule,
  isFallback: boolean,
): number {
  if (isFallback) return 0.42

  const maxScore = Math.max(maxDelegationRuleScore(rule), 1)
  const normalized = Math.min(winner.score / maxScore, 1)
  const base = 0.55 + normalized * 0.35

  if (winner.availability === 'placeholder') {
    return Math.min(base, 0.78)
  }

  return Math.min(Math.max(base, 0.5), 0.95)
}

function buildReason(
  rule: DelegationCatalogRule,
  winner: DelegationCandidate,
  isFallback: boolean,
): DelegationReason {
  const code: DelegationReasonCode = isFallback ? 'unknown_fallback' : rule.reasonCode

  return {
    code,
    headline: rule.headlineTemplate,
    summary: rule.reasonSummaryTemplate,
    matchedSignals: winner.matchedSignals,
    ruleId: isFallback ? null : rule.id,
    category: rule.category,
  }
}

function resolveExplicitAssignee(
  suggestedAssigneeId: string | null | undefined,
  corpus: string,
): DelegationCatalogRule | null {
  if (!suggestedAssigneeId?.trim()) return null

  const canonical = suggestedAssigneeId.trim()
  const fromRules = DELEGATION_RULES.find((item) => item.targetEmployeeId === canonical)
  if (fromRules) return fromRules

  if (canonical === DELEGATION_MAX_FALLBACK_RULE.targetEmployeeId) {
    return DELEGATION_MAX_FALLBACK_RULE
  }

  const lower = corpus.toLowerCase()
  if (lower.includes('builder')) {
    return DELEGATION_RULES.find((item) => item.id === 'ui-design-builder') ?? null
  }

  return null
}

/**
 * MAX evaluates whom to delegate work to.
 * Returns DelegationPlan with recommended employee, confidence, and Owner explainability.
 */
export function evaluateDelegation(input: EvaluateDelegationInput): DelegationPlan {
  const now = input.now
  const corpus = buildDelegationTaskCorpus(input.task)
  const taskDigest = digestDelegationTaskText(corpus)

  const conversation = extractConversationHints(input.conversationContext)
  const memory = extractWorkingMemoryHints(input.workingMemory ?? input.conversationContext?.workingMemory)

  let baseCandidates = DELEGATION_RULES.map((rule) => scoreCatalogRule(corpus, rule))
  baseCandidates = applyBoosts(baseCandidates, conversation.boosts, 'conversation-boost')
  baseCandidates = applyBoosts(baseCandidates, memory.boosts, 'memory-boost')

  const explicitRule = resolveExplicitAssignee(input.task.suggestedAssigneeId, corpus)
  if (explicitRule) {
    const explicitCandidate = scoreCatalogRule(corpus, explicitRule)
    explicitCandidate.score = Math.max(explicitCandidate.score, explicitRule.minScore + 2)
    explicitCandidate.matchedSignals.push('explicit-assignee-hint')
    baseCandidates = baseCandidates.map((item) =>
      item.employeeId === explicitCandidate.employeeId ? explicitCandidate : item,
    )
  }

  const ranked = rankCandidates(baseCandidates)
  const best = ranked[0]
  const winningRule =
    DELEGATION_RULES.find((rule) => rule.targetEmployeeId === best?.employeeId && best.score >= rule.minScore) ??
    null

  const isFallback = !winningRule || best.score < (winningRule?.minScore ?? Infinity)
  const appliedRule = isFallback ? DELEGATION_MAX_FALLBACK_RULE : winningRule
  const winnerCandidate: DelegationCandidate = isFallback
    ? {
        employeeId: appliedRule.targetEmployeeId,
        codename: appliedRule.targetCodename,
        role: appliedRule.targetRole,
        specialization: appliedRule.specialization,
        score: best?.score ?? 0,
        matchedRuleIds: [],
        matchedSignals: best?.matchedSignals ?? [],
        availability: appliedRule.availability,
        rank: 1,
      }
    : best

  const confidence = computeConfidence(winnerCandidate, appliedRule, isFallback)
  const reason = buildReason(appliedRule, winnerCandidate, isFallback)

  if (conversation.hints.length > 0 && !isFallback) {
    reason.summary = `${reason.summary} Контекст чата поддерживает выбор.`
  }

  const decisionBase: Omit<DelegationDecision, 'explainability'> = {
    recommendedEmployeeId: winnerCandidate.employeeId,
    recommendedCodename: resolveCodename(winnerCandidate.employeeId, winnerCandidate.codename),
    recommendedRole: resolveRole(winnerCandidate.employeeId, winnerCandidate.role),
    confidence,
    reason,
  }

  const explainability = buildDelegationExplainability({
    decision: decisionBase,
    candidates: ranked,
    matchedTaskSignals: winnerCandidate.matchedSignals,
    conversationHints: conversation.hints,
    workingMemoryHints: memory.hints,
  })

  const category: DelegationCategory = appliedRule.category

  return {
    id: createPlanId(now),
    version: DELEGATION_ENGINE_VERSION,
    decidedByEmployeeId: DELEGATION_DECIDER_EMPLOYEE_ID,
    taskId: input.task.taskId ?? null,
    taskTitle: input.task.title.trim(),
    taskDigest,
    category,
    decision: { ...decisionBase, explainability },
    candidates: ranked,
    executionEnabled: false,
    createdAt: nowIso(now),
  }
}
