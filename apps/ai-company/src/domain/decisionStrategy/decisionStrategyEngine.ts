/**
 * Decision Strategy engine — builds DecisionPlan from Brain + task (AI-COMPANY-101E).
 * Catalog-driven; does not invoke Runtime execution.
 */

import type { DecisionPlan, DecisionPlanModelChoice } from '../decisionPlan'
import { createDecisionPlanId, digestTaskText } from '../decisionPlan'
import type { EmployeeBrainProfile, EmployeeBrainTaskInput } from '../employeeBrain/employeeBrainProfile'
import {
  resolveRuntimeModelRoute,
  type RuntimeModelMode,
  type RuntimeModelRoute,
} from '../runtime/runtimeModelRouting'
import type { RuntimeProfile } from '../runtime/runtimeProfile'
import { getToolRegistryV1EntryById, resolveRequiresOwnerApproval } from '../toolRegistry'
import type { ToolRegistryV1ToolId } from '../toolRegistry'
import {
  BRAIN_RISK_RANK,
  COMPLEXITY_RANK,
  CURSOR_AUTOMATION_SIGNAL_RULES,
  DECISION_APPROVAL_TRIGGERS,
  DECISION_EXPECTED_RESULT_TEMPLATES,
  DECISION_GENERAL_INTENT,
  DECISION_MULTI_MODEL_TRIGGERS,
  DECISION_TASK_INTENT_RULES,
  DECISION_TOOL_NEED_RULES,
  TOOL_RISK_RANK,
  scoreDecisionSignals,
  type DecisionTaskComplexity,
  type DecisionTaskIntent,
} from './decisionStrategyCatalog'

export type BuildDecisionPlanInput = {
  brain: EmployeeBrainProfile
  task: EmployeeBrainTaskInput
  runtimeProfile: RuntimeProfile
  now?: Date
}

type ClassifiedTask = {
  intent: DecisionTaskIntent
  complexity: DecisionTaskComplexity
  matchedSignals: string[]
  score: number
}

function classifyTask(taskText: string, title: string | null): ClassifiedTask {
  const corpus = [taskText, title ?? ''].filter(Boolean).join('\n')
  let bestIntent: DecisionTaskIntent = 'general'
  let bestScore = 0
  let bestComplexity: DecisionTaskComplexity = 'low'
  const matchedSignals: string[] = []

  for (const rule of DECISION_TASK_INTENT_RULES) {
    const { score, matched } = scoreDecisionSignals(corpus, rule.signals)
    if (score > bestScore) {
      bestScore = score
      bestIntent = rule.intent
      bestComplexity = rule.complexityHint
      matchedSignals.splice(0, matchedSignals.length, ...matched)
    }
  }

  if (bestScore === 0) {
    return {
      intent: DECISION_GENERAL_INTENT.intent,
      complexity: DECISION_GENERAL_INTENT.complexityHint,
      matchedSignals: [],
      score: 0,
    }
  }

  return { intent: bestIntent, complexity: bestComplexity, matchedSignals, score: bestScore }
}

function resolvePrimaryModelMode(
  brain: EmployeeBrainProfile,
  classified: ClassifiedTask,
  requested?: RuntimeModelMode | null,
): RuntimeModelMode {
  if (requested) return requested

  const intentRule =
    DECISION_TASK_INTENT_RULES.find((item) => item.intent === classified.intent) ?? DECISION_GENERAL_INTENT

  if (brain.modelSelectionStrategy === 'fast_first' && classified.complexity !== 'high') {
    return 'fast'
  }

  if (brain.modelSelectionStrategy === 'single_best') {
    return intentRule.defaultModelMode
  }

  return intentRule.defaultModelMode
}

function routeToModelChoice(
  route: RuntimeModelRoute,
  role: DecisionPlanModelChoice['role'],
  reason: string,
): DecisionPlanModelChoice {
  return {
    catalogModelId: route.catalogModelId,
    ollamaTag: route.resolvedOllamaTag,
    label: route.catalogModelLabel,
    modelMode: route.modelMode,
    role,
    reason,
  }
}

