import { Link } from 'react-router-dom'
import { ThemeSwitch } from '../../components/theme/ThemeSwitch'
import { useI18n } from '../../i18n'
import { MobileCard } from '../components/MobileCard'
import { MobileEmptyState } from '../components/MobileEmptyState'
import { MobileSection } from '../components/MobileSection'
import { useMobileFirstLaunchGuide } from '../hooks/useMobileFirstLaunchGuide'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export function MobileTasksPage() {
  const { t } = useI18n()

  return (
    <div className="acMobilePage">
      <MobileSection title={t.mobile.pages.tasks} description={t.ownerNav.groups.tasks.hint}>
        <Link to={MOBILE_PATHS.tasksNew} className="acMobilePrimaryBtn acMobileTasksNewBtn">
          {t.mobile.fab.assignTask}
        </Link>
        <MobileEmptyState variant="noTasks" actionHref={MOBILE_PATHS.tasksNew} />
      </MobileSection>
    </div>
  )
}

export function MobileMorePage() {
  const { t } = useI18n()
  const copy = t.mobile.more
  const guideCopy = t.mobile.firstLaunchGuide.more
  const { startGuide } = useMobileFirstLaunchGuide()

  const links = [
    {
      id: 'reports',
      title: copy.links.reports,
      description: copy.links.reportsHint,
      to: MOBILE_PATHS.reports,
    },
    {
      id: 'morning-report',
      title: copy.links.morningReport,
      description: copy.links.morningReportHint,
      to: MOBILE_PATHS.morningReport,
    },
    {
      id: 'runtime',
      title: copy.links.runtime,
      description: copy.links.runtimeHint,
      to: MOBILE_PATHS.runtime,
    },
    {
      id: 'history',
      title: copy.links.history,
      description: copy.links.historyHint,
      to: MOBILE_PATHS.tasksHistory,
    },
    {
      id: 'demo',
      title: copy.links.demo,
      description: copy.links.demoHint,
      to: MOBILE_PATHS.demo,
    },
    {
      id: 'max',
      title: copy.links.max,
      description: copy.links.maxHint,
      to: MOBILE_PATHS.max,
    },
    {
      id: 'desktop',
      title: copy.links.desktop,
      description: copy.links.desktopHint,
      to: MOBILE_PATHS.ops,
    },
  ]

  return (
    <div className="acMobilePage">
      <MobileSection title={t.mobile.pages.more} description={copy.sectionHint}>
        <nav className="acMobileMoreLinks" aria-label={copy.navAria}>
          {links.map((item) => (
            <Link key={item.id} to={item.to} className="acMobileMoreLink">
              <span className="acMobileMoreLinkText">
                <span className="acMobileMoreLinkTitle">{item.title}</span>
                <span className="acMobileMoreLinkDescription">{item.description}</span>
              </span>
              <span className="acMobileMoreLinkChevron" aria-hidden>
                ›
              </span>
            </Link>
          ))}
        </nav>
      </MobileSection>

      <MobileSection title={guideCopy.section}>
        <MobileCard
          title={guideCopy.title}
          description={guideCopy.description}
          actions={
            <button type="button" className="acMobilePrimaryBtn" onClick={startGuide}>
              {guideCopy.start}
            </button>
          }
        />
      </MobileSection>

      <MobileSection title={copy.theme}>
        <MobileCard
          title={copy.theme}
          description={t.theme.toggle}
          actions={<ThemeSwitch />}
        />
      </MobileSection>
    </div>
  )
}
