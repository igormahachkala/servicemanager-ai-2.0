import { Link } from 'react-router-dom'
import type { MaxWorkspaceWorkQueueView } from '../../domain/maxWorkspace/maxWorkspaceWorkQueueViewModel'
import { useI18n } from '../../i18n'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'
import { MobileCard } from './MobileCard'
import { MobileEmptyState } from './MobileEmptyState'

type Props = {
  workQueue: MaxWorkspaceWorkQueueView
  isRunning: boolean
  onRunNext: () => void
}

export function MobileWorkQueueCard({ workQueue, isRunning, onRunNext }: Props) {
  const { t } = useI18n()
  const wq = t.maxWorkspace.workQueue
  const copy = t.mobile.maxControl.workQueue
  const runTaskHref = MOBILE_PATHS.tasksNewMax

  if (workQueue.isEmpty) {
    return (
      <MobileEmptyState
        variant="noTasks"
        actionLabel={copy.assignTask}
        actionHref={runTaskHref}
      />
    )
  }

  const priorityLabel = (priority: string) =>
    wq.priorities[priority as keyof typeof wq.priorities] ?? priority
  const statusLabel = (status: string) =>
    wq.statuses[status as keyof typeof wq.statuses] ?? status

  return (
    <MobileCard
      title={copy.title}
      description={workQueue.nextSuggestedAction.detail ?? wq.suggestedAction}
      status={{
        label: wq.stats.pending.replace('{count}', String(workQueue.pendingCount)),
        tone: workQueue.blockedCount > 0 ? 'warning' : 'info',
      }}
    >
      {workQueue.activeItem ? (
        <div className="acMobileMaxQueueBlock">
          <div className="acMobileMaxQueueLabel">{wq.activeLabel}</div>
          <div className="acMobileMaxQueueTitle">{workQueue.activeItem.title}</div>
          <div className="acMobileMaxQueueMeta">
            {wq.fields.priority}: {priorityLabel(workQueue.activeItem.priority)} ·{' '}
            {wq.fields.status}: {statusLabel(workQueue.activeItem.status)}
          </div>
        </div>
      ) : null}

      {workQueue.pendingItems.length > 0 ? (
        <ul className="acMobileMaxQueueList">
          {workQueue.pendingItems.slice(0, 4).map((item) => (
            <li key={item.id} className="acMobileMaxQueueItem">
              <div className="acMobileMaxQueueItemTitle">{item.title}</div>
              <div className="acMobileMaxQueueMeta">
                {priorityLabel(item.priority)} · {statusLabel(item.status)}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {workQueue.nextSuggestedAction.title ? (
        <p className="acMobileMaxQueueHint">{workQueue.nextSuggestedAction.title}</p>
      ) : null}

      <div className="acMobileCardActions">
        <Link to={runTaskHref} className="acMobileSecondaryBtn">
          {copy.assignTask}
        </Link>
        <button
          type="button"
          className="acMobilePrimaryBtn"
          disabled={isRunning || workQueue.nextSuggestedAction.kind === 'wait_active'}
          onClick={() => void onRunNext()}
        >
          {isRunning ? copy.running : copy.runNext}
        </button>
      </div>
    </MobileCard>
  )
}
