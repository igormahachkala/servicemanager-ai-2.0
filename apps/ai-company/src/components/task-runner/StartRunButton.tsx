import { useI18n } from '../../i18n'

type Props = {
  disabled: boolean
  running: boolean
  onStart: () => void
}

export function StartRunButton({ disabled, running, onStart }: Props) {
  const { t } = useI18n()

  return (
    <div className="mcTaskRunnerStartRow">
      <button
        type="button"
        className="mcBtn mcBtnPrimary mcTaskRunnerStartBtn"
        disabled={disabled || running}
        onClick={onStart}
      >
        {running ? t.taskRunner.actions.starting : t.taskRunner.actions.start}
      </button>
      <p className="mcMuted">{t.taskRunner.startNote}</p>
    </div>
  )
}
