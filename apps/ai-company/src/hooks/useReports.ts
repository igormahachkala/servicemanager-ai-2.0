import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ensureSeedReports,
  filterReports,
  getReportById,
  loadReports,
  searchReports,
  type Report,
  type ReportFilter,
} from '../domain/reports/reportStorage'

export function useReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ReportFilter>({
    type: 'all',
    status: 'all',
    employeeId: 'all',
  })

  const refresh = useCallback(() => {
    ensureSeedReports()
    setReports(
      loadReports().sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    )
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-reports') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const filtered = useMemo(() => {
    const searched = searchReports(reports, query)
    return filterReports(searched, filter)
  }, [reports, query, filter])

  const getById = useCallback((id: string) => getReportById(id), [])

  const stats = useMemo(
    () => ({
      total: reports.length,
      published: reports.filter((r) => r.status === 'published').length,
      reviewed: reports.filter((r) => r.status === 'reviewed').length,
      draft: reports.filter((r) => r.status === 'draft').length,
    }),
    [reports],
  )

  return { reports, filtered, stats, query, setQuery, filter, setFilter, getById, refresh }
}
