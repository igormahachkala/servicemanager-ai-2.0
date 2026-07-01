import type { RuntimeResult } from '../runtime/runtimeResult'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { RuntimeWarning } from '../runtime/runtimeResult'
import type { Report } from '../reports/report'
import { DEFAULT_COMPANY_ID } from '../company/company'
import { loadReports, saveReports } from '../reports/reportStorage'
import { getActiveRuntimeProviderId } from '../runtime/providers/runtimeAdapter'
import type { OutputLanguage } from '../runtime/runtimeOutputPolicy'

export type ReportSeverity = 'critical' | 'high' | 'medium' | 'low'

export const REPORT_SEVERITIES: ReportSeverity[] = ['critical', 'high', 'medium', 'low']

export type RuntimeReportRisk = {
  severity: ReportSeverity
  message: string
}

export type RuntimeReportBody = {
  briefSummary: string
  checked: string[]
  found: string[]
  risks: RuntimeReportRisk[]
  recommendations: string[]
  nextStep: string
  ownerDecisionRequired: string | null
  formattedMarkdown: string
}

export const NO_CRITICAL_ISSUES_MESSAGE = 'Критических проблем не обнаружено.'

const SECTION_DIVIDER = '━━━━━━━━━━━━'

const SECTION_ALIASES: Record<keyof Omit<RuntimeReportBody, 'formattedMarkdown'>, RegExp[]> = {
  briefSummary: [/^краткий итог/im, /^summary/im, /^итог/im],
  checked: [/^что проверено/im, /^what i checked/im, /^что я проверил/im],
  found: [/^что найдено/im, /^что обнаружил/im, /^what i found/im, /^findings/im],
  risks: [/^риски/im, /^risks/im],
  recommendations: [/^рекомендации/im, /^что предлагаю/im, /^recommendations/im],
  nextStep: [/^следующий шаг/im, /^next step/im],
  ownerDecisionRequired: [
    /^требуется решение owner/im,
    /^требуется ли решение owner/im,
    /^owner decision/im,
  ],
}

const GENERIC_RESPONSE_PATTERNS = [
  /\bas an ai\b/i,
  /\bi(?:'m| am) (?:a |an )?(?:helpful )?(?:assistant|language model|llm)\b/i,
  /\bcertainly\b/i,
  /\bof course\b/i,
  /\bhappy to help\b/i,
  /\bбуду рад помочь/i,
  /\bконечно[,!]/i,
  /\bhere(?:'s| is) (?:a |my )?(?:summary|overview)\b/i,
  /\blet me know if\b/i,
  /\bfeel free to\b/i,
  /\bgeneric\b/i,
]

const SEVERITY_PATTERNS: Array<{ severity: ReportSeverity; pattern: RegExp }> = [
  { severity: 'critical', pattern: /^\[?\s*critical\s*\]?:?\s*/i },
  { severity: 'high', pattern: /^\[?\s*high\s*\]?:?\s*/i },
  { severity: 'medium', pattern: /^\[?\s*medium\s*\]?:?\s*/i },
  { severity: 'low', pattern: /^\[?\s*low\s*\]?:?\s*/i },
  { severity: 'critical', pattern: /^🔴\s*/ },
  { severity: 'high', pattern: /^🟠\s*/ },
  { severity: 'medium', pattern: /^🟡\s*/ },
  { severity: 'low', pattern: /^🟢\s*/ },
  { severity: 'critical', pattern: /^критич(?:еский|но)/i },
  { severity: 'high', pattern: /^высок(?:ий|ая)/i },
  { severity: 'medium', pattern: /^средн(?:ий|яя)/i },
  { severity: 'low', pattern: /^низк(?:ий|ая)/i },
]

export function buildRuntimeReportOutputInstructions(language: OutputLanguage = 'ru'): string {
  if (language === 'en') {
    return [
      'Required output format — Senior Engineer report (not a generic LLM reply):',
      SECTION_DIVIDER,
      'Brief summary',
      'What was checked',
      'What was found',
      'Risks — each line prefixed with Critical / High / Medium / Low',
      'Recommendations',
      'Next step',
      'Owner decision required',
      SECTION_DIVIDER,
      'If there are no critical issues, write exactly: «Критических проблем не обнаружено.» in Risks.',
      'Forbidden: filler phrases, “happy to help”, English headings when the task is in Russian.',
    ].join('\n')
  }

  return [
    'Обязательный формат ответа — отчёт Senior Engineer (не generic LLM):',
    SECTION_DIVIDER,
    'Краткий итог',
    'Что проверено',
    'Что найдено',
    'Риски — каждый пункт с severity: Critical / High / Medium / Low',
    'Рекомендации',
    'Следующий шаг',
    'Требуется решение Owner',
    SECTION_DIVIDER,
    'Если критических проблем нет — в секции «Риски» напиши: «Критических проблем не обнаружено.»',
    'Запрещено: «буду рад помочь», «конечно», Summary/Risks/Next Actions и прочие англоязычные заголовки без необходимости.',
  ].join('\n')
}

function stripListMarkers(line: string): string {
  return line.replace(/^[-*•\d.)]+\s*/, '').trim()
}

function parseSeverityLine(line: string): RuntimeReportRisk {
  for (const entry of SEVERITY_PATTERNS) {
    if (entry.pattern.test(line)) {
      return {
        severity: entry.severity,
        message: line.replace(entry.pattern, '').trim(),
      }
    }
  }
  return { severity: 'medium', message: line.trim() }
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => stripListMarkers(line.trim()))
    .filter(Boolean)
}

