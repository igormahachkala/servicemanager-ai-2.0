import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ContextEmptyArea, ContextEmptyVariant } from '../../domain/emptyStates/contextEmptyState'
import { CONTEXT_EMPTY_ROUTES } from '../../domain/emptyStates/contextEmptyState'
import { useI18n } from '../../i18n'

type ContextEmptyCopy = {
  title: string
  reason: string
  actionHint: string
  actionLabel: string
  example: string
}

export function ContextEmptyState(props: {
  area: ContextEmptyArea
  variant?: ContextEmptyVariant
  action?: ReactNode
  actionHref?: string
  compact?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const variant = props.variant ?? 'initial'
  const areaCopy = t.contextEmpty[props.area] as Record<ContextEmptyVariant, ContextEmptyCopy>
  const copy = areaCopy[variant] ?? areaCopy.initial
  const actionHref = props.actionHref ?? CONTEXT_EMPTY_ROUTES[props.area]
  const className = ['acContextEmpty', props.compact ? 'acContextEmptyCompact' : null, props.className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <h3 className="acContextEmptyTitle">{copy.title}</h3>

      <div className="acContextEmptyBlock">
        <span className="acContextEmptyLabel">{t.contextEmpty.sections.whyEmpty}</span>
        <p className="acContextEmptyText">{copy.reason}</p>
      </div>

      <div className="acContextEmptyBlock">
        <span className="acContextEmptyLabel">{t.contextEmpty.sections.whatToDo}</span>
        <p className="acContextEmptyText">{copy.actionHint}</p>
      </div>

      <div className="acContextEmptyAction">
        {props.action ?? (
          <Link to={actionHref} className="mcBtn mcBtnPrimary">
            {copy.actionLabel}
          </Link>
        )}
      </div>

      <div className="acContextEmptyExample">
        <span className="acContextEmptyLabel">{t.contextEmpty.sections.example}</span>
        <p className="acContextEmptyExampleText">{copy.example}</p>
      </div>
    </div>
  )
}
