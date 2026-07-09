import { Link } from 'react-router-dom'
import type { MobileEmployeeChatMessage } from '../chat/mobileEmployeeChat'
import { mobileReportHref, mobileRuntimeLoopHref, mobileRuntimeRunHref } from '../navigation/mobileHrefResolver'
import { MobileChatCursorHandoffCard } from './MobileChatCursorHandoffCard'
import { useI18n } from '../../i18n'

type Props = {
  message: MobileEmployeeChatMessage
  timestamp: string
  onCreateTask?: () => void
  onRunNow?: () => void
  onEdit?: () => void
  onCancel?: () => void
  onHandoffUpdated?: () => void
}

export function MobileChatMessageBubble({
  message,
  timestamp,
  onCreateTask,
  onRunNow,
  onEdit,
  onCancel,
  onHandoffUpdated,
}: Props) {
  const { t } = useI18n()
  const copy = t.mobile.maxChat

  const roleLabel =
    message.role === 'owner'
      ? copy.roles.owner
      : message.role === 'max'
        ? copy.roles.max
        : copy.roles.system

  const bubbleClass =
    message.role === 'owner'
      ? 'acMobileChatBubble acMobileChatBubbleOwner'
      : message.role === 'max'
        ? 'acMobileChatBubble acMobileChatBubbleMax'
        : 'acMobileChatBubble acMobileChatBubbleSystem'

  return (
    <article className={bubbleClass} data-kind={message.kind} aria-label={roleLabel}>
      <header className="acMobileChatBubbleHeader">
        <span className="acMobileChatBubbleRole">{roleLabel}</span>
        <time className="acMobileChatBubbleTime" dateTime={message.createdAt}>
          {timestamp}
        </time>
      </header>

      <p className={`acMobileChatBubbleContent${message.pending ? ' acMobileChatBubbleContentPending' : ''}`}>
        {message.content}
      </p>

      {message.kind === 'cursor_handoff' && message.cursorHandoffId ? (
        <MobileChatCursorHandoffCard
          handoffId={message.cursorHandoffId}
          onUpdated={onHandoffUpdated}
        />
      ) : null}

      {message.kind === 'task_proposal' && message.taskProposal && !message.pending && !message.workItemId ? (
        <div className="acMobileChatProposalCard acMobileChatProposalCardInline">
          <dl className="acMobileChatProposalMeta">
            <div className="acMobileChatProposalRow">
              <dt>{copy.fields.priority}</dt>
              <dd>{t.mobile.runTask.priorities[message.taskProposal.priority ?? 'medium']}</dd>
            </div>
            {message.taskProposal.expectedResult ? (
              <div className="acMobileChatProposalRow">
                <dt>{copy.fields.expectedResult}</dt>
                <dd>{message.taskProposal.expectedResult}</dd>
              </div>
            ) : null}
          </dl>
          <p className="acMobileChatProposalTask">{message.taskProposal.taskText}</p>
          <div className="acMobileChatBubbleActions">
            <button type="button" className="acMobilePrimaryBtn acMobileChatActionBtn" onClick={onRunNow}>
              {copy.actions.runNow}
            </button>
            <button type="button" className="acMobileSecondaryBtn acMobileChatActionBtn" onClick={onCreateTask}>
              {copy.actions.createTask}
            </button>
            <button type="button" className="acMobileSecondaryBtn acMobileChatActionBtn" onClick={onEdit}>
              {copy.actions.editTask}
            </button>
            <button type="button" className="acMobileTertiaryLinkBtn acMobileChatActionBtn" onClick={onCancel}>
              {copy.actions.cancelProposal}
            </button>
          </div>
          <p className="acMobileChatProposalHint">{copy.proposalHint}</p>
        </div>
      ) : null}

      {message.kind === 'report_link' && message.reportId ? (
        <div className="acMobileChatBubbleActions">
          <Link to={mobileReportHref(message.reportId)} className="acMobilePrimaryBtn acMobileChatActionBtn">
            {copy.actions.openReport}
          </Link>
        </div>
      ) : null}

      {(message.runtimeRunId || message.workerLoopId) && message.role === 'max' ? (
        <div className="acMobileChatBubbleActions">
          {message.workerLoopId ? (
            <Link
              to={mobileRuntimeLoopHref(message.workerLoopId)}
              className="acMobileSecondaryBtn acMobileChatActionBtn"
            >
              {copy.actions.openRuntime}
            </Link>
          ) : null}
          {message.runtimeRunId ? (
            <Link
              to={mobileRuntimeRunHref(message.runtimeRunId)}
              className="acMobileSecondaryBtn acMobileChatActionBtn"
            >
              {copy.actions.openRuntime}
            </Link>
          ) : null}
        </div>
      ) : null}

      {message.workItemId ? (
        <p className="acMobileChatBubbleMeta">{copy.taskQueued.replace('{id}', message.workItemId)}</p>
      ) : null}
    </article>
  )
}

type ListProps = {
  messages: MobileEmployeeChatMessage[]
  formatTimestamp: (iso: string) => string
  onCreateTask: (message: MobileEmployeeChatMessage) => void
  onRunNow: (message: MobileEmployeeChatMessage) => void
  onEditTask: (message: MobileEmployeeChatMessage) => void
  onCancelProposal: (message: MobileEmployeeChatMessage) => void
  onHandoffUpdated?: () => void
}

export function MobileChatMessageList({
  messages,
  formatTimestamp,
  onCreateTask,
  onRunNow,
  onEditTask,
  onCancelProposal,
  onHandoffUpdated,
}: ListProps) {
  return (
    <div className="acMobileChatMessageList" role="log" aria-live="polite">
      {messages.map((message) => (
        <MobileChatMessageBubble
          key={message.id}
          message={message}
          timestamp={formatTimestamp(message.createdAt)}
          onCreateTask={() => onCreateTask(message)}
          onRunNow={() => onRunNow(message)}
          onEdit={() => onEditTask(message)}
          onCancel={() => onCancelProposal(message)}
          onHandoffUpdated={onHandoffUpdated}
        />
      ))}
    </div>
  )
}
