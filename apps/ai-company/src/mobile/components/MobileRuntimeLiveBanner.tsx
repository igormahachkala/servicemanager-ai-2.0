import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { mobileRuntimeLoopHref } from '../navigation/mobileHrefResolver'

type MobileRuntimeLiveBannerProps = {
  loopId: string
  taskTitle: string
}

export function MobileRuntimeLiveBanner({ loopId, taskTitle }: MobileRuntimeLiveBannerProps) {
  const { t } = useI18n()
  const copy = t.mobile.runtimeLive.banner
  const href = mobileRuntimeLoopHref(loopId)

  return (
    <section className="acMobileRuntimeLiveBanner" aria-label={copy.title}>
      <div className="acMobileRuntimeLiveBannerText">
        <p className="acMobileRuntimeLiveBannerEyebrow">{copy.eyebrow}</p>
        <p className="acMobileRuntimeLiveBannerTitle">{taskTitle}</p>
        <p className="acMobileRuntimeLiveBannerHint">{copy.hint}</p>
      </div>
      <Link to={href} className="acMobilePrimaryBtn acMobileRuntimeLiveBannerBtn">
        {copy.action}
      </Link>
    </section>
  )
}
