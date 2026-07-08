import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MobileCompanyStatusCard } from '../components/MobileCompanyStatusCard'
import { MobileEmployeeResultCard } from '../components/MobileEmployeeResultCard'
import { MobileNextActionCard } from '../components/MobileNextActionCard'
import { MobileOwnerDecisionCard } from '../components/MobileOwnerDecisionCard'
import { MobileSection } from '../components/MobileSection'
import { useMobileOwnerHome } from '../hooks/useMobileOwnerHome'

export function MobileTodayPage() {
  const { t } = useI18n()
  const {
    snapshot,
    nextAction,
    quickActions,
    employeeResults,
    decisionItems,
    isEmpty,
    refresh,
  } = useMobileOwnerHome()

  const maxLaunchHref = '/mobile/tasks/new?employee=ag-max'

  return (
    <div className="acMobileOwnerHome">
      <div className="acMobileOwnerHomeIntro">
        <p className="acMobileOwnerHomeQuestion">{t.mobile.ownerHome.heroQuestion}</p>
        <button type="button" className="acMobileRefreshBtn" onClick={refresh}>
          {t.mobile.ownerHome.refresh}
        </button>
      </div>

      <MobileCompanyStatusCard status={snapshot.companyStatus} />

      <MobileNextActionCard action={nextAction} />

      {isEmpty ? (
        <section className="acMobileOwnerHomeEmpty" aria-label={t.mobile.ownerHome.empty.title}>
          <div className="acMobileOwnerHomeEmptyIcon" aria-hidden>
            <svg viewBox="0 0 48 48" className="acMobileEmptyStateSvg">
              <circle cx="24" cy="18" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path
                d="M10 40c0-7 6-12 14-12s14 5 14 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="acMobileOwnerHomeEmptyTitle">{t.mobile.ownerHome.empty.title}</h2>
          <p className="acMobileOwnerHomeEmptyDescription">{t.mobile.ownerHome.empty.description}</p>
          <Link to={maxLaunchHref} className="acMobileOwnerHomeEmptyCta">
            {t.mobile.ownerHome.empty.action}
          </Link>
        </section>
      ) : null}

      <MobileSection
        title={t.mobile.ownerHome.sections.employeeResults}
        description={t.mobile.ownerHome.sections.employeeResultsHint}
      >
        <div id="employee-results" className="acMobileOwnerHomeStack">
          {employeeResults.length === 0 ? (
            <p className="acMobileOwnerHomeMuted">{t.ownerHome.empty.completedTasks}</p>
          ) : (
            employeeResults.map((task) => (
              <MobileEmployeeResultCard key={task.id} task={task} />
            ))
          )}
        </div>
      </MobileSection>

      <MobileSection
        title={t.mobile.ownerHome.sections.decisions}
        description={t.mobile.ownerHome.sections.decisionsHint}
        action={
          decisionItems.length > 0 ? (
            <Link to="/mobile/decisions" className="acMobileSectionLink">
              {t.mobile.section.defaultAction}
            </Link>
          ) : null
        }
      >
        <div className="acMobileOwnerHomeStack">
          {decisionItems.length === 0 ? (
            <p className="acMobileOwnerHomeMuted">{t.ownerHome.empty.decisions}</p>
          ) : (
            decisionItems.map((item) => (
              <MobileOwnerDecisionCard key={item.id} item={item} />
            ))
          )}
        </div>
      </MobileSection>

      <MobileSection title={t.mobile.ownerHome.sections.quickActions}>
        <div className="acMobileQuickActions">
          {quickActions.map((action) => (
            <Link key={action.id} to={action.href} className="acMobileQuickActionBtn">
              {action.label}
            </Link>
          ))}
        </div>
      </MobileSection>

      <p className="acMobileOwnerHomeNote">{t.mobile.ownerHome.localNote}</p>
    </div>
  )
}
