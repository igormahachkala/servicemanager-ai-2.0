import { useMemo } from 'react'
import { resolveMobileReportDetail, type MobileReportDetail } from '../reports/mobileReportsSnapshot'

export function useMobileReportDetail(reportId: string | undefined): MobileReportDetail | null {
  return useMemo(() => {
    if (!reportId) return null
    return resolveMobileReportDetail(decodeURIComponent(reportId))
  }, [reportId])
}
