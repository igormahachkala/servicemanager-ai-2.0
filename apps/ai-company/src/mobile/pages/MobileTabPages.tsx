import { Link } from 'react-router-dom'
import { ThemeSwitch } from '../../components/theme/ThemeSwitch'
import { useI18n } from '../../i18n'
import { MobileCard } from '../components/MobileCard'
import { MobileEmptyState } from '../components/MobileEmptyState'
import { MobileSection } from '../components/MobileSection'

export function MobileTasksPage() {
  const { t } = useI18n()

  return (
    <MobileSection title={t.mobile.pages.tasks} description={t.ownerNav.groups.tasks.hint}>
      <Link to="/mobile/tasks/new" className="acMobilePrimaryBtn acMobileTasksNewBtn">
        {t.mobile.fab.assignTask}
      </Link>
      <MobileEmptyState variant="noTasks" />
    </MobileSection>
  )
}

export function MobileMorePage() {
  const { t } = useI18n()

  return (
    <>
      <MobileSection title={t.mobile.pages.more}>
        <MobileCard
          title={t.mobile.more.desktop}
          description={t.ownerNav.items.commandCenter.why}
          actions={
            <Link to="/ops" className="acMobileLinkBtn">
              {t.ownerNav.items.commandCenter.label}
            </Link>
          }
        />
        <MobileCard
          title={t.mobile.more.theme}
          description={t.theme.toggle}
          actions={<ThemeSwitch />}
        />
      </MobileSection>
      <MobileSection title={t.pages.reports}>
        <MobileCard
          title={t.mobile.reports.pageTitle}
          description={t.mobile.reports.moreDescription}
          actions={
            <Link to="/mobile/reports" className="acMobilePrimaryBtn">
              {t.mobile.reports.actions.openList}
            </Link>
          }
        />
      </MobileSection>
    </>
  )
}
