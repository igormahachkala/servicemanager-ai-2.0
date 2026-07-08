import { Link } from 'react-router-dom'
import type { MobileOwnerDecisionFilter } from '../../domain/mobileOwnerDecisions'
import { useI18n } from '../../i18n'

const FILTER_IDS: MobileOwnerDecisionFilter[] = [
  'all',
  'approval',
  'cursor',
  'knowledge',
  'blocked',
]

type Props = {
  filter: MobileOwnerDecisionFilter
  counts: Record<MobileOwnerDecisionFilter, number>
  onChange: (filter: MobileOwnerDecisionFilter) => void
}

export function MobileDecisionFilters({ filter, counts, onChange }: Props) {
  const { t } = useI18n()
  const labels = t.mobile.decisions.filters

  return (
    <div className="acMobileDecisionFilters" role="tablist" aria-label={t.mobile.decisions.filtersAria}>
      {FILTER_IDS.map((id) => {
        const active = filter === id
        const count = counts[id]
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'acMobileDecisionFilter acMobileDecisionFilterActive' : 'acMobileDecisionFilter'}
            onClick={() => onChange(id)}
          >
            {labels[id]}
            {count > 0 ? <span className="acMobileDecisionFilterCount">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

type EmptyProps = {
  filter: MobileOwnerDecisionFilter
}

export function MobileDecisionsEmptyState({ filter }: EmptyProps) {
  const { t } = useI18n()
  const copy = t.mobile.decisions.empty

  return (
    <section className="acMobileDecisionsEmpty" aria-label={copy.title}>
      <div className="acMobileEmptyStateIcon" aria-hidden>
        <svg viewBox="0 0 48 48" className="acMobileEmptyStateSvg">
          <path
            d="M14 24l6 6 14-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <h2 className="acMobileDecisionsEmptyTitle">{copy.title}</h2>
      <p className="acMobileDecisionsEmptyDescription">
        {filter === 'all' ? copy.description : copy.filteredDescription}
      </p>
      <Link to="/mobile/today" className="acMobilePrimaryBtn acMobileDecisionsEmptyCta">
        {copy.backToToday}
      </Link>
    </section>
  )
}