function resolveModelPipeline(input: {
  brain: EmployeeBrainProfile
  classified: ClassifiedTask
  runtimeProfile: RuntimeProfile
  primaryMode: RuntimeModelMode
  task: EmployeeBrainTaskInput
}): { useMultipleModels: boolean; pipeline: DecisionPlanModelChoice[]; rationale: string[] } {
  const rationale: string[] = []
  const primaryRoute = resolveRuntimeModelRoute({
    employeeId: input.brain.employeeId,
    profile: input.runtimeProfile,
    modelMode: input.primaryMode,
  })

  const primary = routeToModelChoice(
    primaryRoute,
    'primary',
    `Intent ${input.classified.intent} · strategy ${input.brain.modelSelectionStrategy} → ${primaryRoute.catalogModelLabel}`,
  )

  const trigger = DECISION_MULTI_MODEL_TRIGGERS.find(
    (item) =>
      item.whenIntents.includes(input.classified.intent) &&
      COMPLEXITY_RANK[input.classified.complexity] >= COMPLEXITY_RANK[item.minComplexity] &&
      item.brainStrategies.includes(input.brain.modelSelectionStrategy),
  )

  const wantsVerification =
    input.brain.reasoningPreferences.preferVerification &&
    input.classified.intent !== 'documentation' &&
    input.classified.complexity !== 'low'

  if (!trigger && !wantsVerification) {
    return { useMultipleModels: false, pipeline: [primary], rationale }
  }

  const modes = trigger?.pipelineModes ?? ['coding', 'qa']
  const secondaryMode = modes.find((mode) => mode !== primary.modelMode) ?? 'qa'

  const secondaryRoute = resolveRuntimeModelRoute({
    employeeId: input.brain.employeeId,
    profile: input.runtimeProfile,
    modelMode: secondaryMode,
  })

  const secondary = routeToModelChoice(
    secondaryRoute,
    trigger?.pipelineModes[0] === primary.modelMode ? 'verification' : 'secondary',
    trigger
      ? trigger.description
      : 'Brain preferVerification — secondary pass for review/QA',
  )

  rationale.push(
    trigger
      ? `Multi-model trigger: ${trigger.id}`
      : 'Verification model added by Brain reasoning preference',
  )

  return { useMultipleModels: true, pipeline: [primary, secondary], rationale }
}

function resolveToolNeeds(taskText: string, title: string | null, brain: EmployeeBrainProfile): {
  required: boolean
  toolIds: ToolRegistryV1ToolId[]
  reason: string | null
  matched: string[]
} {
  if (brain.toolSelectionStrategy === 'minimal') {
    return { required: false, toolIds: [], reason: null, matched: [] }
  }

  const corpus = [taskText, title ?? ''].join('\n')
  const toolIds: ToolRegistryV1ToolId[] = []
  const matched: string[] = []

  for (const rule of DECISION_TOOL_NEED_RULES) {
    const { score, matched: signalIds } = scoreDecisionSignals(corpus, [
      { id: rule.toolId, patterns: rule.patterns, weight: 1 },
    ])
    if (score >= rule.minWeight) {
      toolIds.push(rule.toolId)
      matched.push(...signalIds.map((id) => `${rule.toolId}:${id}`))
    }
  }

  const unique = [...new Set(toolIds)]
  if (unique.length === 0) {
    return { required: false, toolIds: [], reason: null, matched }
  }

  return {
    required: true,
    toolIds: unique,
    reason: `Tool Registry signals: ${unique.join(', ')}`,
    matched,
  }
}

function resolveCursorAutomation(taskText: string, title: string | null, suggestedTools: ToolRegistryV1ToolId[]): {
  required: boolean
  reason: string | null
  matched: string[]
} {
  const corpus = [taskText, title ?? ''].join('\n')
  const { score, matched } = scoreDecisionSignals(corpus, CURSOR_AUTOMATION_SIGNAL_RULES)

  if (suggestedTools.includes('cursor-automation') || score >= 2) {
    const hit = matched[0] ?? 'cursor-automation-tool'
    return {
      required: true,
      reason: `External code execution signal (${hit}) — Cursor Automation path.`,
      matched,
    }
  }

  return { required: false, reason: null, matched: [] }
}

