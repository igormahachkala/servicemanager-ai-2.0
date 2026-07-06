import type { RuntimeReportBody } from '../runtimeReport/runtimeReportQuality'
import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { MaxWorkerLoopRecord } from './maxWorkerLoop'

/** MAX-specific report envelope over Runtime Report. */
export type MaxWorkerLoopReport = {
  loopId: string
  reportId: string
  runtimeRunId: string
  employeeId: string
  title: string
  summary: string
  body: RuntimeReportBody | null
  findings: string[]
  risks: string[]
  recommendations: string[]
  nextStep: string | null
  ownerDecisionRequired: string | null
  createdAt: string
}

export function buildMaxWorkerLoopReport(
  loop: Pick<MaxWorkerLoopRecord, 'id' | 'employeeId'>,
  run: RuntimeRun,
  report: Report,
): MaxWorkerLoopReport {
  const body = report.runtimeBody ?? null

  return {
    loopId: loop.id,
    reportId: report.id,
    runtimeRunId: run.id,
    employeeId: loop.employeeId,
    title: report.title,
    summary: report.summary,
    body,
    findings: report.findings,
    risks: report.risks,
    recommendations: report.recommendations,
    nextStep: body?.nextStep ?? null,
    ownerDecisionRequired: body?.ownerDecisionRequired ?? null,
    createdAt: report.createdAt,
  }
}
