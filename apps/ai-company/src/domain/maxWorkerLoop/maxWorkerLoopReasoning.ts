import type { RuntimeReportBody } from '../runtimeReport/runtimeReportQuality'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { Report } from '../reports/report'

/** Structured output of MAX reasoning step (Ollama → parse). */
export type MaxWorkerLoopReasoningResult = {
  /** Raw model response (read-only, no tool side effects). */
  reasoningText: string
  /** What MAX understood from the Owner task. */
  analysis: string
  /** Ordered execution plan (reasoning-only in V1). */
  plan: string[]
  /** Whether a tool would be needed — V1 safe mode keeps this false. */
  toolNeeded: boolean
  toolNeededReason: string | null
  modelId: string | null
  providerId: string | null
  ollamaModelTag: string | null
  durationMs: number | null
}

function firstNonEmpty(lines: string[]): string {
  return lines.find((line) => line.trim().length > 0)?.trim() ?? ''
}

function extractPlanLines(body: RuntimeReportBody | null | undefined, fallbackText: string): string[] {
  const fromRecommendations = (body?.recommendations ?? []).filter((item) => item.trim().length > 0)
  if (fromRecommendations.length > 0) return fromRecommendations

  const planSection = fallbackText
    .split(/\r?\n/)
    .filter((line) => /^(план|plan|шаг|step|\d+[.)])/i.test(line.trim()))
    .map((line) => line.replace(/^[-*•\d.)]+\s*/, '').trim())
    .filter(Boolean)

  if (planSection.length > 0) return planSection

  const nextStep = body?.nextStep?.trim()
  return nextStep ? [nextStep] : []
}

/** Build reasoning snapshot from a completed runtime run — pure, no side effects. */
export function buildMaxWorkerLoopReasoningResult(
  run: RuntimeRun,
  report: Report,
): MaxWorkerLoopReasoningResult {
  const body = report.runtimeBody ?? null
  const responseText = run.result?.responseText?.trim() ?? ''
  const analysis =
    body?.briefSummary?.trim() ||
    report.summary?.trim() ||
    firstNonEmpty((body?.found ?? []).concat(report.findings)) ||
    'Анализ будет доступен после завершения reasoning.'

  const plan = extractPlanLines(body, responseText)

  return {
    reasoningText: responseText,
    analysis,
    plan,
    toolNeeded: false,
    toolNeededReason: null,
    modelId: run.modelId,
    providerId: run.providerId,
    ollamaModelTag: run.result?.resolvedOllamaTag ?? run.result?.ollamaModelTag ?? null,
    durationMs: run.result?.executionDurationMs ?? null,
  }
}
