import { Link } from 'react-router-dom'
import { listEmployeeDailyJournalEntries } from '../../domain/employeeDailyJournal'
import { MOBILE_MORNING_REPORT_ID } from '../reports/mobileReportsSnapshot'
import { buildMobileReportsSnapshot } from '../reports/mobileReportsSnapshot'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'
import { MobileCard } from './MobileCard'
import { MobileReportCard } from './MobileReportCard'

export type MobileEmployeeScopedReportsCopy = {
  description: string
  empty: string
  openAllReports: string
  openHistory: string
}

type Props = {
  employeeId: string
  copy: MobileEmployeeScopedReportsCopy
}

export function MobileEmployeeScopedReportsCard({ employeeId, copy }: Props) {
  const reportItems = buildMobileReportsSnapshot().items.filter(
    (item) => item.employeeId === employeeId && item.id !== MOBILE_MORNING_REPORT_ID,
  )
  const journalCount = listEmployeeDailyJournalEntries({ employeeId }).length

  if (reportItems.length === 0 && journalCount === 0) {
    return (
      <MobileCard title={copy.openAllReports} description={copy.description}>
        <p className="acMobileOwnerHomeMuted">{copy.empty}</p>
        <div className="acMobileCardActions">
          <Link to={MOBILE_PATHS.reports} className="acMobileSecondaryBtn">
            {copy.openAllReports}
          </Link>
          <Link to={MOBILE_PATHS.tasksHistory} className="acMobileTertiaryLinkBtn">
            {copy.openHistory}
          </Link>
        </div>
      </MobileCard>
    )
  }

  return (
    <MobileCard title={copy.openAllReports} description={copy.description}>
      <div className="acMobileReportsList">
        {reportItems.slice(0, 3).map((item) => (
          <MobileReportCard key={item.id} item={item} />
        ))}
      </div>
      <div className="acMobileCardActions">
        <Link to={MOBILE_PATHS.reports} className="acMobileSecondaryBtn">
          {copy.openAllReports}
        </Link>
        <Link to={MOBILE_PATHS.tasksHistory} className="acMobileTertiaryLinkBtn">
          {copy.openHistory}
        </Link>
      </div>
    </MobileCard>
  )
}
