/**
 * Mobile Report Owner View (109C) — presentation layer only.
 * Maps real report snapshots to Owner-friendly sections; data model unchanged.
 */

import { NO_CRITICAL_ISSUES_MESSAGE } from '../../domain/runtimeReport/runtimeReportQuality'
import { getModelById } from '../../domain/runtime/modelProvider'
import { getRuntimeRunById } from '../../domain/runtime/runtimeOrchestrator'
import { loadMaxWorkerLoopRecords } from '../../domain/maxWorkerLoop'
import { MOBILE_PATHS, resolveMobileHref } from '../navigation/mobileHrefResolver'
import type { MobileReportDetail, MobileReportLink, MobileReportStatusTone } from './mobileReportsSnapshot'

export type MobileReportOwnerStatusKey =
  | 'ready'
  | 'inReview'
  | 'completed'
  | 'archived'
  | 'active'
  | 'idle'

export type MobileReportOwnerNextStep = {
  headline: string
  href: string
  finishGoldenPath: boolean
}

export type MobileReportOwnerTechnical = {
  reportKind: string | null
  reportStatus: string | null
  models: string[]
  tools: string[]
  consultations: string[]
  runtimeRunId: string | null
  workerLoopId: string | null
  rawReport: string | null
  links: MobileReportLink[]
}

export type MobileReportOwnerView = {
  taskTitle: string
  employeeLabel: string
  statusKey: MobileReportOwnerStatusKey
  statusTone: MobileReportStatusTone
  dateLabel: string
  briefSummary: string
  checked: string[]
  findings: string[]
  risks: string[]
  recommendations: string[]
  ownerDecisionRequired: string | null
  nextStep: MobileReportOwnerNextStep
  technical: MobileReportOwnerTechnical
}

