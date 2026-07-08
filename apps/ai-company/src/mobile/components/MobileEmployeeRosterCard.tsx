import { Link } from 'react-router-dom'
import type { MobileEmployeeRosterEntry } from '../hooks/useMobileEmployeesRoster'
import { useI18n } from '../../i18n'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

type Props = {
  entry: MobileEmployeeRosterEntry
}

const PRESENCE_LABELS: Record<string, string> = {
  offline: 'Не в сети',
  available: 'Доступен',
  busy: 'Занят',
  in_discussion: 'На совещании',
  working: 'Работает',
  waiting_approval: 'Ждёт решения',
  reviewing: 'На ревью',
  learning: 'Обучение',
  break: 'Перерыв',
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileEmployeeRosterCard({ entry }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.employeesRoster
  const slotCopy = copy.slots[entry.slotId]
  const isActive = entry.availability === 'active'

  const codename = slotCopy?.codename ?? entry.codename
  const role = slotCopy?.role ?? entry.role
  const statusLabel = isActive
    ? entry.presenceStatus
      ? (PRESENCE_LABELS[entry.presenceStatus] ?? entry.presenceStatus)
      : copy.presence.unknown
    : copy.placeholderBadge

  const workdayLabel =
    entry.workdayStatus === 'unavailable'
      ? copy.workdayStatus.unavailable
      : copy.workdayStatus[entry.workdayStatus]

  return (
    <article
      className={
        isActive
          ? 'acMobileRosterCard acMobileRosterCardActive'
          : 'acMobileRosterCard acMobileRosterCardPlaceholder'
      }
    >
      <header className="acMobileRosterCardHead">
        <div className="acMobileRosterCardAvatar" aria-hidden>
          {codename.slice(0, 2).toUpperCase()}
        </div>
        <div className="acMobileRosterCardIntro">
          <div className="acMobileRosterCardTitleRow">
            <h3 className="acMobileRosterCardName">{codename}</h3>
            <span
              className={
                isActive ? 'acMobileRosterBadge acMobileRosterBadgeActive' : 'acMobileRosterBadge'
              }
            >
              {isActive ? copy.activeBadge : copy.placeholderBadge}
            </span>
          </div>
          <p className="acMobileRosterCardRole">{role}</p>
        </div>
      </header>

      <dl className="acMobileRosterMetrics">
        <div className="acMobileRosterMetric">
          <dt>{copy.metrics.status}</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div className="acMobileRosterMetric">
          <dt>{copy.metrics.workday}</dt>
          <dd>{workdayLabel}</dd>
        </div>
        <div className="acMobileRosterMetric">
          <dt>{copy.metrics.queue}</dt>
          <dd>{isActive ? entry.queueCount : copy.metrics.unavailableValue}</dd>
        </div>
        <div className="acMobileRosterMetric">
          <dt>{copy.metrics.decisions}</dt>
          <dd>{isActive ? entry.pendingDecisions : copy.metrics.unavailableValue}</dd>
        </div>
      </dl>

      <div className="acMobileRosterResult">
        <div className="acMobileRosterResultLabel">{copy.metrics.lastResult}</div>
        {entry.lastResultTitle ? (
          <>
            <div className="acMobileRosterResultTitle">{entry.lastResultTitle}</div>
            {formatWhen(entry.lastResultAt) ? (
              <time className="acMobileRosterResultTime">{formatWhen(entry.lastResultAt)}</time>
            ) : null}
          </>
        ) : (
          <p className="acMobileRosterResultEmpty">{copy.emptyResult}</p>
        )}
      </div>

      <div className="acMobileRosterActions">
        {isActive ? (
          <>
            <Link
              to={`/mobile/employees/${entry.mobileRouteId}`}
              className="acMobilePrimaryBtn acMobileRosterPrimaryAction"
            >
              {copy.actions.open}
            </Link>
            <Link
              to={`/mobile/tasks/new?employee=${encodeURIComponent(entry.employeeId)}`}
              className="acMobileSecondaryBtn"
            >
              {copy.actions.assignTask}
            </Link>
            <Link
              to={MOBILE_PATHS.max}
              className="acMobileSecondaryBtn"
            >
              {copy.actions.today}
            </Link>
          </>
        ) : (
          <button type="button" className="acMobileSecondaryBtn" disabled>
            {copy.actions.comingSoon}
          </button>
        )}
      </div>
    </article>
  )
}
