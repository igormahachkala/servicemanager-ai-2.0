import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

type MobileStandardTaskQuickStartProps = {
  className?: string
}

export function MobileStandardTaskQuickStart({ className }: MobileStandardTaskQuickStartProps) {
  const { t } = useI18n()
  const copy = t.mobile.standardTask

  return (
    <section
      className={className ? `acMobileStandardTask ${className}` : 'acMobileStandardTask'}
      aria-label={copy.title}
    >
      <div className="acMobileStandardTaskBody">
        <p className="acMobileStandardTaskEyebrow">{copy.eyebrow}</p>
        <h2 className="acMobileStandardTaskTitle">{copy.title}</h2>
        <p className="acMobileStandardTaskDescription">{copy.description}</p>
      </div>
      <Link to={MOBILE_PATHS.standardTaskNewMax} className="acMobilePrimaryBtn acMobileStandardTaskCta">
        {copy.action}
      </Link>
    </section>
  )
}
