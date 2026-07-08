import { Link } from 'react-router-dom'
import type { OwnerHomeDecisionItem } from '../../domain/ownerHome'
import { useI18n } from '../../i18n'
import { resolveMobileHref } from '../navigation/mobileHrefResolver'

type MobileOwnerDecisionCardProps = {
  item: OwnerHomeDecisionItem
}

function formatDecisionTime(iso: string | null): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const KIND_TONE: Record<OwnerHomeDecisionItem['kind'], 'warning' | 'error' | 'info' | 'default'> = {
  approval: 'warning',
  cursor_handoff: 'info',
  knowledge_candidate: 'info',
  blocked_task: 'error',
}

export function MobileOwnerDecisionCard({ item }: MobileOwnerDecisionCardProps) {
  const { t } = useI18n()
  const kindLabel = t.ownerHome.decisionKinds[item.kind]
  const time = formatDecisionTime(item.at)
  const tone = KIND_TONE[item.kind]

  return (
    <article className="acMobileOwnerDecisionCard">
      <div className="acMobileOwnerDecisionHead">
        <span className={`acMobileOwnerDecisionKind acMobileOwnerDecisionKind--${tone}`}>
          {kindLabel}
        </span>
        {time ? <span className="acMobileOwnerDecisionTime">{time}</span> : null}
      </div>
      <h3 className="acMobileOwnerDecisionTitle">{item.title}</h3>
      {item.detail ? <p className="acMobileOwnerDecisionDetail">{item.detail}</p> : null}
      <Link to={resolveMobileHref(item.href)} className="acMobileLinkBtn">
        {t.ownerHome.actions.review}
      </Link>
    </article>
  )
}
