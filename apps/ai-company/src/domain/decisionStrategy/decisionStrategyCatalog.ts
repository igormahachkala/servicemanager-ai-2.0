/**
 * Decision Strategy catalog — declarative rules (AI-COMPANY-101E).
 * Engine reads this catalog; no inline keyword magic in the engine.
 */

import type { RuntimeModelMode } from '../runtime/runtimeModelRouting'
import type { ToolRegistryV1ToolId } from '../toolRegistry'
import type { EmployeeBrainModelStrategy, EmployeeBrainRiskLevel } from '../employeeBrain/employeeBrainProfile'

export type DecisionTaskIntent =
  | 'analysis'
  | 'implementation'
  | 'qa'
  | 'documentation'
  | 'research'
  | 'ops'
  | 'general'

export type DecisionTaskComplexity = 'low' | 'medium' | 'high'

export type DecisionSignalRule = {
  id: string
  patterns: string[]
  weight: number
}

export type DecisionIntentRule = {
  intent: DecisionTaskIntent
  signals: DecisionSignalRule[]
  defaultModelMode: RuntimeModelMode
  complexityHint: DecisionTaskComplexity
}

export const DECISION_TASK_INTENT_RULES: DecisionIntentRule[] = [
  {
    intent: 'implementation',
    defaultModelMode: 'coding',
    complexityHint: 'high',
    signals: [
      { id: 'impl-code', patterns: ['implement', 'реализ', 'создай', 'добав', 'fix', 'исправ', 'refactor', 'рефактор'], weight: 3 },
      { id: 'impl-ui', patterns: ['component', 'tsx', 'react', 'frontend', 'ui', 'страниц', 'экран'], weight: 2 },
      { id: 'impl-api', patterns: ['endpoint', 'controller', 'service', 'nestjs', 'prisma', 'backend'], weight: 2 },
    ],
  },
  {
    intent: 'qa',
    defaultModelMode: 'qa',
    complexityHint: 'medium',
    signals: [
      { id: 'qa-test', patterns: ['qa', 'test', 'acceptance', 'checklist', 'регресс', 'playwright', 'e2e'], weight: 3 },
      { id: 'qa-demo', patterns: ['demo readiness', 'demo', 'smoke', 'verify', 'провер'], weight: 2 },
    ],
  },
  {
    intent: 'documentation',
    defaultModelMode: 'fast',
    complexityHint: 'low',
    signals: [
      { id: 'doc-write', patterns: ['document', 'документ', 'adr', 'readme', 'spec', 'опис'], weight: 3 },
    ],
  },
  {
    intent: 'research',
    defaultModelMode: 'deep',
    complexityHint: 'high',
    signals: [
      { id: 'research', patterns: ['research', 'исслед', 'compare', 'сравн', 'architecture review', 'audit', 'аудит'], weight: 3 },
      { id: 'risk', patterns: ['risk', 'риск', 'trade-off', 'инвариант'], weight: 2 },
    ],
  },
  {
    intent: 'analysis',
    defaultModelMode: 'fast',
    complexityHint: 'medium',
    signals: [
      { id: 'analysis', patterns: ['analyze', 'анализ', 'review', 'обзор', 'summarize', 'summary'], weight: 3 },
    ],
  },
  {
    intent: 'ops',
    defaultModelMode: 'fast',
    complexityHint: 'medium',
    signals: [
      { id: 'ops-deploy', patterns: ['deploy', 'docker', 'pm2', 'caddy', 'infra', 'devops', 'health check'], weight: 3 },
      { id: 'ops-git', patterns: ['git push', 'merge', 'branch', 'commit', 'коммит', 'pr', 'pull request'], weight: 2 },
    ],
  },
]

export const DECISION_GENERAL_INTENT: DecisionIntentRule = {
  intent: 'general',
  defaultModelMode: 'fast',
  complexityHint: 'low',
  signals: [],
}

