import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'

export function QuickActions() {
  const { t } = useI18n()

  return (
    <div className="acQuickActions" aria-label={t.executiveDashboard.quickActions}>
      <Link to="/ops/chats/new" className="acQuickActionBtn acQuickActionBtnPrimary">
        {t.executiveDashboard.actionNewChat}
      </Link>
      <Link to="/ops/employees/new" className="acQuickActionBtn">
        {t.executiveDashboard.actionNewEmployee}
      </Link>
      <Link to="/ops/tasks" className="acQuickActionBtn">
        {t.executiveDashboard.actionTasks}
      </Link>
      <Link to="/" className="acQuickActionBtn">
        {t.executiveDashboard.actionFlow}
      </Link>
    </div>
  )
}
