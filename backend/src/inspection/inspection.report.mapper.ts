import { InspectionRunItemStatus } from '@prisma/client'

export function buildInspectionRunSummary(
  items: Array<{ status: InspectionRunItemStatus; requiresRepair: boolean; ticketId: string | null }>,
) {
  return {
    totalItems: items.length,
    okCount: items.filter((item) => item.status === InspectionRunItemStatus.OK).length,
    issueCount: items.filter((item) => item.status === InspectionRunItemStatus.ISSUE).length,
    criticalCount: items.filter((item) => item.status === InspectionRunItemStatus.CRITICAL).length,
    skippedCount: items.filter((item) => item.status === InspectionRunItemStatus.SKIPPED).length,
    repairRequiredCount: items.filter((item) => item.requiresRepair).length,
    createdTicketsCount: items.filter((item) => !!item.ticketId).length,
  }
}

export function buildInspectionReportNumber(runCreatedAt: Date, runId: string) {
  const date = new Date(runCreatedAt)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const shortId = runId.replace(/-/g, '').slice(0, 6).toUpperCase()
  return 'ACT-' + year + month + '-' + shortId
}

export function buildInspectionDocumentDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}
