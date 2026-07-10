import { Link } from 'react-router-dom'
import type { MobileEmployeeChatMessage } from '../chat/mobileEmployeeChat'
import type { MobileChatTimelineEntry } from '../chat/mobileChatTimelineTypes'
import { mobileReportHref, mobileRuntimeLoopHref, mobileRuntimeRunHref } from '../navigation/mobileHrefResolver'
import { MobileChatCursorHandoffCard } from './MobileChatCursorHandoffCard'
import { MobileChatDelegationProposalCard } from './MobileChatDelegationProposalCard'
import { MobileChatDelegationExecutionCard } from './MobileChatDelegationExecutionCard'
import { useI18n } from '../../i18n'

type BubbleProps = {
  entry: MobileChatTimelineEntry
  timestamp: string
  onCreateTask?: () => void
  onRunNow?: () => void
  onEdit?: () => void
  onCancel?: () => void
  onApproveDelegation?: () => void
  onChangeDelegationAssignee?: () => void
  onKeepDelegationWithMax?: () => void
  onCancelDelegation?: () => void
  onExecuteDelegation?: () => void
  onHandoffUpdated?: () => void
}

export function MobileChatTimelineBubble({
  entry,
  timestamp,
  onCreateTask,
  onRunNow,
  onEdit,
  onCancel,
  onApproveDelegation,
  onChangeDelegationAssignee,
  onKeepDelegationWithMax,
  onCancelDelegation,
  onExecuteDelegation,
  onHandoffUpdated,
}: BubbleProps) {
  const { t } = useI18n()
  const copy = t.mobile.maxChat
  const message = entry.message

  const roleLabel =
    entry.role === 'owner'
      ? copy.roles.owner
      : entry.role === 'max'
        ? copy.roles.max
        : copy.roles.system

  const bubbleClass = [
    'acMobileChatBubble',
    entry.role === 'owner'
      ? 'acMobileChatBubbleOwner'
      : entry.role === 'max'
        ? 'acMobileChatBubbleMax'
        : 'acMobileChatBubbleSystem',
    entry.source === 'event' ? 'acMobileChatBubbleEvent' : '',
    entry.tone !== 'default' ? `acMobileChatBubbleTone${capitalize(entry.tone)}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className={bubbleClass}
      data-kind={message?.kind ?? entry.eventKind ?? 'event'}
      data-source={entry.source}
      aria-label={roleLabel}
    >
      <header className="acMobileChatBubbleHeader">
        <span className="acMobileChatBubbleRole">{roleLabel}</span>
        <time className="acMobileChatBubbleTime" dateTime={entry.createdAt}>
          {timestamp}
        </time>
      </header>

      {entry.eventTitle ? (
        <p className="acMobileChatEventTitle">{entry.eventTitle}</p>
      ) : null}

      <p
        className={`acMobileChatBubbleContent${
          message?.pending ? ' acMobileChatBubbleContentPending' : ''
        }`}
      >
        {entry.content}
      </p>

      {message?.kind === 'cursor_handoff' && message.cursorHandoffId ? (
        <MobileChatCursorHandoffCard
          handoffId={message.cursorHandoffId}
          onUpdated={onHandoffUpdated}
        />
      ) : null}

      {message?.kind === 'delegation_proposal' &&
      message.delegationProposal &&
      !message.pending ? (
        <MobileChatDelegationProposalCard
          proposal={message.delegationProposal}
          onApprove={() => onApproveDelegation?.()}
          onChangeAssignee={() => onChangeDelegationAssignee?.()}
          onKeepMax={() => onKeepDelegationWithMax?.()}
          onCancel={() => onCancelDelegation?.()}
        />
      ) : null}

      {(message?.kind === 'delegation_event' || message?.kind === 'delegation_proposal') &&
      message.delegationProposal &&
      message.delegationProposal.status === 'awaiting_execution' &&
      !message.pending ? (
        <MobileChatDelegationExecutionCard
          proposal={message.delegationProposal}
          onExecute={() => onExecuteDelegation?.()}
        />
      ) : null}

      {message?.kind === 'task_proposal' &&
      message.taskProposal &&
      !message.pending &&
      !message.workItemId ? (
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

      {message?.kind === 'report_link' && message.reportId ? (
        <div className="acMobileChatBubbleActions">
          <Link to={mobileReportHref(message.reportId)} className="acMobilePrimaryBtn acMobileChatActionBtn">
            {copy.actions.openReport}
          </Link>
        </div>
      ) : null}

      {renderTimelineLinks(entry, copy.actions.openReport, copy.actions.openRuntime)}

      {message?.workItemId ? (
        <p className="acMobileChatBubbleMeta">{copy.taskQueued.replace('{id}', message.workItemId)}</p>
      ) : null}
    </article>
  )
}

function renderTimelineLinks(
  entry: MobileChatTimelineEntry,
  openReportLabel: string,
  openRuntimeLabel: string,
) {
  const hasReport = Boolean(entry.reportId)
  const hasRuntime = Boolean(entry.runtimeRunId || entry.workerLoopId)
  if (!hasReport && !hasRuntime) return null

  return (
    <div className="acMobileChatBubbleActions">
      {entry.reportId ? (
        <Link to={mobileReportHref(entry.reportId)} className="acMobilePrimaryBtn acMobileChatActionBtn">
          {openReportLabel}
        </Link>
      ) : null}
      {entry.workerLoopId ? (
        <Link
          to={mobileRuntimeLoopHref(entry.workerLoopId)}
          className="acMobileSecondaryBtn acMobileChatActionBtn"
        >
          {openRuntimeLabel}
        </Link>
      ) : null}
      {entry.runtimeRunId ? (
        <Link
          to={mobileRuntimeRunHref(entry.runtimeRunId)}
          className="acMobileSecondaryBtn acMobileChatActionBtn"
        >
          {openRuntimeLabel}
        </Link>
      ) : null}
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

type ListProps = {
  entries: MobileChatTimelineEntry[]
  formatTimestamp: (iso: string) => string
  onCreateTask: (message: MobileEmployeeChatMessage) => void
  onRunNow: (message: MobileEmployeeChatMessage) => void
  onEditTask: (message: MobileEmployeeChatMessage) => void
  onCancelProposal: (message: MobileEmployeeChatMessage) => void
  onApproveDelegation: (message: MobileEmployeeChatMessage) => void
  onChangeDelegationAssignee: (message: MobileEmployeeChatMessage) => void
  onKeepDelegationWithMax: (message: MobileEmployeeChatMessage) => void
  onCancelDelegation: (message: MobileEmployeeChatMessage) => void
  onExecuteDelegation: (message: MobileEmployeeChatMessage) => void
  onHandoffUpdated?: () => void
}

export function MobileChatMessageList({
  entries,
  formatTimestamp,
  onCreateTask,
  onRunNow,
  onEditTask,
  onCancelProposal,
  onApproveDelegation,
  onChangeDelegationAssignee,
  onKeepDelegationWithMax,
  onCancelDelegation,
  onExecuteDelegation,
  onHandoffUpdated,
}: ListProps) {
  return (
    <div className="acMobileChatMessageList" role="log" aria-live="polite">
      {entries.map((entry) => (
        <MobileChatTimelineBubble
          key={entry.id}
          entry={entry}
          timestamp={formatTimestamp(entry.createdAt)}
          onCreateTask={
            entry.message ? () => onCreateTask(entry.message as MobileEmployeeChatMessage) : undefined
          }
          onRunNow={entry.message ? () => onRunNow(entry.message as MobileEmployeeChatMessage) : undefined}
          onEdit={entry.message ? () => onEditTask(entry.message as MobileEmployeeChatMessage) : undefined}
          onCancel={
            entry.message ? () => onCancelProposal(entry.message as MobileEmployeeChatMessage) : undefined
          }
          onApproveDelegation={
            entry.message
              ? () => onApproveDelegation(entry.message as MobileEmployeeChatMessage)
              : undefined
          }
          onChangeDelegationAssignee={
            entry.message
              ? () => onChangeDelegationAssignee(entry.message as MobileEmployeeChatMessage)
              : undefined
          }
          onKeepDelegationWithMax={
            entry.message
              ? () => onKeepDelegationWithMax(entry.message as MobileEmployeeChatMessage)
              : undefined
          }
          onCancelDelegation={
            entry.message
              ? () => onCancelDelegation(entry.message as MobileEmployeeChatMessage)
              : undefined
          }
          onExecuteDelegation={
            entry.message
              ? () => onExecuteDelegation(entry.message as MobileEmployeeChatMessage)
              : undefined
          }
          onHandoffUpdated={onHandoffUpdated}
        />
      ))}
    </div>
  )
}
