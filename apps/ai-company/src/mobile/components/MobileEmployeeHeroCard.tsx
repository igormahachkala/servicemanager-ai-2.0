import { Link } from 'react-router-dom'
import type { MobileEmployeeMaxSnapshot } from '../hooks/useMobileEmployeeMax'
import { useI18n } from '../../i18n'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

type Props = {
  snapshot: MobileEmployeeMaxSnapshot
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

export function MobileEmployeeHeroCard({ snapshot }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.maxControl.hero
  const employee = snapshot.employee
  const presenceLabel = snapshot.presence
    ? (PRESENCE_LABELS[snapshot.presence.status] ?? snapshot.presence.status)
    : copy.presenceUnknown

  return (
    <article className="acMobileMaxHero">
      <div className="acMobileMaxHeroAvatar" aria-hidden>
        {employee?.codename.slice(0, 2).toUpperCase() ?? 'MX'}
      </div>
      <div className="acMobileMaxHeroBody">
        <div className="acMobileMaxHeroTop">
          <h1 className="acMobileMaxHeroName">{employee?.codename ?? 'MAX'}</h1>
          <span className="acMobileMaxHeroBadge">{copy.firstEmployeeBadge}</span>
        </div>
        <p className="acMobileMaxHeroRole">{employee?.role ?? copy.roleFallback}</p>
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
            {copy.currentTask}: {snapshot.operatingDay.currentTask.title}
          </p>
        ) : null}
      </div>
      <div className="acMobileMaxHeroActions acMobileMaxHeroActionsSecondary">
        <Link to={MOBILE_PATHS.chat} className="acMobilePrimaryBtn acMobileMaxHeroSecondaryBtn">
          {copy.openChat}
        </Link>
        <Link to={MOBILE_PATHS.reports} className="acMobileSecondaryBtn acMobileMaxHeroSecondaryBtn">
          {copy.openReports}
        </Link>
        <Link to={MOBILE_PATHS.today} className="acMobileTertiaryLinkBtn">
          {copy.openToday}
        </Link>
      </div>
    </article>
  )
}
