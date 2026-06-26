import { WORKDAY_PHASES, type WorkdayPhase } from '../../domain/workday'
import { useI18n } from '../../i18n'

export function WorkdayPhaseTracker(props: { currentPhase: WorkdayPhase }) {
  const { t } = useI18n()
  const currentIndex = WORKDAY_PHASES.indexOf(props.currentPhase)

  return (
    <div className="acWorkdayPhaseTrack">
      {WORKDAY_PHASES.map((phase, index) => {
        const done = index < currentIndex
        const active = phase === props.currentPhase
        const className = [
          'acWorkdayPhaseStep',
          done ? 'acWorkdayPhaseStepDone' : '',
          active ? 'acWorkdayPhaseStepActive' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div key={phase} className={className}>
            <span className="acWorkdayPhaseDot" aria-hidden />
            <span className="acWorkdayPhaseLabel">{t.workdayEngine.phases[phase]}</span>
          </div>
        )
      })}
    </div>
  )
}
