import { Link } from 'react-router-dom'
import { EMPLOYEE_ROUTE_IDS } from '../mission-control/data/employeeIdResolver'
import { ownerNavItemHint } from '../navigation/ownerNavPath'
import { useI18n } from '../i18n'

export function QuickActions() {
  const { t } = useI18n()

  return (
    <div className="acQuickActions" aria-label={t.executiveDashboard.quickActions}>
      <Link
        to="/ops/run-task"
        className="acQuickActionBtn acQuickActionBtnPrimary"
        title={ownerNavItemHint('runTask', t)}
      >
        {t.ownerNav.items.runTask.label}
      </Link>
      <Link
        to="/ops/morning-report"
        className="acQuickActionBtn"
        title={ownerNavItemHint('morningReport', t)}
      >
        {t.ownerNav.items.morningReport.label}
      </Link>
      <Link
        to="/ops/approvals"
        className="acQuickActionBtn"
        title={ownerNavItemHint('approvals', t)}
      >
        {t.ownerNav.items.approvals.label}
      </Link>
      <Link
        to={`/ops/employees/${EMPLOYEE_ROUTE_IDS.max}/today`}
        className="acQuickActionBtn"
        title={ownerNavItemHint('maxToday', t)}
      >
        {t.ownerNav.items.maxToday.label}
      </Link>
    </div>
  )
}
