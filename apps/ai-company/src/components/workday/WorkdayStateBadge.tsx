import type { WorkdayState } from '../../domain/workday'
import { useI18n } from '../../i18n'

const STATE_CLASS: Record<WorkdayState, string> = {
  starting: 'acWorkdayStateStarting',
  planning: 'acWorkdayStatePlanning',
  working: 'acWorkdayStateWorking',
  waiting: 'acWorkdayStateWaiting',
  reviewing: 'acWorkdayStateReviewing',
  completed: 'acWorkdayStateCompleted',
  finished: 'acWorkdayStateFinished',
}

export function WorkdayStateBadge(props: { state: WorkdayState; compact?: boolean }) {
  const { t } = useI18n()
  const label = t.workdayEngine.states[props.state]
  const className = [
    'acWorkdayStateBadge',
    STATE_CLASS[props.state],
    props.compact ? 'acWorkdayStateBadgeCompact' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={className}>{label}</span>
}
