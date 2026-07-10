/**
 * Delegation Plan — Owner-facing explanations (AI-COMPANY-112D).
 * Primary text is human-readable; confidence is secondary metadata.
 */

import type { DelegationCategory } from '../delegationEngine'
import type { DelegationPlanAlternative, DelegationPlanRecord } from './delegationPlanTypes'

const CATEGORY_OWNER_REASON: Record<DelegationCategory, string> = {
  ui_design: 'она связана с разработкой интерфейса и кодом',
  architecture: 'она затрагивает архитектуру и границы системы',
  bug_investigation: 'требуется расследование дефекта и QA-проверка',
  general: 'MAX координирует задачу до уточнения исполнителя',
  unknown: 'категория задачи пока неоднозначна и нужна координация MAX',
}

const CATEGORY_RISK: Record<DelegationCategory, string> = {
  ui_design: 'Средний риск — делегирование UI-задачи другому сотруднику',
  architecture: 'Высокий риск — архитектурные решения требуют контроля Owner',
  bug_investigation: 'Низкий риск — QA-расследование без изменения ownership',
  general: 'Средний риск — требуется подтверждение исполнителя',
  unknown: 'Требует уточнения — MAX предложил fallback',
}

export function formatDelegationPlanPrimaryExplanation(input: {
  recommendedCodename: string
  category: DelegationCategory
  reasonSummary?: string | null
}): string {
  const because = CATEGORY_OWNER_REASON[input.category]
  const base = `MAX предлагает поручить задачу ${input.recommendedCodename}, потому что ${because}.`

  if (input.reasonSummary && input.category !== 'unknown') {
    const trimmed = input.reasonSummary.trim()
    if (trimmed && !trimmed.toLowerCase().includes('score')) {
      return `${base} ${trimmed}`
    }
  }

  return base
}

export function resolveDelegationPlanRisk(category: DelegationCategory): string {
  return CATEGORY_RISK[category]
}

export function formatDelegationPlanConfidenceLabel(confidence: number): string {
  return `Уверенность MAX: ${Math.round(confidence * 100)}%`
}

export function sanitizeAlternativesForOwner(
  alternatives: DelegationPlanAlternative[],
): DelegationPlanAlternative[] {
  return alternatives.map((item) => ({
    employeeId: item.employeeId,
    codename: item.codename,
    whyNotChosen: item.whyNotChosen?.replace(/Score \d+/gi, 'Меньше подходит') ?? null,
  }))
}

export function summarizeDelegationPlanForOwner(record: DelegationPlanRecord): string {
  return record.ownerExplanation
}
