/**
 * MAX Delegation Engine — declarative rules catalog (AI-COMPANY-112B).
 */

import type {
  DelegationCatalogRule,
  DelegationScoreResult,
  DelegationSignalRule,
} from './delegationEngineTypes'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'

export const BUILDER_DELEGATION_EMPLOYEE_ID = EMPLOYEE_ROUTE_IDS.builder

export const DELEGATION_RULES: DelegationCatalogRule[] = [
  {
    id: 'ui-design-builder',
    category: 'ui_design',
    reasonCode: 'ui_design_match',
    targetEmployeeId: BUILDER_DELEGATION_EMPLOYEE_ID,
    targetCodename: 'Builder',
    targetRole: 'Product Engineer',
    specialization: 'UI/UX implementation, screens, components, mobile/desktop polish',
    availability: 'placeholder',
    minScore: 3,
    headlineTemplate: 'UI redesign → Builder',
    reasonSummaryTemplate:
      'Задача содержит сигналы UI/UX redesign — Builder отвечает за product engineering и интерфейсы.',
    signals: [
      {
        id: 'ui-redesign',
        patterns: [
          'ui redesign',
          'редизайн',
          'redesign',
          'переработ',
          'wireframe',
          'figma',
          'mockup',
          'макет',
        ],
        weight: 4,
      },
      {
        id: 'ui-screen',
        patterns: [
          'ui',
          'ux',
          'экран',
          'страниц',
          'component',
          'css',
          'mobile ui',
          'layout',
          'кнопк',
          'форма',
          'карточк',
        ],
        weight: 3,
      },
      {
        id: 'ui-visual',
        patterns: ['visual', 'pixel', 'spacing', 'typography', 'tailwind', 'стил'],
        weight: 2,
      },
    ],
  },
  {
    id: 'architecture-atlas',
    category: 'architecture',
    reasonCode: 'architecture_match',
    targetEmployeeId: EMPLOYEE_ROUTE_IDS.atlas,
    targetCodename: 'Atlas',
    targetRole: 'AI CTO',
    specialization: 'Architecture, ADR, domain boundaries, platform invariants',
    availability: 'active',
    minScore: 3,
    headlineTemplate: 'Architecture → Atlas',
    reasonSummaryTemplate:
      'Задача затрагивает архитектуру, границы domain или ADR — Atlas отвечает за platform design.',
    signals: [
      {
        id: 'arch-design',
        patterns: [
          'architecture',
          'архитект',
          'adr',
          'domain model',
          'bounded context',
          'system design',
          'platform',
        ],
        weight: 4,
      },
      {
        id: 'arch-invariant',
        patterns: [
          'multi-tenant',
          'companyid',
          'invariant',
          'policy',
          'relationship',
          'tenant',
          'инвариант',
        ],
        weight: 3,
      },
      {
        id: 'arch-review',
        patterns: ['design review', 'trade-off', 'refactor plan', 'decompose', 'split domain'],
        weight: 2,
      },
    ],
  },
  {
    id: 'bug-investigation-sentinel',
    category: 'bug_investigation',
    reasonCode: 'bug_investigation_match',
    targetEmployeeId: EMPLOYEE_ROUTE_IDS.sentinel,
    targetCodename: 'Sentinel',
    targetRole: 'AI QA',
    specialization: 'Bug investigation, regression, acceptance, demo readiness',
    availability: 'placeholder',
    minScore: 3,
    headlineTemplate: 'Bug investigation → Sentinel',
    reasonSummaryTemplate:
      'Задача про расследование дефекта, регресс или acceptance — Sentinel ведёт QA и verification.',
    signals: [
      {
        id: 'bug-core',
        patterns: [
          'bug',
          'defect',
          'баг',
          'дефект',
          'investigation',
          'расслед',
          'repro',
          'воспроизв',
          'regression',
          'регресс',
        ],
        weight: 4,
      },
      {
        id: 'bug-test',
        patterns: [
          'failing test',
          'test fail',
          'acceptance',
          'checklist',
          'smoke',
          'e2e',
          'playwright',
          'demo readiness',
        ],
        weight: 3,
      },
      {
        id: 'bug-root-cause',
        patterns: ['root cause', 'why broken', 'сломал', 'не работает', 'ошибк'],
        weight: 2,
      },
    ],
  },
]

export const DELEGATION_MAX_FALLBACK_RULE: DelegationCatalogRule = {
  id: 'unknown-max',
  category: 'unknown',
  reasonCode: 'unknown_fallback',
  targetEmployeeId: EMPLOYEE_ROUTE_IDS.max,
  targetCodename: 'MAX',
  targetRole: 'Senior Developer',
  specialization: 'General implementation, coordination, Owner-facing delivery',
  availability: 'active',
  minScore: 0,
  headlineTemplate: 'Unknown → MAX',
  reasonSummaryTemplate:
    'Категория задачи не однозначна — MAX координирует и выполняет или уточняет делегирование.',
  signals: [],
}

export const DELEGATION_CONVERSATION_HINT_PATTERNS: Array<{
  employeeId: string
  codename: string
  patterns: string[]
  weight: number
}> = [
  {
    employeeId: BUILDER_DELEGATION_EMPLOYEE_ID,
    codename: 'Builder',
    patterns: ['builder', 'билдер', 'ui', 'экран', 'figma'],
    weight: 2,
  },
  {
    employeeId: EMPLOYEE_ROUTE_IDS.atlas,
    codename: 'Atlas',
    patterns: ['atlas', 'атлас', 'architecture', 'adr', 'архитект'],
    weight: 2,
  },
  {
    employeeId: EMPLOYEE_ROUTE_IDS.sentinel,
    codename: 'Sentinel',
    patterns: ['sentinel', 'сентинел', 'qa', 'bug', 'acceptance'],
    weight: 2,
  },
]

export function normalizeDelegationText(text: string): string {
  return text.trim().toLowerCase()
}

export function scoreDelegationSignals(
  text: string,
  rules: DelegationSignalRule[],
): DelegationScoreResult {
  const normalized = normalizeDelegationText(text)
  if (!normalized) {
    return { score: 0, matchedSignals: [], matchedRuleIds: [] }
  }

  let score = 0
  const matchedSignals: string[] = []
  const matchedRuleIds: string[] = []

  for (const rule of rules) {
    const hit = rule.patterns.find((pattern) => normalized.includes(pattern.toLowerCase()))
    if (hit) {
      score += rule.weight
      matchedSignals.push(rule.id)
      matchedRuleIds.push(rule.id)
    }
  }

  return { score, matchedSignals, matchedRuleIds }
}

export function maxDelegationRuleScore(rule: DelegationCatalogRule): number {
  return rule.signals.reduce((sum, item) => sum + item.weight, 0)
}
