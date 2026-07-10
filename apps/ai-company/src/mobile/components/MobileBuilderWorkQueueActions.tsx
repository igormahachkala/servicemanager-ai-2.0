import { useCallback, useState } from 'react'
import { BUILDER_EMPLOYEE_ID } from '../../domain/mobileEmployee'
import { listEmployeeWorkQueue, startEmployeeWorkItem } from '../../domain/employeeWorkQueue'
import { completeBuilderDelegatedWorkItem } from '../../domain/delegationReview'
import { useI18n } from '../../i18n'
import { MobileCard } from './MobileCard'

type Props = {
  onUpdated: () => void
}

export function MobileBuilderWorkQueueActions({ onUpdated }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.employeeProfiles.builder.queueActions
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const actionable = listEmployeeWorkQueue(BUILDER_EMPLOYEE_ID).items.filter(
    (item) =>
      item.source === 'delegation' &&
      (item.status === 'pending' ||
        item.status === 'scheduled' ||
        item.status === 'in_progress'),
  )

  const handleStart = useCallback(
    async (workItemId: string) => {
      setError(null)
      setBusyId(workItemId)
      try {
        const started = startEmployeeWorkItem(workItemId)
        if (!started) {
          setError(copy.startFailed)
          return
        }
        onUpdated()
      } finally {
        setBusyId(null)
      }
    },
    [copy.startFailed, onUpdated],
  )

  const handleComplete = useCallback(
    async (workItemId: string) => {
      setError(null)
      setBusyId(workItemId)
      try {
        const result = completeBuilderDelegatedWorkItem(workItemId)
        if (!result.ok) {
          setError(result.message)
          return
        }
        onUpdated()
      } finally {
        setBusyId(null)
      }
    },
    [onUpdated],
  )

  if (actionable.length === 0) return null

  return (
    <MobileCard title={copy.title} description={copy.description}>
      <ul className="acMobileMaxQueueList">
        {actionable.map((item) => {
          const canStart = item.status === 'pending' || item.status === 'scheduled'
          const canComplete = item.status === 'in_progress'
          const isBusy = busyId === item.id

          return (
            <li key={item.id} className="acMobileMaxQueueItem">
              <div className="acMobileMaxQueueItemTitle">{item.title}</div>
              <div className="acMobileMaxQueueMeta">
                {copy.statusLabel}: {item.status}
              </div>
              <div className="acMobileCardActions">
                {canStart ? (
                  <button
                    type="button"
                    className="acMobileSecondaryBtn acMobileChatActionBtn"
                    disabled={isBusy}
                    onClick={() => void handleStart(item.id)}
                  >
                    {copy.start}
                  </button>
                ) : null}
                {canComplete ? (
                  <button
                    type="button"
                    className="acMobilePrimaryBtn acMobileChatActionBtn"
                    disabled={isBusy}
                    onClick={() => void handleComplete(item.id)}
                  >
                    {copy.complete}
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      {error ? (
        <p className="acMobileFieldError" role="alert">
          {error}
        </p>
      ) : null}
      <p className="acMobileMaxQueueFabHint">{copy.hint}</p>
    </MobileCard>
  )
}
