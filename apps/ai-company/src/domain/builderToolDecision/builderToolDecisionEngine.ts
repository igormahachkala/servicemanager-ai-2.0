/**
 * Builder Tool Decision — evaluation after Decision Plan (AI-COMPANY-113B).
 */

import type { DecisionPlan } from '../decisionPlan'
import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry'
import type {
  BuilderToolDecision,
  BuilderToolDecisionOutcome,
  BuilderToolRiskLevel,
  EvaluateBuilderToolDecisionInput,
} from './builderToolDecisionTypes'
import { createBuilderToolDecisionId } from './builderToolDecisionStorage'

const CODE_CHANGE_SIGNALS = [
  /\b(implement|implementing|add|adding|fix|fixing|change|changing|update|updating|refactor)\b/i,
  /\b(реализ|добав|исправ|измен|обнов|передел|сверст|верст)\w*/i,
  /\b(ui|ux|screen|page|component|layout|mobile|button|modal|banner|card)\b/i,
  /\b(страниц|экран|компонент|кнопк|мобильн|интерфейс|верстк)\w*/i,
  /\b(typescript|react|tsx|jsx|css|vite|tailwind)\b/i,
  /\b(apps\/ai-company|src\/(mobile|components|pages|domain))\b/i,
  /\.(tsx|jsx|css|ts)\b/i,
]

const ANALYSIS_ONLY_SIGNALS = [
  /\b(review|audit|analyze|analysis|assess|evaluate|overview|inspect)\b/i,
  /\b(обзор|аудит|анализ|оцен|провер|исслед)\w*/i,
  /\b(architecture|trade-?off|planning|roadmap)\b/i,
  /\b(архитект|планир|дорожн)\w*/i,
]

const FILE_PATH_PATTERN =
  /(?:apps\/[\w./-]+|src\/[\w./-]+|[\w-]+\.(?:tsx|jsx|ts|css|md))\b/g

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeText(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join('\n').toLowerCase()
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern) => (pattern.test(text) ? score + 1 : score), 0)
}

function extractFileScope(text: string): string[] {
  const matches = text.match(FILE_PATH_PATTERN) ?? []
  return [...new Set(matches.map((item) => item.trim()))].slice(0, 8)
}

function buildChecks(outcome: BuilderToolDecisionOutcome, fileScope: string[]): string[] {
  if (outcome === 'code_change_cursor') {
    return [
      'npm --prefix apps/ai-company run build',
      'Mobile UI smoke on target screen',
      fileScope.length > 0 ? `Scope review: ${fileScope.slice(0, 3).join(', ')}` : 'Confirm affected files with Owner',
    ]
  }
  if (outcome === 'local_model_analysis') {
    return ['Local Ollama reasoning via Runtime', 'Runtime Report for Owner review']
  }
  return ['No external tool — task closed after analysis']
}

function resolveRisk(outcome: BuilderToolDecisionOutcome, fileScope: string[]): BuilderToolRiskLevel {
  if (outcome !== 'code_change_cursor') return 'low'
  if (fileScope.some((path) => path.includes('domain/') || path.includes('runtime'))) return 'high'
  if (fileScope.length >= 3) return 'medium'
  return 'medium'
}

function scoreCursorNeed(input: EvaluateBuilderToolDecisionInput, text: string): number {
  let score = 0
  const plan = input.decisionPlan

  if (plan?.cursorAutomationRequired) score += 4
  if (plan?.toolRegistryRequired) score += 2
  if (plan?.classifiedIntent === 'implementation') score += 2
  if (plan?.classifiedIntent === 'ui_change') score += 3

  score += countMatches(text, CODE_CHANGE_SIGNALS) * 2
  score -= countMatches(text, ANALYSIS_ONLY_SIGNALS) * 2

  if (input.structuredPayload?.mode === 'complex') score += 1
  if (input.structuredPayload?.expectedResult?.trim()) score += 1

  const objective = input.structuredPayload?.objective?.trim()
  if (objective && CODE_CHANGE_SIGNALS.some((pattern) => pattern.test(objective))) score += 2

  return score
}

function resolveOutcome(score: number): BuilderToolDecisionOutcome {
  if (score >= 4) return 'code_change_cursor'
  if (score <= 0) return 'no_tool'
  return 'local_model_analysis'
}

function buildReason(outcome: BuilderToolDecisionOutcome, plan: DecisionPlan | null, score: number): string {
  if (outcome === 'code_change_cursor') {
    const planHint = plan?.cursorAutomationReason ?? plan?.toolRegistryReason
    return (
      planHint ??
      'Задача требует изменения product-кода — Builder запросит Cursor через Tool Dispatcher после одобрения Owner.'
    )
  }
  if (outcome === 'local_model_analysis') {
    return 'Задача решается анализом локальной модели через Runtime без внешнего инструмента.'
  }
  return `Инструмент не требуется (оценка Builder: score=${score}).`
}

function confidenceFromScore(score: number, outcome: BuilderToolDecisionOutcome): number {
  if (outcome === 'code_change_cursor') return Math.min(0.95, 0.55 + score * 0.08)
  if (outcome === 'local_model_analysis') return Math.min(0.85, 0.45 + Math.abs(score) * 0.06)
  return Math.min(0.75, 0.4 + Math.abs(score) * 0.05)
}

export function isBuilderToolDecisionEmployee(employeeId: string): boolean {
  return employeeId === BUILDER_EMPLOYEE_ID
}

export function evaluateBuilderToolDecision(input: EvaluateBuilderToolDecisionInput): BuilderToolDecision {
  const text = normalizeText([
    input.title,
    input.taskText,
    input.structuredPayload?.objective,
    input.structuredPayload?.context,
    input.structuredPayload?.expectedResult,
    input.structuredPayload?.constraints,
    input.expectedOutput,
  ])
  const score = scoreCursorNeed(input, text)
  const outcome = resolveOutcome(score)
  const fileScope = extractFileScope(text)
  const toolRequired = outcome === 'code_change_cursor'
  const expectedResult =
    input.structuredPayload?.expectedResult?.trim() ||
    input.expectedOutput?.trim() ||
    (toolRequired
      ? 'Изменения в product-коде после одобрения Cursor Owner.'
      : 'Отчёт / рекомендации Builder без запуска Cursor.')

  const now = nowIso()

  return {
    id: createBuilderToolDecisionId(),
    version: 'v1',
    employeeId: input.employeeId,
    workItemId: input.workItemId,
    workerLoopId: input.workerLoopId,
    decisionPlanId: input.decisionPlanId,
    outcome,
    toolRequired,
    recommendedToolId: toolRequired ? 'cursor' : null,
    reason: buildReason(outcome, input.decisionPlan, score),
    risk: resolveRisk(outcome, fileScope),
    fileScope,
    expectedResult,
    checks: buildChecks(outcome, fileScope),
    confidence: confidenceFromScore(score, outcome),
    createdAt: now,
    updatedAt: now,
  }
}
