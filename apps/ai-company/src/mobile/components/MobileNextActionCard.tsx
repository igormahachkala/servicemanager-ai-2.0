import { Link } from 'react-router-dom'
import type { MobileNextAction, MobileNextActionKind } from '../hooks/useMobileOwnerHome'
import { useI18n } from '../../i18n'

type MobileNextActionCardProps = {
  action: MobileNextAction
}

function isExternalHref(href: string): boolean {
  return href.startsWith('#')
}

export function MobileNextActionCard({ action }: MobileNextActionCardProps) {
  const { t } = useI18n()
  const copy = t.mobile.ownerHome.nextAction[action.kind as MobileNextActionKind]

  const body = (
    <>
      <span className="acMobileNextActionEyebrow">{t.mobile.ownerHome.nextAction.eyebrow}</span>
      <h2 className="acMobileNextActionTitle">{copy.title}</h2>
      <p className="acMobileNextActionDescription">{copy.description}</p>
      <span className="acMobileNextActionCta">{copy.cta}</span>
    </>
  )

  if (isExternalHref(action.href)) {
    return (
      <a href={action.href} className="acMobileNextActionCard">
        {body}
      </a>
    )
  }

  return (
    <Link to={action.href} className="acMobileNextActionCard">
      {body}
    </Link>
  )
}