function detectSectionKey(line: string): keyof Omit<RuntimeReportBody, 'formattedMarkdown'> | null {
  const normalized = line.replace(/^#+\s*/, '').trim()
  for (const [key, patterns] of Object.entries(SECTION_ALIASES) as Array<
    [keyof Omit<RuntimeReportBody, 'formattedMarkdown'>, RegExp[]]
  >) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return key
    }
  }
  return null
}

function isGenericResponse(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  return GENERIC_RESPONSE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function hasCriticalRisk(risks: RuntimeReportRisk[]): boolean {
  return risks.some((item) => item.severity === 'critical' || item.severity === 'high')
}

function formatRiskLine(risk: RuntimeReportRisk): string {
  const label = risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)
  return `[${label}] ${risk.message}`
}

export function formatRuntimeReportMarkdown(body: Omit<RuntimeReportBody, 'formattedMarkdown'>): string {
  const riskLines =
    body.risks.length > 0
      ? body.risks.map(formatRiskLine)
      : [NO_CRITICAL_ISSUES_MESSAGE]

  return [
    SECTION_DIVIDER,
    'Краткий итог',
    body.briefSummary,
    '',
    'Что проверено',
    body.checked.length > 0 ? body.checked.map((item) => `- ${item}`).join('\n') : '- —',
    '',
    'Что найдено',
    body.found.length > 0 ? body.found.map((item) => `- ${item}`).join('\n') : '- —',
    '',
    'Риски',
    riskLines.map((item) => `- ${item}`).join('\n'),
    '',
    'Рекомендации',
    body.recommendations.length > 0
      ? body.recommendations.map((item) => `- ${item}`).join('\n')
      : '- —',
    '',
    'Следующий шаг',
    body.nextStep || '—',
    '',
    'Требуется решение Owner',
    body.ownerDecisionRequired ?? 'Нет',
    SECTION_DIVIDER,
  ].join('\n')
}

function parseStructuredResponse(responseText: string): Partial<RuntimeReportBody> {
  const lines = responseText.split(/\r?\n/)
  const sections: Partial<Record<keyof Omit<RuntimeReportBody, 'formattedMarkdown'>, string[]>> = {}
  let current: keyof Omit<RuntimeReportBody, 'formattedMarkdown'> | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line === SECTION_DIVIDER) continue

    const sectionKey = detectSectionKey(line)
    if (sectionKey) {
      current = sectionKey
      sections[current] = sections[current] ?? []
      const inline = line.replace(/^#+\s*/, '').replace(/^.+?:\s*/, '').trim()
      if (inline && !SECTION_ALIASES[sectionKey].some((pattern) => pattern.test(inline))) {
        sections[current]!.push(inline)
      }
      continue
    }

    if (current) {
      sections[current]!.push(stripListMarkers(line))
    }
  }

  const briefSummary = (sections.briefSummary ?? []).join(' ').trim()
  const checked = sections.checked ?? []
  const found = sections.found ?? []
  const recommendations = sections.recommendations ?? []
  const nextStep = (sections.nextStep ?? []).join(' ').trim()
  const ownerDecisionRequired = (sections.ownerDecisionRequired ?? []).join(' ').trim() || null
  const risks = (sections.risks ?? []).map(parseSeverityLine)

  return {
    briefSummary,
    checked,
    found,
    risks,
    recommendations,
    nextStep,
    ownerDecisionRequired,
  }
}

