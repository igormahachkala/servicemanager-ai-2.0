import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { WorkPriority } from '../../domain/employeeWorkQueue'
import type { MaxWorkQueueRunResult } from '../../domain/maxWorkspace/maxWorkspaceWorkQueueRunner'
import { useI18n } from '../../i18n'
import type { MobileRunNextPreview } from '../hooks/useMobileEmployeeMax'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export type MobileRunNextSheetPhase = 'confirm' | 'running' | 'success' | 'error'

type Props = {
  preview: MobileRunNextPreview
  phase: MobileRunNextSheetPhase
  errorMessage?: string | null
  onConfirm: () => void
  onCancel: () => void
}

function isModelAvailabilityError(message: string | null | undefined): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('ollama') ||
    lower.includes('model') ||
    lower.includes('модел') ||
    lower.includes('not found') ||
    lower.includes('не найден')
  )
}

function priorityLabel(
  priority: WorkPriority,
  labels: Record<WorkPriority, string>,
): string {
  return labels[priority] ?? priority
}

export function MobileRunNextConfirmationSheet({
  preview,
  phase,
  errorMessage,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n()
  const copy = t.mobile.maxControl.runNextConfirm
  const priorityLabels = t.maxWorkspace.workQueue.priorities

  return (
    <div className="acMobileRunNextSheet">
      <header className="acMobileRunNextSheetTask">
        <span className="acMobileRunNextSheetEyebrow">{copy.eyebrow}</span>
        <h3 className="acMobileRunNextSheetTitle">{preview.title}</h3>
        <p className="acMobileRunNextSheetText">{preview.taskText}</p>
      </header>

      <dl className="acMobileRunNextSheetMeta">
        <div className="acMobileRunNextSheetRow">
          <dt>{copy.fields.employee}</dt>
          <dd>{preview.employeeName}</dd>
        </div>
        <div className="acMobileRunNextSheetRow">
          <dt>{copy.fields.priority}</dt>
          <dd>{priorityLabel(preview.priority, priorityLabels)}</dd>
        </div>
        {preview.modelLabel ? (
          <div className="acMobileRunNextSheetRow">
            <dt>{copy.fields.model}</dt>
            <dd>{preview.modelLabel}</dd>
          </div>
        ) : null}
      </dl>

      {phase === 'confirm' ? (
        <>
          <section className="acMobileRunNextSheetSection" aria-label={copy.whatWillHappenTitle}>
            <h4 className="acMobileRunNextSheetSectionTitle">{copy.whatWillHappenTitle}</h4>
            <ul className="acMobileRunNextSheetList">
              {copy.whatWillHappen.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <div className="acMobileRunNextSheetWarning" role="note">
            <p className="acMobileRunNextSheetWarningTitle">{copy.warningTitle}</p>
            <ul className="acMobileRunNextSheetList acMobileRunNextSheetWarningList">
              {copy.warningItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="acMobileRunNextSheetActions">
            <button type="button" className="acMobilePrimaryBtn" onClick={onConfirm}>
              {copy.confirm}
            </button>
            <button type="button" className="acMobileSecondaryBtn" onClick={onCancel}>
              {copy.cancel}
            </button>
          </div>
        </>
      ) : null}

      {phase === 'running' ? (
        <div className="acMobileRunNextSheetStatus acMobileRunNextSheetStatusRunning" role="status">
          <p className="acMobileRunNextSheetStatusTitle">{copy.runningTitle}</p>
          <p className="acMobileRunNextSheetStatusDescription">{copy.runningDescription}</p>
        </div>
      ) : null}

      {phase === 'success' ? (
        <div className="acMobileRunNextSheetStatus acMobileRunNextSheetStatusSuccess" role="status">
          <p className="acMobileRunNextSheetStatusTitle">{copy.successTitle}</p>
          <p className="acMobileRunNextSheetStatusDescription">{copy.successDescription}</p>
          <div className="acMobileRunNextSheetActions">
            <Link to={MOBILE_PATHS.reports} className="acMobilePrimaryBtn" onClick={onCancel}>
              {copy.openReports}
            </Link>
            <Link to={MOBILE_PATHS.max} className="acMobileSecondaryBtn" onClick={onCancel}>
              {copy.stayOnMax}
            </Link>
          </div>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="acMobileRunNextSheetStatus acMobileRunNextSheetStatusError" role="alert">
          <p className="acMobileRunNextSheetStatusTitle">{copy.errorTitle}</p>
          <p className="acMobileRunNextSheetStatusDescription">
            {errorMessage ?? copy.errorFallback}
          </p>
          {isModelAvailabilityError(errorMessage) ? (
            <p className="acMobileRunNextSheetHint">{copy.modelHint}</p>
          ) : null}
          <div className="acMobileRunNextSheetActions">
            <button type="button" className="acMobileSecondaryBtn" onClick={onCancel}>
              {copy.close}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type FlowProps = {
  preview: MobileRunNextPreview
  runNext: () => Promise<MaxWorkQueueRunResult>
  onClose: () => void
}

export function MobileRunNextSheetFlow({ preview, runNext, onClose }: FlowProps) {
  const [phase, setPhase] = useState<MobileRunNextSheetPhase>('confirm')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConfirm = async () => {
    setPhase('running')
    setErrorMessage(null)
    const result = await runNext()
    if (result.ok) {
      setPhase('success')
      return
    }
    setErrorMessage(result.errorMessage)
    setPhase('error')
  }

  return (
    <MobileRunNextConfirmationSheet
      preview={preview}
      phase={phase}
      errorMessage={errorMessage}
      onConfirm={() => void handleConfirm()}
      onCancel={onClose}
    />
  )
}
