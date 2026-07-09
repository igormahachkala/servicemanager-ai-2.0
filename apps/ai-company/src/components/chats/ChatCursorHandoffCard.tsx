import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  copyCursorHandoffFromChat,
  createMaxTaskFromCursorHandoff,
  getCursorHandoffFromChatById,
  markCursorHandoffFromChatSent,
  rejectCursorHandoffFromChatFlow,
} from '../../domain/cursorHandoffFromChat'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { useI18n } from '../../i18n'

type Props = {
  handoffId: string
  onUpdated?: () => void
}

export function ChatCursorHandoffCard({ handoffId, onUpdated }: Props) {
  const { t } = useI18n()
  const copy = t.chats.cursorHandoffFromChat
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) {
    return (
      <div className="mcChatCursorHandoffCard mcChatCursorHandoffCardMissing">
        <p>{copy.missing}</p>
      </div>
    )
  }

  const rejected = proposal.status === 'rejected'
  const sent = proposal.status === 'sent' || proposal.status === 'result_pending'
  const hasTask = Boolean(proposal.workItemId)

  const notify = useCallback(() => {
    onUpdated?.()
  }, [onUpdated])

  const handleCopy = async () => {
    if (busy || rejected) return
    setBusy(true)
    try {
      const result = copyCursorHandoffFromChat(handoffId)
      if (result.ok && result.markdown) {
        await navigator.clipboard.writeText(result.markdown)
        setCopied(true)
        notify()
      }
    } finally {
      setBusy(false)
    }
  }

  const handleCreateTask = () => {
    if (busy || rejected || hasTask) return
    setBusy(true)
    try {
      createMaxTaskFromCursorHandoff(handoffId)
      notify()
    } finally {
      setBusy(false)
    }
  }

  const handleMarkSent = () => {
    if (busy || rejected || sent) return
    setBusy(true)
    try {
      markCursorHandoffFromChatSent(handoffId)
      notify()
    } finally {
      setBusy(false)
    }
  }

  const handleReject = () => {
    if (busy || rejected || sent) return
    setBusy(true)
    try {
      rejectCursorHandoffFromChatFlow(handoffId)
      notify()
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="mcChatCursorHandoffCard" aria-label={copy.cardTitle}>
      <header className="mcChatCursorHandoffHead">
        <span className="mcChatCursorHandoffBadge">{copy.badge}</span>
        <span className={`mcChatCursorHandoffStatus mcChatCursorHandoffStatus--${proposal.status}`}>
          {copy.statuses[proposal.status]}
        </span>
      </header>

      <h4 className="mcChatCursorHandoffTitle">{copy.cardTitle}</h4>
      <p className="mcChatCursorHandoffGoal">{proposal.goal}</p>

      <dl className="mcChatCursorHandoffMeta">
        <div className="mcChatCursorHandoffRow">
          <dt>{copy.fields.branch}</dt>
          <dd className="mcMono">{proposal.workingBranch}</dd>
        </div>
        <div className="mcChatCursorHandoffRow">
          <dt>{copy.fields.scope}</dt>
          <dd>{proposal.fileScope.slice(0, 3).join(', ')}</dd>
        </div>
      </dl>

      <p className="mcMuted mcChatCursorHandoffHint">{copy.manualHint}</p>

      <div className="mcChatCursorHandoffActions">
        <button
          type="button"
          className="mcBtn mcBtnPrimary mcBtnSmall"
          disabled={busy || rejected}
          onClick={() => void handleCopy()}
        >
          {copied ? copy.actions.copied : copy.actions.copy}
        </button>
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSmall"
          disabled={busy || rejected || hasTask}
          onClick={handleCreateTask}
        >
          {copy.actions.createMaxTask}
        </button>
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSmall"
          disabled={busy || rejected || sent}
          onClick={handleMarkSent}
        >
          {copy.actions.markSent}
        </button>
        <button
          type="button"
          className="mcBtn mcBtnGhost mcBtnSmall"
          disabled={busy || rejected || sent}
          onClick={handleReject}
        >
          {copy.actions.reject}
        </button>
      </div>

      {hasTask && proposal.workItemId ? (
        <Link
          to={`/mobile/employees/${MAX_WORKER_EMPLOYEE_ID}`}
          className="mcChatCursorHandoffTaskLink"
        >
          {copy.actions.openMaxTask}
        </Link>
      ) : null}

      {proposal.history.length > 0 ? (
        <ul className="mcChatCursorHandoffHistory">
          {proposal.history.map((entry) => (
            <li key={entry.id}>
              <span>{copy.history[entry.kind]}</span>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
