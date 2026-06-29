import { Link } from 'react-router-dom'
import { resolveEmployee } from '../../mission-control/data/conversation'
import type { TaskResult } from '../../domain/taskResults'
import { useI18n } from '../../i18n'
import { TaskResultStatusBadge } from './TaskResultStatusBadge'

type Props = {
  result: TaskResult
  selected?: boolean
  onSelect?: (id: string) => void
  compact?: boolean
}

export function TaskResultCard({ result, selected, onSelect, compact }: Props) {
  const employee = resolveEmployee(result.employeeId)
  const className = selected ? 'acTaskResultCard acTaskResultCardSelected' : 'acTaskResultCard'

  const body = (
    <>
      <div className="acTaskResultCardHead">
        <span className="acTaskResultCardTitle">{result.title}</span>
        <TaskResultStatusBadge status={result.status} />
      </div>
      {!compact ? <p className="acTaskResultCardSummary">{result.summary}</p> : null}
      <div className="acTaskResultCardMeta mcMuted">
        <span>{employee?.codename ?? result.employeeId}</span>
        {result.taskId ? <span className="mcMono">{result.taskId}</span> : null}
        <span>{new Date(result.updatedAt).toLocaleString()}</span>
      </div>
    </>
  )

  if (onSelect) {
    return (
      <button type="button" className={className} onClick={() => onSelect(result.id)}>
        {body}
      </button>
    )
  }

  return (
    <Link to={`/ops/task-results/${result.id}`} className={className}>
      {body}
    </Link>
  )
}

export function TaskResultFilters({
  filter,
  onChange,
  statuses,
}: {
  filter: import('../../domain/taskResults').TaskResultFilter
  onChange: (next: import('../../domain/taskResults').TaskResultFilter) => void
  statuses: Array<import('../../domain/taskResults').TaskResultStatus | 'all'>
}) {
  const { t } = useI18n()

  return (
    <div className="acTaskResultFilters">
      <label className="mcField">
        <span className="mcFieldLabel">{t.taskResultEngine.fields.status}</span>
        <select
          value={filter.status}
          onChange={(event) =>
            onChange({ ...filter, status: event.target.value as typeof filter.status })
          }
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status === 'all' ? t.common.all : t.taskResultEngine.statuses[status]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function TaskResultSummary({ stats }: { stats: import('../../domain/taskResults').TaskResultStats }) {
  const { t } = useI18n()

  return (
    <div className="mcGrid4">
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.taskResultEngine.stats.total}</div>
        <div className="mcMetricValue">{stats.total}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.taskResultEngine.stats.readyForReview}</div>
        <div className="mcMetricValue">{stats.readyForReview}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.taskResultEngine.stats.approved}</div>
        <div className="mcMetricValue">{stats.approved}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.taskResultEngine.stats.changesRequested}</div>
        <div className="mcMetricValue">{stats.changesRequested}</div>
      </div>
    </div>
  )
}

export function TaskResultTimeline({ result }: { result: TaskResult }) {
  const { t } = useI18n()

  if (result.reviewHistory.length === 0) {
    return <p className="mcMuted">{t.taskResultEngine.noTimeline}</p>
  }

  return (
    <div className="acTaskResultTimeline">
      {result.reviewHistory.map((entry) => (
        <div key={entry.id} className="acTaskResultTimelineItem">
          <div className="acTaskResultTimelineHead">
            <span className="mcMono">{t.taskResultEngine.reviewActions[entry.kind]}</span>
            <span className="mcMuted">{entry.actorId}</span>
            <span className="mcMuted">{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
          {entry.comment ? <p>{entry.comment}</p> : null}
        </div>
      ))}
    </div>
  )
}

export function TaskResultReviewPanel({
  result,
  onApprove,
  onRequestChanges,
  onReject,
  onFollowUp,
  onSendQa,
  onSendCodex,
  onArchive,
}: {
  result: TaskResult
  onApprove: (comment: string) => void
  onRequestChanges: (comment: string) => void
  onReject: (comment: string) => void
  onFollowUp: () => void
  onSendQa: (comment: string) => void
  onSendCodex: (comment: string) => void
  onArchive: (comment: string) => void
}) {
  const { t } = useI18n()
  const canReview = result.status === 'ready_for_review' || result.status === 'changes_requested'

  const readComment = (): string => {
    const el = document.getElementById(`task-result-comment-${result.id}`) as HTMLTextAreaElement | null
    return el?.value.trim() ?? ''
  }

  return (
    <div className="acTaskResultReviewForm">
      <label className="mcField">
        <span className="mcFieldLabel">{t.taskResultEngine.fields.ownerComment}</span>
        <textarea
          id={`task-result-comment-${result.id}`}
          className="mcInput"
          rows={3}
          defaultValue={result.ownerComment ?? ''}
          placeholder={t.taskResultEngine.commentPlaceholder}
        />
      </label>

      {canReview ? (
        <div className="acTaskResultActionRow">
          <button type="button" className="mcBtn mcBtnPrimary" onClick={() => onApprove(readComment())}>
            {t.taskResultEngine.actions.approve}
          </button>
          <button
            type="button"
            className="mcBtn mcBtnSecondary"
            onClick={() => onRequestChanges(readComment())}
          >
            {t.taskResultEngine.actions.requestChanges}
          </button>
          <button type="button" className="mcBtn mcBtnSecondary" onClick={() => onReject(readComment())}>
            {t.taskResultEngine.actions.reject}
          </button>
        </div>
      ) : null}

      <div className="acTaskResultActionRow">
        <button type="button" className="mcBtn mcBtnSecondary" onClick={onFollowUp}>
          {t.taskResultEngine.actions.createFollowUp}
        </button>
        <button type="button" className="mcBtn mcBtnSecondary" onClick={() => onSendQa(readComment())}>
          {t.taskResultEngine.actions.sendToQa}
        </button>
        <button type="button" className="mcBtn mcBtnSecondary" onClick={() => onSendCodex(readComment())}>
          {t.taskResultEngine.actions.sendToCodex}
        </button>
        {result.status !== 'archived' ? (
          <button type="button" className="mcBtn mcBtnSecondary" onClick={() => onArchive(readComment())}>
            {t.taskResultEngine.actions.archive}
          </button>
        ) : null}
      </div>
    </div>
  )
}
