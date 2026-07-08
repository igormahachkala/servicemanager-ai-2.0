import { Link } from 'react-router-dom'
import type { EmployeeOperatingDaySnapshot } from '../../domain/employeeOperatingDay'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: EmployeeOperatingDaySnapshot
  onStart: () => void
  onContinue: () => void
  onFinish: () => void
  onPause: () => void
  onResume: () => void
}

function formatWorkHours(minutes: number, hoursLabel: string, minutesLabel: string): string {
  if (minutes <= 0) return `0 ${minutesLabel}`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} ${minutesLabel}`
  if (rest === 0) return `${hours} ${hoursLabel}`
  return `${hours} ${hoursLabel} ${rest} ${minutesLabel}`
}

function StatusBadge(props: { status: EmployeeOperatingDaySnapshot['status'] }) {
  const { t } = useI18n()
  const label = t.employeeOperatingDay.status[props.status]
  return (
    <span className={`acEmployeeOperatingDayStatus acEmployeeOperatingDayStatus--${props.status}`}>
      {label}
    </span>
  )
}

export function EmployeeOperatingDayWorkspace(props: Props) {
  const { t } = useI18n()
  const eod = t.employeeOperatingDay
  const { snapshot, onStart, onContinue, onFinish, onPause, onResume } = props
  const { actions } = snapshot

  return (
    <div className="acEmployeeOperatingDay">
      <section className="acEmployeeOperatingDayHero">
        <div className="acEmployeeOperatingDayHeroMain">
          <div className="acEmployeeOperatingDayHeroTitleRow">
            <h2 className="acEmployeeOperatingDayHeroTitle">{eod.title}</h2>
            <StatusBadge status={snapshot.status} />
          </div>
          <p className="acMuted">
            {eod.heroDescription.replace('{name}', snapshot.employeeLabel)}
          </p>
          <div className="acEmployeeOperatingDayMeta">
            <span className="acMono">{snapshot.dateKey}</span>
            {snapshot.startedAt ? (
              <>
                <span className="acEmployeeOperatingDayMetaSep">·</span>
                <span>
                  {eod.startedAt}: {new Date(snapshot.startedAt).toLocaleTimeString()}
                </span>
              </>
            ) : null}
            {snapshot.finishedAt ? (
              <>
                <span className="acEmployeeOperatingDayMetaSep">·</span>
                <span>
                  {eod.finishedAt}: {new Date(snapshot.finishedAt).toLocaleTimeString()}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="acEmployeeOperatingDayActions">
          {actions.canStart ? (
            <button type="button" className="mcBtn mcBtnPrimary" onClick={onStart}>
              {eod.actions.start}
            </button>
          ) : null}
          {actions.canContinue ? (
            <button type="button" className="mcBtn mcBtnPrimary" onClick={onContinue}>
              {eod.actions.continue}
            </button>
          ) : null}
          {actions.canPause ? (
            <button type="button" className="mcBtn mcBtnSecondary" onClick={onPause}>
              {eod.actions.pause}
            </button>
          ) : null}
          {actions.canResume ? (
            <button type="button" className="mcBtn mcBtnPrimary" onClick={onResume}>
              {eod.actions.resume}
            </button>
          ) : null}
          {actions.canFinish ? (
            <button type="button" className="mcBtn mcBtnSecondary" onClick={onFinish}>
              {eod.actions.finish}
            </button>
          ) : null}
        </div>
      </section>

      <div className="acEmployeeOperatingDayGrid">
        <MetricCard
          label={eod.metrics.workdayStarted}
          value={snapshot.workdayStarted ? eod.yes : eod.no}
        />
        <MetricCard label={eod.metrics.tasksCompleted} value={String(snapshot.tasksCompleted)} />
        <MetricCard label={eod.metrics.tasksRemaining} value={String(snapshot.tasksRemaining)} />
        <MetricCard
          label={eod.metrics.workHours}
          value={formatWorkHours(snapshot.workHoursMinutes, eod.hoursShort, eod.minutesShort)}
        />
        <MetricCard label={eod.metrics.consultations} value={String(snapshot.consultationsCount)} />
        <MetricCard label={eod.metrics.decisions} value={String(snapshot.decisionsCount)} />
        <MetricCard label={eod.metrics.reports} value={String(snapshot.reportsCount)} />
      </div>

      <section className="acEmployeeOperatingDayPanel">
        <h3 className="acEmployeeOperatingDayPanelTitle">{eod.currentTaskTitle}</h3>
        {snapshot.currentTask ? (
          <div className="acEmployeeOperatingDayCurrentTask">
            <div>
              <div className="acEmployeeOperatingDayCurrentTaskTitle">{snapshot.currentTask.title}</div>
              {snapshot.currentTask.summary ? (
                <p className="acMuted">{snapshot.currentTask.summary}</p>
              ) : null}
              <span className="acMono acMuted">{snapshot.currentTask.status}</span>
            </div>
            {snapshot.currentTask.href ? (
              <Link to={snapshot.currentTask.href} className="mcBtn mcBtnSecondary mcBtnSmall">
                {eod.openCurrentTask}
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="acMuted">{eod.noCurrentTask}</p>
        )}
      </section>

      <section className="acEmployeeOperatingDayPanel">
        <h3 className="acEmployeeOperatingDayPanelTitle">{eod.daySummaryTitle}</h3>
        {snapshot.daySummary ? (
          <p className="acEmployeeOperatingDaySummary">{snapshot.daySummary}</p>
        ) : (
          <p className="acMuted">{eod.noDaySummary}</p>
        )}
      </section>
    </div>
  )
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="acEmployeeOperatingDayMetric">
      <div className="acEmployeeOperatingDayMetricLabel">{props.label}</div>
      <div className="acEmployeeOperatingDayMetricValue">{props.value}</div>
    </div>
  )
}
