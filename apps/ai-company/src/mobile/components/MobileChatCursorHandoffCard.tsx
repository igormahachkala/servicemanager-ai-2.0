import { useCallback, useState } from 'react'
import {
  copyMobileCursorHandoff,
  createMaxTaskFromMobileCursorHandoff,
  getCursorHandoffFromChatById,
  markMobileCursorHandoffSent,
  rejectMobileCursorHandoff,
} from '../../domain/cursorHandoffFromChat'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { useI18n } from '../../i18n'

type Props = {
  handoffId: string
  onUpdated?: () => void
}

export function MobileChatCursorHandoffCard({ handoffId, onUpdated }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.maxChat.cursorHandoff
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const proposal = getCursorHandoffFromChatById(handoffId)
  if (!proposal) {
    return <p className="acMobileChatHandoffMissing">{copy.missing}</p>
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
      const result = copyMobileCursorHandoff(handoffId, MAX_WORKER_EMPLOYEE_ID)
      if (result.ok && result.markdown) {
        await navigator.clipboard.writeText(result.markdown)
        setCopied(true)
        notify()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acMobileChatHandoffCard">
      <p className="acMobileChatHandoffTitle">{copy.cardTitle}</p>
      <p className="acMobileChatHandoffGoal">{proposal.goal}</p>
      <p className="acMobileChatHandoffStatus">{copy.statuses[proposal.status]}</p>
      <p className="acMobileOwnerHomeMuted acMobileChatHandoffHint">{copy.manualHint}</p>

      <div className="acMobileChatHandoffActions">
        <button
          type="button"
          className="acMobilePrimaryBtn"
          disabled={busy || rejected}
          onClick={() => void handleCopy()}
        >
          {copied ? copy.actions.copied : copy.actions.copy}
        </button>
        <button
          type="button"
          className="acMobileSecondaryBtn"
          disabled={busy || rejected || hasTask}
          onClick={() => {
            setBusy(true)
            createMaxTaskFromMobileCursorHandoff(handoffId, MAX_WORKER_EMPLOYEE_ID)
            notify()
            setBusy(false)
          }}
        >
          {copy.actions.createMaxTask}
        </button>
        <button
          type="button"
          className="acMobileSecondaryBtn"
          disabled={busy || rejected || sent}
          onClick={() => {
            setBusy(true)
            markMobileCursorHandoffSent(handoffId, MAX_WORKER_EMPLOYEE_ID)
            notify()
            setBusy(false)
          }}
        >
          {copy.actions.markSent}
        </button>
        <button
          type="button"
          className="acMobileTertiaryLinkBtn"
          disabled={busy || rejected || sent}
          onClick={() => {
            setBusy(true)
            rejectMobileCursorHandoff(handoffId, MAX_WORKER_EMPLOYEE_ID)
            notify()
            setBusy(false)
          }}
        >
          {copy.actions.reject}
        </button>
      </div>
    </div>
  )
}
