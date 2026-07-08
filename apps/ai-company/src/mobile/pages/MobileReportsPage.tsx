import { Link } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { useI18n } from '../../i18n'
import { MobileReportCard } from '../components/MobileReportCard'
import { MobileReportSummaryCard } from '../components/MobileReportSummaryCard'
import { useMobileReports } from '../hooks/useMobileReports'
import { MOBILE_MORNING_REPORT_ID } from '../reports/mobileReportsSnapshot'

export function MobileReportsPage() {
  const { t } = useI18n()
  const copy = t.mobile.reports
  const { snapshot, isEmpty } = useMobileReports()

  const listItems = snapshot.items.filter((item) => item.id !== MOBILE_MORNING_REPORT_ID)

  if (isEmpty) {
    return (
      <div className="acMobileReportsPage">
        <p className="acMobileReportsIntro">{copy.intro}</p>
        <div className="acMobileReportsEmpty">
          <h2 className="acMobileReportsEmptyTitle">{copy.empty.title}</h2>
          <p className="acMobileReportsEmptyDescription">{copy.empty.description}</p>
          <Link
            to={`/mobile/tasks/new?employee=${MAX_WORKER_EMPLOYEE_ID}`}
            className="acMobilePrimaryBtn acMobileReportsEmptyCta"
          >
            {copy.empty.action}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="acMobileReportsPage">
      <p className="acMobileReportsIntro">{copy.intro}</p>

      {snapshot.morningReport ? (
        <MobileReportSummaryCard snapshot={snapshot.morningReport} />
      ) : null}

      {listItems.length > 0 ? (
        <section className="acMobileReportsListSection" aria-label={copy.listSection}>
          <h2 className="acMobileReportsListHeading">{copy.listSection}</h2>
          <div className="acMobileReportsList">
            {listItems.map((item) => (
              <MobileReportCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
