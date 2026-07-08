import { Link } from 'react-router-dom'
import { ThemeSwitch } from '../../components/theme/ThemeSwitch'
import { useI18n } from '../../i18n'
import { MobileCard } from '../components/MobileCard'
import { MobileEmptyState } from '../components/MobileEmptyState'
import { MobileLoadingSkeleton } from '../components/MobileLoadingSkeleton'
import { MobileSection } from '../components/MobileSection'

import { Link } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { useI18n } from '../../i18n'
import { MobileCard } from '../components/MobileCard'
import { MobileSection } from '../components/MobileSection'

export function MobileEmployeesPage() {
  const { t } = useI18n()
  const list = t.mobile.maxControl.employeesList

  return (
    <MobileSection title={t.mobile.pages.employees} description={t.ownerNav.groups.employees.hint}>
      <MobileCard
        title={list?.maxTitle ?? 'MAX'}
        description={list?.maxDescription ?? t.ownerNav.items.maxWorkspace.why}
        status={{ label: t.mobile.maxControl.hero.firstEmployeeBadge, tone: 'info' }}
        actions={
          <Link to={`/mobile/employees/${MAX_WORKER_EMPLOYEE_ID}`} className="acMobileLinkBtn">
            {list?.openMax ?? t.ownerNav.items.maxWorkspace.label}
          </Link>
        }
      />
    </MobileSection>
  )
}

export function MobileTasksPage() {
  const { t } = useI18n()

  return (
    <MobileSection title={t.mobile.pages.tasks} description={t.ownerNav.groups.tasks.hint}>
      <MobileEmptyState variant="noTasks" />
      <MobileLoadingSkeleton variant="card" rows={2} />
    </MobileSection>
  )
}

export function MobileDecisionsPage() {
  const { t } = useI18n()

  return (
    <MobileSection title={t.mobile.pages.decisions} description={t.ownerNav.groups.decisions.hint}>
      <MobileCard
        title={t.pages.approvals}
        description={t.contextEmpty.approvals.initial.reason}
        status={{ label: t.labels.active, tone: 'success' }}
        actions={
          <Link to="/ops/approvals" className="acMobileLinkBtn">
            {t.pages.approvals}
          </Link>
        }
      />
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
        <MobileEmptyState variant="noReports" />
      </MobileSection>
    </>
  )
}
