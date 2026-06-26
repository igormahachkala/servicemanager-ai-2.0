import { Link } from 'react-router-dom'
import type { Handoff } from '../../domain/handoff'
import { useI18n } from '../../i18n'
import { HandoffTargetBadge } from './HandoffTargetBadge'

export function HandoffCard({
  handoff,
  selected = false,
  compact = false,
  onSelect,
}: {
  handoff: Handoff
  selected?: boolean
  compact?: boolean
  onSelect?: (id: string) => void
}) {
  const { t } = useI18n()
  const content = (
    <article className={`acHandoffCard${selected ? ' acHandoffCardSelected' : ''}${compact ? ' acHandoffCardCompact' : ''}`}>
      <div className="acHandoffCardHead">
        <div>
          <h3 className="acHandoffCardTitle">{handoff.title}</h3>
          {!compact ? <p className="mcMuted acHandoffCardDescription">{handoff.description}</p> : null}
        </div>
        <HandoffTargetBadge target={handoff.target} compact />
      </div>
      <div className="acHandoffCardMeta">
        <span className={`acHandoffStatus acHandoffStatus${capitalize(handoff.status)}`}>
          {t.handoffEngine.statuses[handoff.status]}
        </span>
        <span className="mcMono mcMuted">{handoff.priority}</span>
        <span className="mcMono mcMuted">{handoff.context.employeeCodename}</span>
      </div>
    </article>
  )

  if (onSelect) {
    return (
      <button type="button" className="acHandoffCardButton" onClick={() => onSelect(handoff.id)}>
        {content}
      </button>
    )
  }

  return (
    <Link to={`/ops/handoffs/${handoff.id}`} className="acHandoffCardLink">
      {content}
    </Link>
  )
}

function capitalize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