function uniqueNonEmpty(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of items) {
    const value = raw.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function lineHeadlines(
  lines: Array<{ headline: string; detail?: string | null }>,
  includeDetail = false,
): string[] {
  return uniqueNonEmpty(
    lines.flatMap((line) => {
      const headline = line.headline.trim()
      if (!includeDetail || !line.detail?.trim()) return [headline]
      return [`${headline} — ${line.detail.trim()}`]
    }),
  )
}

function mapOwnerStatusKey(status: string): MobileReportOwnerStatusKey {
  switch (status) {
    case 'draft':
      return 'inReview'
    case 'published':
    case 'ready':
      return 'ready'
    case 'reviewed':
    case 'completed':
    case 'finished':
      return 'completed'
    case 'archived':
      return 'archived'
    case 'active':
      return 'active'
    case 'idle':
      return 'idle'
    default:
      return 'ready'
  }
}

function stripRiskSeverityPrefix(text: string): string {
  return text
    .replace(/^\[(critical|high|medium|low|критич(?:еский|но)|высок(?:ий|ая)|средн(?:ий|яя)|низк(?:ий|ая))\]\s*/i, '')
    .replace(/^(critical|high|medium|low):\s*/i, '')
    .trim()
}

function isNoIssuesRisk(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return (
    normalized.includes(NO_CRITICAL_ISSUES_MESSAGE.toLowerCase()) ||
    normalized.includes('no critical issues') ||
    normalized.includes('критических проблем не обнаружено')
  )
}

function formatOwnerRisks(detail: MobileReportDetail): string[] {
  const body = detail.runtimeReport?.runtimeBody
  if (body?.risks.length) {
    return uniqueNonEmpty(
      body.risks
        .map((item) => stripRiskSeverityPrefix(item.message))
        .filter((item) => item.length > 0 && !isNoIssuesRisk(item)),
    )
  }
  return uniqueNonEmpty(
    detail.risks.map(stripRiskSeverityPrefix).filter((item) => item.length > 0 && !isNoIssuesRisk(item)),
  )
}

function resolveModelLabels(runtimeRunId: string | null, fallback: string[]): string[] {
  if (runtimeRunId) {
    const run = getRuntimeRunById(runtimeRunId)
    if (run) {
      const model = getModelById(run.modelId)
      const label = model?.name ?? run.modelId
      return uniqueNonEmpty([label, ...fallback])
    }
  }
  return uniqueNonEmpty(fallback)
}

function resolveLoopForReport(reportId: string | undefined) {
  if (!reportId) return null
  return loadMaxWorkerLoopRecords().find((item) => item.reportId === reportId) ?? null
}

function resolveNextStep(
  detail: MobileReportDetail,
  defaultLabel: string,
): MobileReportOwnerNextStep {
  const body = detail.runtimeReport?.runtimeBody

  if (body?.ownerDecisionRequired?.trim()) {
    return {
      headline: body.ownerDecisionRequired.trim(),
      href: MOBILE_PATHS.decisions,
      finishGoldenPath: false,
    }
  }

  if (body?.nextStep?.trim()) {
    return {
      headline: body.nextStep.trim(),
      href: MOBILE_PATHS.max,
      finishGoldenPath: false,
    }
  }

  const morningNext = detail.morningSnapshot?.nextStep
  if (morningNext?.headline.trim()) {
    return {
      headline: morningNext.headline.trim(),
      href: morningNext.href ? resolveMobileHref(morningNext.href) : MOBILE_PATHS.today,
      finishGoldenPath: morningNext.href == null,
    }
  }

  const recommendation = detail.recommendations.find((item) => item.trim().length > 0)?.trim()
  if (recommendation) {
    return {
      headline: recommendation,
      href: MOBILE_PATHS.today,
      finishGoldenPath: true,
    }
  }

  return {
    headline: defaultLabel,
    href: MOBILE_PATHS.today,
    finishGoldenPath: true,
  }
}

function buildChecked(detail: MobileReportDetail): string[] {
  const body = detail.runtimeReport?.runtimeBody
  if (body?.checked.length) return uniqueNonEmpty(body.checked)

  if (detail.morningSnapshot) {
    const snapshot = detail.morningSnapshot
    return uniqueNonEmpty([
      ...lineHeadlines(snapshot.whatMaxDid),
      ...lineHeadlines(snapshot.whatMaxChecked),
      ...lineHeadlines(snapshot.completedTasks),
    ])
  }

  if (detail.operatingDaySummary) {
    return uniqueNonEmpty(detail.operatingDaySummary.tasksCompleted.map((item) => item.title))
  }

  if (detail.journalEntry) {
    const entry = detail.journalEntry
    return uniqueNonEmpty([entry.workSummary, entry.taskText, entry.resultSummary])
  }

  return uniqueNonEmpty(detail.toolsUsed)
}

function buildFindings(detail: MobileReportDetail): string[] {
  const body = detail.runtimeReport?.runtimeBody
  if (body?.found.length) return uniqueNonEmpty(body.found)

  if (detail.morningSnapshot) {
    return lineHeadlines(detail.morningSnapshot.whatDiscovered, true)
  }

  if (detail.journalEntry) {
    return lineHeadlines(
      detail.journalEntry.decisions.map((item) => ({
        headline: item.summary,
        detail: item.rationale,
      })),
      true,
    )
  }

  if (detail.kind === 'operating_day_summary') {
    return uniqueNonEmpty(
      detail.operatingDaySummary?.tasksCompleted.map((item) => item.title) ?? detail.findings,
    )
  }

  return uniqueNonEmpty(detail.findings)
}

function buildRecommendations(detail: MobileReportDetail): string[] {
  const body = detail.runtimeReport?.runtimeBody
  if (body?.recommendations.length) return uniqueNonEmpty(body.recommendations)

  if (detail.morningSnapshot) {
    return lineHeadlines(detail.morningSnapshot.employeeRecommendations, true)
  }

  if (detail.operatingDaySummary) {
    return uniqueNonEmpty(detail.operatingDaySummary.nextDayRecommendations)
  }

  return uniqueNonEmpty(detail.recommendations)
}

function buildBriefSummary(detail: MobileReportDetail): string {
  const body = detail.runtimeReport?.runtimeBody
  if (body?.briefSummary?.trim()) return body.briefSummary.trim()

  if (detail.morningSnapshot?.summary.trim()) return detail.morningSnapshot.summary.trim()

  if (detail.journalEntry) {
    const entry = detail.journalEntry
    return (entry.resultSummary || entry.workSummary || detail.summary).trim()
  }

  return detail.summary.trim()
}

function buildRawReport(detail: MobileReportDetail): string | null {
  const body = detail.runtimeReport?.runtimeBody
  if (body?.formattedMarkdown?.trim()) return body.formattedMarkdown.trim()

  const chunks = uniqueNonEmpty([
    detail.summary,
    ...detail.findings,
    ...detail.risks,
    ...detail.recommendations,
  ])
  return chunks.length > 0 ? chunks.join('\n\n') : null
}

function buildTechnical(detail: MobileReportDetail): MobileReportOwnerTechnical {
  const report = detail.runtimeReport
  const loop = report ? resolveLoopForReport(report.id) : null
  const journal = detail.journalEntry
  const runtimeRunId = loop?.runtimeRunId ?? journal?.runtimeRunId ?? null
  const workerLoopId = loop?.id ?? journal?.maxWorkerLoopId ?? null

  return {
    reportKind: detail.kind,
    reportStatus: detail.status,
    models: resolveModelLabels(runtimeRunId, detail.modelsUsed),
    tools: uniqueNonEmpty(detail.toolsUsed),
    consultations: uniqueNonEmpty(detail.consultations),
    runtimeRunId,
    workerLoopId,
    rawReport: buildRawReport(detail),
    links: detail.links,
  }
}

export function buildMobileReportOwnerView(
  detail: MobileReportDetail,
  options: { defaultNextStepLabel: string },
): MobileReportOwnerView {
  const body = detail.runtimeReport?.runtimeBody
  const taskTitle =
    detail.taskTitle?.trim() ||
    detail.title.trim() ||
    options.defaultNextStepLabel

  return {
    taskTitle,
    employeeLabel: detail.employeeLabel,
    statusKey: mapOwnerStatusKey(detail.status),
    statusTone: detail.statusTone,
    dateLabel: detail.dateLabel,
    briefSummary: buildBriefSummary(detail),
    checked: buildChecked(detail),
    findings: buildFindings(detail),
    risks: formatOwnerRisks(detail),
    recommendations: buildRecommendations(detail),
    ownerDecisionRequired: body?.ownerDecisionRequired?.trim() || null,
    nextStep: resolveNextStep(detail, options.defaultNextStepLabel),
    technical: buildTechnical(detail),
  }
}
