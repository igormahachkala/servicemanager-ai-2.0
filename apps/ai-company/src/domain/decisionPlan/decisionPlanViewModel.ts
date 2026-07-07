/**
 * Decision Plan — Owner-facing view model (AI-COMPANY-102A).
 */

import { buildDefaultEmployeeBrainProfile } from '../employeeBrain/employeeBrainCatalog'
import type { EmployeeBrainProfile } from '../employeeBrain/employeeBrainProfile'
import { getToolRegistryV1EntryById } from '../toolRegistry'
import type { DecisionPlan } from './decisionPlan'

export type MaxDecisionPlanView = {
  planId: string
  createdAt: string
  isPreview: boolean
  sourceLabel: string
  taskTitle: string | null
  taskDigest: string
  classifiedIntentLabel: string
  brainSpecialization: string
  brainDecisionStyle: string
  brainProfileId: string
  primaryModelLabel: string
  primaryModelReason: string
  useMultipleModels: boolean
  multiModelNote: string | null
  modelPipeline: Array<{ label: string; role: string; reason: string }>
  toolRegistryRequired: boolean
  suggestedTools: Array<{ id: string; name: string }>
  toolRegistryReason: string | null
  cursorAutomationRequired: boolean
  cursorAutomationReason: string | null
  ownerApprovalRequired: boolean
  ownerApprovalReasons: string[]
  expectedSummary: string
  deliverables: string[]
  acceptanceCriteria: string[]
  matchedSignals: string[]
  rationale: string[]
}

const INTENT_LABELS_RU: Record<string, string> = {
  analysis: 'Анализ',
  implementation: 'Реализация',
  qa: 'QA / проверка',
  documentation: 'Документация',
  research: 'Исследование',
  ops: 'Ops / инфраструктура',
  general: 'Общая задача',
}

const DECISION_STYLE_LABELS_RU: Record<string, string> = {
  conservative: 'Консервативный',
  balanced: 'Сбалансированный',
  pragmatic: 'Прагматичный',
}

const MODEL_ROLE_LABELS_RU: Record<string, string> = {
  primary: 'Основная',
  secondary: 'Вторичная',
  verification: 'Верификация',
}

function resolveBrainProfile(plan: DecisionPlan): EmployeeBrainProfile {
  const byId = loadBrainProfileFromStorage(plan.brainProfileId)
  if (byId) return byId
  return buildDefaultEmployeeBrainProfile(plan.employeeId)
}

function loadBrainProfileFromStorage(profileId: string): EmployeeBrainProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('ai-company-employee-brain-profiles')
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        (item as { id: string }).id === profileId
      ) {
        return item as EmployeeBrainProfile
      }
    }
  } catch {
    return null
  }
  return null
}

export function buildMaxDecisionPlanView(
  plan: DecisionPlan,
  options: { isPreview?: boolean; sourceLabel?: string } = {},
): MaxDecisionPlanView {
  const brain = resolveBrainProfile(plan)
  const isPreview = options.isPreview === true
  const sourceLabel =
    options.sourceLabel ??
    (isPreview ? 'Предпросмотр до запуска' : 'План зафиксирован перед выполнением')

  const suggestedTools = plan.suggestedToolIds.map((id) => {
    const entry = getToolRegistryV1EntryById(id)
    return { id, name: entry?.name ?? id }
  })

  const modelPipeline = plan.modelPipeline.map((item) => ({
    label: item.label,
    role: MODEL_ROLE_LABELS_RU[item.role] ?? item.role,
    reason: item.reason,
  }))

  const multiModelNote = plan.useMultipleModels
    ? `Multi-model: ${plan.modelPipeline.map((item) => item.label).join(' → ')}`
    : null

  return {
    planId: plan.id,
    createdAt: plan.createdAt,
    isPreview,
    sourceLabel,
    taskTitle: plan.taskTitle,
    taskDigest: plan.taskTextDigest,
    classifiedIntentLabel: INTENT_LABELS_RU[plan.classifiedIntent] ?? plan.classifiedIntent,
    brainSpecialization: brain.specialization,
    brainDecisionStyle: DECISION_STYLE_LABELS_RU[brain.decisionStyle] ?? brain.decisionStyle,
    brainProfileId: plan.brainProfileId,
    primaryModelLabel: plan.primaryModel.label,
    primaryModelReason: plan.primaryModel.reason,
    useMultipleModels: plan.useMultipleModels,
    multiModelNote,
    modelPipeline,
    toolRegistryRequired: plan.toolRegistryRequired,
    suggestedTools,
    toolRegistryReason: plan.toolRegistryReason,
    cursorAutomationRequired: plan.cursorAutomationRequired,
    cursorAutomationReason: plan.cursorAutomationReason,
    ownerApprovalRequired: plan.ownerApprovalRequired,
    ownerApprovalReasons: plan.ownerApprovalReasons,
    expectedSummary: plan.expectedResult.summary,
    deliverables: plan.expectedResult.deliverables,
    acceptanceCriteria: plan.expectedResult.acceptanceCriteria,
    matchedSignals: plan.matchedTaskSignals,
    rationale: plan.rationale,
  }
}