export const CURSOR_AUTOMATION_SIGNAL_RULES: DecisionSignalRule[] = [
  { id: 'cursor-keyword', patterns: ['cursor', 'automation', 'codex', 'pull request', 'pr', 'commit', 'коммит'], weight: 2 },
  { id: 'cursor-impl', patterns: ['implement', 'реализ', 'создай', 'добав', 'fix', 'исправ', 'build', 'workflow'], weight: 2 },
  { id: 'cursor-scope', patterns: ['apps/ai-company', 'src/domain', 'src/pages', 'src/components'], weight: 1 },
]

export type DecisionToolNeedRule = {
  toolId: ToolRegistryV1ToolId
  patterns: string[]
  minWeight: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export const DECISION_TOOL_NEED_RULES: DecisionToolNeedRule[] = [
  {
    toolId: 'cursor-automation',
    patterns: ['cursor', 'automation', 'codex', 'pull request', 'pr', 'handoff', 'implement', 'реализ'],
    minWeight: 2,
    riskLevel: 'high',
  },
  {
    toolId: 'filesystem',
    patterns: ['file', 'read', 'write', 'repo', 'path', 'файл', 'прочит', 'запиш'],
    minWeight: 1,
    riskLevel: 'medium',
  },
  {
    toolId: 'terminal',
    patterns: ['npm run', 'build', 'test', 'shell', 'terminal', 'command', 'сборк'],
    minWeight: 2,
    riskLevel: 'critical',
  },
  {
    toolId: 'git',
    patterns: ['git', 'commit', 'branch', 'merge', 'push', 'коммит', 'ветк'],
    minWeight: 2,
    riskLevel: 'high',
  },
  {
    toolId: 'playwright',
    patterns: ['playwright', 'browser', 'e2e', 'acceptance', 'ui test', 'скрин'],
    minWeight: 2,
    riskLevel: 'high',
  },
  {
    toolId: 'docker',
    patterns: ['docker', 'compose', 'container', 'image'],
    minWeight: 2,
    riskLevel: 'critical',
  },
  {
    toolId: 'github',
    patterns: ['github', 'pull request', 'issue', 'release'],
    minWeight: 2,
    riskLevel: 'high',
  },
]

export type DecisionMultiModelTrigger = {
  id: string
  description: string
  whenIntents: DecisionTaskIntent[]
  minComplexity: DecisionTaskComplexity
  brainStrategies: EmployeeBrainModelStrategy[]
  pipelineModes: RuntimeModelMode[]
}

export const DECISION_MULTI_MODEL_TRIGGERS: DecisionMultiModelTrigger[] = [
  {
    id: 'impl-with-verification',
    description: 'Implementation task with Brain verification preference',
    whenIntents: ['implementation', 'ops'],
    minComplexity: 'medium',
    brainStrategies: ['multi_step', 'fast_first'],
    pipelineModes: ['coding', 'qa'],
  },
  {
    id: 'research-deep',
    description: 'Research / audit with deep reasoning then fast summary',
    whenIntents: ['research', 'analysis'],
    minComplexity: 'high',
    brainStrategies: ['multi_step'],
    pipelineModes: ['deep', 'fast'],
  },
]

export type DecisionExpectedResultTemplate = {
  intent: DecisionTaskIntent
  summary: string
  deliverables: string[]
  acceptanceCriteria: string[]
}

export const DECISION_EXPECTED_RESULT_TEMPLATES: DecisionExpectedResultTemplate[] = [
  {
    intent: 'implementation',
    summary: 'Рабочий код или handoff-пакет в scope задачи с проверкой сборки.',
    deliverables: ['Изменения в указанных файлах или Cursor handoff', 'Краткий отчёт Owner (Task/Files/Checks)'],
    acceptanceCriteria: ['npm --prefix apps/ai-company run build (если затронут ai-company)', 'Нет нарушения multi-tenant / ticket owner инвариантов'],
  },
  {
    intent: 'qa',
    summary: 'Проверяемый QA-результат: сценарии, findings, demo readiness.',
    deliverables: ['Checklist или test scenarios', 'Pass/fail по acceptance criteria'],
    acceptanceCriteria: ['Воспроизводимые шаги', 'Blockers явно перечислены'],
  },
  {
    intent: 'documentation',
    summary: 'Структурированная документация или ADR в согласованном формате.',
    deliverables: ['Markdown doc / ADR', 'Ссылки на затронутые domain entities'],
    acceptanceCriteria: ['Согласовано с operating rules', 'Owner может принять без уточнений'],
  },
  {
    intent: 'research',
    summary: 'Аналитический отчёт с выводами, рисками и рекомендациями.',
    deliverables: ['Findings и risks', 'Recommended next step для Owner'],
    acceptanceCriteria: ['Trade-offs явно указаны', 'Нет скрытых assumptions'],
  },
  {
    intent: 'analysis',
    summary: 'Краткий structured analysis по задаче Owner.',
    deliverables: ['Summary + key findings', 'Suggested next actions'],
    acceptanceCriteria: ['Ответ на исходный вопрос задачи', 'Actionable для Owner'],
  },
  {
    intent: 'ops',
    summary: 'Ops-план или readiness checklist без несанкционированного deploy.',
    deliverables: ['Steps / checklist', 'Rollback или verification notes'],
    acceptanceCriteria: ['Production gated by Owner Approval', 'Health checks описаны'],
  },
  {
    intent: 'general',
    summary: 'Structured employee report по задаче Owner.',
    deliverables: ['Что сделано / обнаружено / что требует Owner', 'Recommended next step'],
    acceptanceCriteria: ['Соответствует specialization Brain', 'Без fake progress'],
  },
]

export type DecisionApprovalTrigger = {
  id: string
  reason: string
  brainTriggers: string[]
  toolRiskAtLeast?: 'medium' | 'high' | 'critical'
  whenCursorAutomation?: boolean
  whenAutonomySupervised?: boolean
}

export const DECISION_APPROVAL_TRIGGERS: DecisionApprovalTrigger[] = [
  {
    id: 'cursor-automation',
    reason: 'Cursor Automation handoff требует Owner Approval перед submit.',
    brainTriggers: ['cursor_automation'],
    whenCursorAutomation: true,
  },
  {
    id: 'high-risk-tool',
    reason: 'Matched Tool Registry entry с elevated risk.',
    brainTriggers: [],
    toolRiskAtLeast: 'high',
  },
  {
    id: 'supervised-autonomy',
    reason: 'Brain autonomy supervised — внешние инструменты только после Owner.',
    brainTriggers: [],
    whenAutonomySupervised: true,
    toolRiskAtLeast: 'medium',
  },
  {
    id: 'git-push',
    reason: 'Git push / merge в scope Owner decision authority.',
    brainTriggers: ['git_push'],
  },
  {
    id: 'production',
    reason: 'Production deploy или cloud execution gated.',
    brainTriggers: ['production'],
  },
]

export const BRAIN_RISK_RANK: Record<EmployeeBrainRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

export const TOOL_RISK_RANK: Record<'low' | 'medium' | 'high' | 'critical', number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

export const COMPLEXITY_RANK: Record<DecisionTaskComplexity, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

export function normalizeDecisionText(text: string): string {
  return text.trim().toLowerCase()
}

export function scoreDecisionSignals(text: string, rules: DecisionSignalRule[]): { score: number; matched: string[] } {
  const normalized = normalizeDecisionText(text)
  if (!normalized) return { score: 0, matched: [] }

  let score = 0
  const matched: string[] = []

  for (const rule of rules) {
    const hit = rule.patterns.find((pattern) => normalized.includes(pattern.toLowerCase()))
    if (hit) {
      score += rule.weight
      matched.push(rule.id)
    }
  }

  return { score, matched }
}