function buildFallbackBody(input: {
  employeeCodename: string
  result: RuntimeResult
  warnings: RuntimeWarning[]
  responseText: string
}): RuntimeReportBody {
  const { employeeCodename, result, warnings, responseText } = input
  const runtimeWarnings = warnings
    .filter((item) => item.severity === 'warn' || item.severity === 'error')
    .map((item) => parseSeverityLine(item.message))

  const responseLines = splitLines(responseText)
  const found = responseLines.filter((line) => line.length > 12).slice(0, 8)

  const body: Omit<RuntimeReportBody, 'formattedMarkdown'> = {
    briefSummary: `${employeeCodename} завершил runtime run через ${result.selectedModel}. Ответ модели не соответствует формату отчёта — см. «Что найдено».`,
    checked: [
      `Runtime pipeline (${result.contextSize} context layers)`,
      `Knowledge: ${result.knowledgeUsed} items`,
      `Memory: ${result.memoryUsed} entries`,
      `Provider: ${getActiveRuntimeProviderId()}`,
    ],
    found:
      found.length > 0
        ? found
        : responseText.trim()
          ? [responseText.trim().slice(0, 500)]
          : ['Модель не вернула структурированный текст ответа.'],
    risks: runtimeWarnings,
    recommendations: ['Повторить run с явной задачей и проверить Prompt Preview перед execution.'],
    nextStep: 'Owner: открыть Prompt Preview и Run History, затем повторить задачу с тем же scope.',
    ownerDecisionRequired: 'Да — подтвердить повторный run или принять текущий draft report.',
  }

  if (!hasCriticalRisk(body.risks)) {
    body.risks = [{ severity: 'low', message: NO_CRITICAL_ISSUES_MESSAGE }]
  }

  return { ...body, formattedMarkdown: formatRuntimeReportMarkdown(body) }
}

export function buildRuntimeReportBody(input: {
  employeeCodename: string
  result: RuntimeResult
  warnings?: RuntimeWarning[]
}): RuntimeReportBody {
  const responseText = input.result.responseText?.trim() ?? ''
  const warnings = input.warnings ?? input.result.warnings ?? []

  if (!responseText || isGenericResponse(responseText)) {
    return buildFallbackBody({
      employeeCodename: input.employeeCodename,
      result: input.result,
      warnings,
      responseText,
    })
  }

  const parsed = parseStructuredResponse(responseText)
  const risks = parsed.risks ?? []
  const runtimeWarnings = warnings
    .filter((item) => item.severity === 'warn' || item.severity === 'error')
    .map((item) => parseSeverityLine(item.message))

  for (const warning of runtimeWarnings) {
    if (!risks.some((item) => item.message === warning.message)) {
      risks.push(warning)
    }
  }

  if (!hasCriticalRisk(risks) && risks.length === 0) {
    risks.push({ severity: 'low', message: NO_CRITICAL_ISSUES_MESSAGE })
  } else if (!hasCriticalRisk(risks) && !risks.some((item) => item.message === NO_CRITICAL_ISSUES_MESSAGE)) {
    risks.unshift({ severity: 'low', message: NO_CRITICAL_ISSUES_MESSAGE })
  }

  const body: Omit<RuntimeReportBody, 'formattedMarkdown'> = {
    briefSummary:
      parsed.briefSummary?.trim() ||
      responseText.split(/\r?\n/).find((line) => line.trim())?.trim() ||
      `${input.employeeCodename} подготовил runtime report.`,
    checked:
      parsed.checked && parsed.checked.length > 0
        ? parsed.checked
        : [`Runtime context: ${input.result.contextSize} layers`, `Model: ${input.result.selectedModel}`],
    found:
      parsed.found && parsed.found.length > 0
        ? parsed.found
        : splitLines(responseText).slice(0, 6),
    risks,
    recommendations:
      parsed.recommendations && parsed.recommendations.length > 0
        ? parsed.recommendations
        : ['Проверить draft report и опубликовать после review Owner.'],
    nextStep: parsed.nextStep?.trim() || 'Согласовать следующий шаг с Owner.',
    ownerDecisionRequired: parsed.ownerDecisionRequired?.trim() || 'Нет',
  }

  return { ...body, formattedMarkdown: formatRuntimeReportMarkdown(body) }
}

export function buildRuntimeReportFromRun(input: {
  run: RuntimeRun
  result: RuntimeResult
  employeeCodename: string
}): Report {
  const now = new Date().toISOString()
  const runtimeBody = buildRuntimeReportBody({
    employeeCodename: input.employeeCodename,
    result: input.result,
    warnings: input.result.warnings,
  })

  const report: Report = {
    id: `report-run-${input.run.id}`,
    companyId: DEFAULT_COMPANY_ID,
    title: `Отчёт · ${input.employeeCodename} · ${new Date(now).toLocaleDateString('ru-RU')}`,
    type: 'system',
    employeeId: input.run.employeeId,
    workspaceId: input.run.workspaceId,
    summary: runtimeBody.briefSummary,
    findings: runtimeBody.found,
    risks: runtimeBody.risks.map(formatRiskLine),
    recommendations: runtimeBody.recommendations,
    evidence: [
      {
        id: `ev-run-${input.run.id}`,
        label: 'Runtime run',
        kind: 'artifact',
        value: input.run.id,
      },
      {
        id: `ev-report-md-${input.run.id}`,
        label: 'Formatted report',
        kind: 'quote',
        value: runtimeBody.formattedMarkdown.slice(0, 240),
      },
    ],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    runtimeBody: {
      ...runtimeBody,
      checked: runtimeBody.checked,
    },
  }

  saveReports([report, ...loadReports()])
  return report
}
