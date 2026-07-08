import { Link } from 'react-router-dom'
import type { EmployeeOperatingDaySnapshot } from '../../domain/employeeOperatingDay'
import { useI18n } from '../../i18n'
import { MobileCard } from './MobileCard'

type Props = {
  operatingDay: EmployeeOperatingDaySnapshot
  onStart: () => void
  onContinue: () => void
  onFinish: () => void
}

function formatWorkHours(minutes: number, hoursShort: string, minutesShort: string): string {
  if (minutes <= 0) return `0 ${minutesShort}`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${rest} ${minutesShort}`
  return `${hours} ${hoursShort} ${rest} ${minutesShort}`
}

export function MobileEmployeeWorkdayCard({
  operatingDay,
  onStart,
  onContinue,
  onFinish,
}: Props) {
  const { t } = useI18n()
  const od = t.employeeOperatingDay
  const copy = t.mobile.maxControl.workday
  const statusLabel = od.status[operatingDay.status]
  const statusTone =
    operatingDay.status === 'active'
      ? 'success'
      : operatingDay.status === 'paused'
        ? 'warning'
        : operatingDay.status === 'finished'
          ? 'info'
          : 'default'

  const continueHref =
    operatingDay.continueHref ?? `/ops/employees/${operatingDay.employeeId}/today`

  return (
    <MobileCard
      title={copy.title}
      description={copy.description}
      status={{ label: statusLabel, tone: statusTone }}
    >
      <dl className="acMobileMaxMetrics">
        <div className="acMobileMaxMetric">
          <dt>{od.metrics.tasksCompleted}</dt>
          <dd>{operatingDay.tasksCompleted}</dd>
        </div>
        <div className="acMobileMaxMetric">
          <dt>{od.metrics.tasksRemaining}</dt>
          <dd>{operatingDay.tasksRemaining}</dd>
        </div>
        <div className="acMobileMaxMetric">
          <dt>{od.metrics.workHours}</dt>
          <dd>
            {formatWorkHours(
              operatingDay.workHoursMinutes,
              od.hoursShort,
              od.minutesShort,
            )}
          </dd>
        </div>
      </dl>

      <div className="acMobileCardActions">
        {operatingDay.actions.canStart ? (
          <button type="button" className="acMobilePrimaryBtn" onClick={onStart}>
            {od.actions.start}
          </button>
        ) : null}
        {operatingDay.actions.canContinue ? (
          <>
            <Link to={continueHref} className="acMobileLinkBtn">
              {od.actions.continue}
            </Link>
            <button type="button" className="acMobileSecondaryBtn" onClick={onContinue}>
              {copy.advancePhase}
            </button>
          </>
        ) : null}
        {operatingDay.actions.canFinish ? (
          <button type="button" className="acMobileSecondaryBtn" onClick={onFinish}>
            {od.actions.finish}
          </button>
        ) : null}
        {!operatingDay.actions.canStart &&
        !operatingDay.actions.canContinue &&
        !operatingDay.actions.canFinish ? (
          <Link
            to={`/ops/employees/${operatingDay.employeeId}/today`}
            className="acMobileLinkBtn"
          >
            {copy.openDesktopToday}
          </Link>
        ) : null}
      </div>
    </MobileCard>
  )
}
