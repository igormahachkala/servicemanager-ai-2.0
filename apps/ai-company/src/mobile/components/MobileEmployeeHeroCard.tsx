import { Link } from 'react-router-dom'
import type { MobileEmployeeProfileSnapshot } from '../hooks/useMobileEmployeeProfile'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export type MobileEmployeeHeroCopy = {
  firstEmployeeBadge?: string
  roleFallback: string
  presenceUnknown: string
  currentTask: string
  openChat: string
  openReports: string
  openToday: string
}

type Props = {
  snapshot: MobileEmployeeProfileSnapshot
  heroCopy: MobileEmployeeHeroCopy
  chatHref?: string
}

const PRESENCE_LABELS: Record<string, string> = {
  offline: 'Не в сети',
  available: 'Доступен',
  busy: 'Занят',
  in_discussion: 'На совещании',
  working: 'Работает',
  waiting_approval: 'Ждёт согласования',
  reviewing: 'На ревью',
  learning: 'Обучение',
  break: 'Перерыв',
}

export function MobileEmployeeHeroCard({
  snapshot,
  heroCopy,
  chatHref = MOBILE_PATHS.chat,
}: Props) {
  const employee = snapshot.employee
  const displayName =
    snapshot.registryProfile?.displayName ??
    employee?.codename ??
    snapshot.employeeId
  const role =
    snapshot.registryProfile?.role.title ??
    employee?.role ??
    heroCopy.roleFallback
  const presenceLabel = snapshot.presence
    ? (PRESENCE_LABELS[snapshot.presence.status] ?? snapshot.presence.status)
    : heroCopy.presenceUnknown

  return (
    <article className="acMobileMaxHero">
      <div className="acMobileMaxHeroAvatar" aria-hidden>
        {displayName.slice(0, 2).toUpperCase()}
      </div>
      <div className="acMobileMaxHeroBody">
        <div className="acMobileMaxHeroTop">
          <h1 className="acMobileMaxHeroName">{displayName}</h1>
          {heroCopy.firstEmployeeBadge ? (
            <span className="acMobileMaxHeroBadge">{heroCopy.firstEmployeeBadge}</span>
          ) : null}
        </div>
        <p className="acMobileMaxHeroRole">{role}</p>
        <div className="acMobileMaxHeroMeta">
          <span className="acMobileMaxHeroStatus">{presenceLabel}</span>
          {snapshot.modelLabel ? (
            <>
              <span className="acMobileMaxHeroSep">·</span>
              <span className="acMobileMaxHeroModel">{snapshot.modelLabel}</span>
            </>
          ) : null}
        </div>
        {snapshot.brainSummary ? (
          <p className="acMobileMaxHeroBrain">{snapshot.brainSummary}</p>
        ) : null}
        {snapshot.operatingDay.currentTask ? (
          <p className="acMobileMaxHeroCurrent">
            {heroCopy.currentTask}: {snapshot.operatingDay.currentTask.title}
          </p>
        ) : null}
      </div>
      <div className="acMobileMaxHeroActions acMobileMaxHeroActionsSecondary">
        <Link to={chatHref} className="acMobilePrimaryBtn acMobileMaxHeroSecondaryBtn">
          {heroCopy.openChat}
        </Link>
        <Link to={MOBILE_PATHS.reports} className="acMobileSecondaryBtn acMobileMaxHeroSecondaryBtn">
          {heroCopy.openReports}
        </Link>
        <Link to={MOBILE_PATHS.today} className="acMobileTertiaryLinkBtn">
          {heroCopy.openToday}
        </Link>
      </div>
    </article>
  )
}
