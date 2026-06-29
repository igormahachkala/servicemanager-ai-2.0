import { Link } from 'react-router-dom'
import { Card } from '../layout'
import { NextSuggestedActionsPanel } from '../work-scheduler'
import { useWorkScheduler } from '../../hooks/useWorkScheduler'
import { useI18n } from '../../i18n'

export function WorkSchedulerCommandPanel() {
  const { t } = useI18n()
  const { pending, stats, approve, dismiss } = useWorkScheduler()

  return (
    <Card title={t.workScheduler.title}>
      <div className="mcWorkSchedulerStats">
        <span>{t.workScheduler.stats.pending.replace('{count}', String(stats.pending))}</span>
      </div>
      <NextSuggestedActionsPanel
        plan={null}
        pending={pending.slice(0, 4)}
        compact
        onApprove={approve}
        onDismiss={dismiss}
      />
      <Link to="/ops/task-results" className="mcBtn mcBtnSecondary mcWorkSchedulerLink">
        {t.workScheduler.actions.openQueue}
      </Link>
    </Card>
  )
}
