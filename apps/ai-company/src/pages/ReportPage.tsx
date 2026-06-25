import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import { ReportHeader } from '../components/reports/ReportHeader'
import { ReportSummary } from '../components/reports/ReportSummary'
import { ReportEvidence } from '../components/reports/ReportEvidence'
import { ReportRisks } from '../components/reports/ReportRisks'
import { ReportActions } from '../components/reports/ReportActions'
import { useReports } from '../hooks/useReports'
import { useI18n } from '../i18n'

export function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { getById } = useReports()

  const report = useMemo(() => (id ? getById(id) : null), [getById, id])

  if (!report) {
    return (
      <>
        <PageHeader title={t.reports.notFoundTitle} description={t.reports.notFoundDescription} />
        <div className="mcReportEmpty">
          <div className="mcReportEmptyTitle">{t.reports.notFoundTitle}</div>
          <p className="mcReportEmptyDesc">{t.reports.notFoundDescription}</p>
          <Link to="/ops/reports" className="mcBtn mcBtnPrimary">
            {t.reports.backToList}
          </Link>
        </div>
      </>
    )
  }

  return (
    <div className="mcReportPage">
      <Link to="/ops/reports" className="mcProfileBack">
        ← {t.reports.backToList}
      </Link>
      <ReportHeader report={report} />
      <div className="mcStack">
        <ReportSummary report={report} />
        <div className="mcProfileGrid">
          <ReportRisks report={report} />
          <ReportActions report={report} />
        </div>
        <ReportEvidence report={report} />
      </div>
      <p className="mcMemoryLocalNote">{t.reports.localOnly}</p>
    </div>
  )
}
