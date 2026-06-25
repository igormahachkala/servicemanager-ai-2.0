import { useI18n } from '../../i18n'

const FUTURE_KEYS = ['branding', 'subscription', 'marketplace', 'aiWorkforce'] as const

export function CompanyFuturePlaceholders() {
  const { t } = useI18n()

  return (
    <div className="mcFutureGrid">
      {FUTURE_KEYS.map((key) => (
        <article key={key} className="mcFutureCard">
          <div className="mcFutureCardHead">
            <h3 className="mcFutureCardTitle">{t.companyEngine.future[key].title}</h3>
            <span className="mcBadge mcBadgeFuture">{t.workspaces.futureBadge}</span>
          </div>
          <p className="mcMuted">{t.companyEngine.future[key].desc}</p>
        </article>
      ))}
    </div>
  )
}
