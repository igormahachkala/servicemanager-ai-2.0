import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { MaxWorkspaceWorkQueueItemView } from '../../domain/maxWorkspace/maxWorkspaceWorkQueueViewModel'
import type { WorkPriority, WorkStatus } from '../../domain/employeeWorkQueue'
import { useMaxEmployeeWorkQueue } from '../../hooks/useMaxEmployeeWorkQueue'
import { useI18n } from '../../i18n'

function formatTimestamp(value: string | null): string | null {
  if (!value?.trim()) return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleString('ru-RU')
}

function WorkQueueField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null
  return (
    <div className="acMaxWorkQueueField">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function WorkQueueItemCard({
  item,
  variant,
  statusLabel,
  priorityLabel,
}: {
  item: MaxWorkspaceWorkQueueItemView
  variant: 'active' | 'pending'
  statusLabel: string
  priorityLabel: string
}) {
  const { t } = useI18n()
  const f = t.maxWorkspace.workQueue.fields

  return (
    <article
      className={
        variant === 'active' ? 'acMaxWorkQueueItem acMaxWorkQueueItemActive' : 'acMaxWorkQueueItem'
      }
    >
      <div className="acMaxWorkQueueItemHead">
        <h4 className="acMaxWorkQueueItemTitle">{item.title}</h4>
        <div className="acMaxWorkQueueItemBadges">
          <span className="acMaxWorkspaceBadge">{priorityLabel}</span>
          <span className="acMaxWorkspaceBadge">{statusLabel}</span>
        </div>
      </div>
      {item.summary ? <p className="mcMuted acMaxWorkQueueItemSummary">{item.summary}</p> : null}
      <dl className="acMaxWorkQueueItemMeta">
        <WorkQueueField label={f.priority} value={priorityLabel} />
        <WorkQueueField label={f.status} value={statusLabel} />
        <WorkQueueField label={f.scheduledAt} value={formatTimestamp(item.scheduledAt)} />
        <WorkQueueField label={f.startedAt} value={formatTimestamp(item.startedAt)} />
        <WorkQueueField label={f.completedAt} value={formatTimestamp(item.completedAt)} />
        <WorkQueueField label={f.blockedReason} value={item.blockedReason} />
        <WorkQueueField label={f.queuePosition} value={String(item.queuePosition)} />
        {item.workerLoopId ? (
          <div className="acMaxWorkQueueField">
            <dt>{f.workerLoopId}</dt>
            <dd>
              <code className="acMaxWorkQueueMono">{item.workerLoopId}</code>
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  )
}

export function MaxEmployeeWorkQueuePanel() {
  const { t } = useI18n()
  const wq = t.maxWorkspace.workQueue
  const { view, isRunning, addTestTask, runNext, runAll } = useMaxEmployeeWorkQueue()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusLabel = (status: WorkStatus) => wq.statuses[status]
  const priorityLabel = (priority: WorkPriority) => wq.priorities[priority]

  const handleAddTest = () => {
    setError(null)
    addTestTask()
    setFeedback(wq.feedback.testAdded)
  }

  const handleRunNext = async () => {
    setError(null)
    setFeedback(null)
    const result = await runNext()
    if (result.ok) {
      setFeedback(wq.feedback.started.replace('{title}', result.workItem?.title ?? ''))
      return
    }
    setError(result.errorMessage ?? wq.errors.generic)
  }

  const handleRunAll = async () => {
    setError(null)
    setFeedback(null)
    const result = await runAll()
    if (result.stoppedEarly && result.results.at(-1)?.ok === false) {
      setError(result.results.at(-1)?.errorMessage ?? wq.errors.generic)
      if (result.processed > 0) {
        setFeedback(wq.feedback.runAllPartial.replace('{count}', String(result.processed)))
      }
      return
    }
    if (result.processed === 0) {
      setError(wq.errors.emptyQueue)
      return
    }
    setFeedback(wq.feedback.runAllDone.replace('{count}', String(result.processed)))
  }

  const disableActions = isRunning

  return (
    <div className="acMaxWorkQueuePanel">
      <div className="acMaxWorkQueueToolbar">
        <div className="acMaxWorkQueueStats mcMuted">
          {wq.stats.pending.replace('{count}', String(view.pendingCount))}
          {view.blockedCount > 0
            ? ` · ${wq.stats.blocked.replace('{count}', String(view.blockedCount))}`
            : null}
        </div>
        <div className="acMaxWorkQueueActions">
          <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" disabled={disableActions} onClick={handleAddTest}>
            {wq.actions.addTest}
          </button>
          <button type="button" className="mcBtn mcBtnPrimary mcBtnSm" disabled={disableActions} onClick={handleRunNext}>
            {wq.actions.startNext}
          </button>
          <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" disabled={disableActions} onClick={handleRunAll}>
            {wq.actions.runAll}
          </button>
        </div>
      </div>

      {isRunning ? <p className="acMaxWorkQueueRunning mcMuted">{wq.running}</p> : null}
      {feedback ? <p className="acMaxWorkQueueFeedback">{feedback}</p> : null}
      {error ? <p className="acMaxWorkQueueError">{error}</p> : null}

      <section className="acMaxWorkQueueSuggested">
        <h3 className="acMaxWorkQueueSuggestedTitle">{wq.suggestedAction}</h3>
        <p className="acMaxWorkQueueSuggestedMain">{view.nextSuggestedAction.title}</p>
        {view.nextSuggestedAction.detail ? (
          <p className="mcMuted acMaxWorkQueueSuggestedDetail">{view.nextSuggestedAction.detail}</p>
        ) : null}
      </section>

      {view.isEmpty ? (
        <p className="acMaxWorkspaceSectionEmpty mcMuted">{wq.empty}</p>
      ) : (
        <div className="acMaxWorkQueueBody">
          {view.activeItem ? (
            <section className="acMaxWorkQueueSection">
              <h3 className="acMaxWorkQueueSectionTitle">{wq.activeLabel}</h3>
              <WorkQueueItemCard
                item={view.activeItem}
                variant="active"
                statusLabel={statusLabel(view.activeItem.status)}
                priorityLabel={priorityLabel(view.activeItem.priority)}
              />
            </section>
          ) : null}

          {view.pendingItems.length > 0 ? (
            <section className="acMaxWorkQueueSection">
              <h3 className="acMaxWorkQueueSectionTitle">{wq.pendingLabel}</h3>
              <div className="acMaxWorkQueueList">
                {view.pendingItems.map((item) => (
                  <WorkQueueItemCard
                    key={item.id}
                    item={item}
                    variant="pending"
                    statusLabel={statusLabel(item.status)}
                    priorityLabel={priorityLabel(item.priority)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <p className="mcMuted acMaxWorkQueueFootnote">
        {wq.footnote}{' '}
        <Link to="/ops/run-task?employee=ag-max" className="mcLink">
          {t.maxWorkspace.actions.runTask}
        </Link>
      </p>
    </div>
  )
}
