import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MobileReportCard } from '../components/MobileReportCard'
import { MobileReportSummaryCard } from '../components/MobileReportSummaryCard'
import { useMobileReports } from '../hooks/useMobileReports'
import { MOBILE_MORNING_REPORT_ID } from '../reports/mobileReportsSnapshot'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export function MobileReportsPage() {
  const { t } = useI18n()
  const copy = t.mobile.reports
  const { snapshot, isEmpty } = useMobileReports()

  const listItems = snapshot.items.filter((item) => item.id !== MOBILE_MORNING_REPORT_ID)

  if (isEmpty) {
    return (
      <div className="acMobilePage acMobileReportsPage">
        <p className="acMobilePageIntro acMobileReportsIntro">{copy.intro}</p>
        <div className="acMobileReportsHistoryEntry">
          <Link to={MOBILE_PATHS.tasksHistory} className="acMobileSecondaryBtn">
            {copy.actions.openHistoryByType}
          </Link>
        </div>
        <div data-mobile-guide="reports-morning" className="acMobileGuideReportsPlaceholder">
          <p className="acMobileOwnerHomeMuted">{copy.guideMorningPlaceholder}</p>
        </div>
        <div data-mobile-guide="reports-list" className="acMobileReportsEmpty">
          <h2 className="acMobileReportsEmptyTitle">{copy.empty.title}</h2>
          <p className="acMobileReportsEmptyDescription">{copy.empty.description}</p>
          <Link
            to={MOBILE_PATHS.tasksNewMax}
            className="acMobilePrimaryBtn acMobileReportsEmptyCta"
          >
            {copy.empty.action}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="acMobilePage acMobileReportsPage">
      <p className="acMobilePageIntro acMobileReportsIntro">{copy.intro}</p>

      <div className="acMobileReportsHistoryEntry">
        <Link to={MOBILE_PATHS.tasksHistory} className="acMobileSecondaryBtn">
          {copy.actions.openHistoryByType}
        </Link>
      </div>

      {snapshot.morningReport ? (
        <div data-mobile-guide="reports-morning">
          <MobileReportSummaryCard snapshot={snapshot.morningReport} />
        </div>
      ) : (
        <div data-mobile-guide="reports-morning" className="acMobileGuideReportsPlaceholder">
          <p className="acMobileOwnerHomeMuted">{copy.guideMorningPlaceholder}</p>
        </div>
      )}

      {listItems.length > 0 ? (
        <section
          className="acMobileReportsListSection"
          aria-label={copy.listSection}
          data-mobile-guide="reports-list"
        >
          <h2 className="acMobileReportsListHeading">{copy.listSection}</h2>
          <div className="acMobileReportsList">
            {listItems.map((item) => (
              <MobileReportCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : (
        <div data-mobile-guide="reports-list" className="acMobileGuideReportsPlaceholder">
          <p className="acMobileOwnerHomeMuted">{copy.guideListPlaceholder}</p>
        </div>
      )}
    </div>
  )
}