function resolveOwnerApproval(input: {
  brain: EmployeeBrainProfile
  toolIds: ToolRegistryV1ToolId[]
  cursorRequired: boolean
}): { required: boolean; reasons: string[] } {
  const reasons: string[] = []
  let maxToolRisk: 'low' | 'medium' | 'high' | 'critical' = 'low'

  for (const toolId of input.toolIds) {
    const entry = getToolRegistryV1EntryById(toolId)
    if (!entry) continue
    if (TOOL_RISK_RANK[entry.riskLevel] > TOOL_RISK_RANK[maxToolRisk]) {
      maxToolRisk = entry.riskLevel
    }
    if (resolveRequiresOwnerApproval(entry)) {
      reasons.push(`Tool ${entry.name} requires Owner Approval by registry policy.`)
    }
  }

  for (const trigger of DECISION_APPROVAL_TRIGGERS) {
    const brainHit = trigger.brainTriggers.some((item) => input.brain.ownerApprovalTriggers.includes(item))
    const cursorHit = trigger.whenCursorAutomation === true && input.cursorRequired
    const supervisedHit =
      trigger.whenAutonomySupervised === true && input.brain.autonomyLevel === 'supervised'
    const riskHit =
      trigger.toolRiskAtLeast !== undefined &&
      TOOL_RISK_RANK[maxToolRisk] >= TOOL_RISK_RANK[trigger.toolRiskAtLeast]

    if (brainHit || cursorHit || (supervisedHit && riskHit) || (riskHit && trigger.toolRiskAtLeast === 'high')) {
      if (!reasons.includes(trigger.reason)) {
        reasons.push(trigger.reason)
      }
    }
  }

  if (
    input.brain.acceptableRisk &&
    TOOL_RISK_RANK[maxToolRisk] > BRAIN_RISK_RANK[input.brain.acceptableRisk]
  ) {
    reasons.push(
      `Tool risk (${maxToolRisk}) exceeds Brain acceptableRisk (${input.brain.acceptableRisk}).`,
    )
  }

  return { required: reasons.length > 0, reasons: [...new Set(reasons)] }
}

function resolveExpectedResult(intent: DecisionTaskIntent, taskTitle: string | null): DecisionPlan['expectedResult'] {
  const template =
    DECISION_EXPECTED_RESULT_TEMPLATES.find((item) => item.intent === intent) ??
    DECISION_EXPECTED_RESULT_TEMPLATES.find((item) => item.intent === 'general')!

  const titleSuffix = taskTitle?.trim() ? ` «${taskTitle.trim()}»` : ''
  return {
    summary: `${template.summary}${titleSuffix}`,
    deliverables: [...template.deliverables],
    acceptanceCriteria: [...template.acceptanceCriteria],
  }
}

export function buildDecisionPlan(input: BuildDecisionPlanInput): DecisionPlan {
  const now = input.now ?? new Date()
  const taskText = input.task.taskText.trim()
  const taskTitle = input.task.title?.trim() ?? null
  const classified = classifyTask(taskText, taskTitle)

  const primaryMode = resolvePrimaryModelMode(
    input.brain,
    classified,
    input.task.requestedModelMode,
  )

  const modelResult = resolveModelPipeline({
    brain: input.brain,
    classified,
    runtimeProfile: input.runtimeProfile,
    primaryMode,
    task: input.task,
  })

  const tools = resolveToolNeeds(taskText, taskTitle, input.brain)
  const cursor = resolveCursorAutomation(taskText, taskTitle, tools.toolIds)
  const approval = resolveOwnerApproval({
    brain: input.brain,
    toolIds: tools.toolIds,
    cursorRequired: cursor.required,
  })

  const rationale = [
    `Classified intent: ${classified.intent} (score ${classified.score}).`,
    `Brain ${input.brain.specialization} · style ${input.brain.decisionStyle}.`,
    ...modelResult.rationale,
  ]

  if (tools.required) rationale.push(tools.reason ?? 'Tool Registry required.')
  if (cursor.required) rationale.push(cursor.reason ?? 'Cursor Automation required.')

  const matchedTaskSignals = [
    ...classified.matchedSignals,
    ...tools.matched,
    ...cursor.matched,
  ]

  return {
    id: createDecisionPlanId(),
    version: 'v1',
    employeeId: input.brain.employeeId,
    brainProfileId: input.brain.id,
    taskId: input.task.taskId ?? null,
    taskTitle,
    taskTextDigest: digestTaskText(taskText),
    createdAt: now.toISOString(),
    primaryModel: modelResult.pipeline[0],
    useMultipleModels: modelResult.useMultipleModels,
    modelPipeline: modelResult.pipeline,
    toolRegistryRequired: tools.required,
    suggestedToolIds: tools.toolIds,
    toolRegistryReason: tools.reason,
    cursorAutomationRequired: cursor.required,
    cursorAutomationReason: cursor.reason,
    ownerApprovalRequired: approval.required,
    ownerApprovalReasons: approval.reasons,
    expectedResult: resolveExpectedResult(classified.intent, taskTitle),
    rationale,
    matchedTaskSignals,
    classifiedIntent: classified.intent,
  }
}
