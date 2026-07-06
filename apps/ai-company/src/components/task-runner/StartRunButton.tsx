import { useI18n } from '../../i18n'

type Props = {
  disabled: boolean
  running: boolean
  onStart: () => void
  startLabel?: string
  startNote?: string
}

export function StartRunButton({
  disabled,
  running,
  onStart,
  startLabel,
  startNote,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="mcTaskRunnerStartRow">
      <button
        type="button"
        className="mcBtn mcBtnPrimary mcTaskRunnerStartBtn"
        disabled={disabled || running}
        onClick={onStart}
      >
        {running
          ? t.taskRunner.actions.starting
          : startLabel ?? t.taskRunner.actions.start}
      </button>
      <p className="mcMuted">{startNote ?? t.taskRunner.startNote}</p>
    </div>
  )
}
