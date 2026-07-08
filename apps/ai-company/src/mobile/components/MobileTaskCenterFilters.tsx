import { useI18n } from '../../i18n'
import type { MobileTaskCenterFilter } from '../tasks/mobileTasksCenterViewModel'

const FILTER_IDS: MobileTaskCenterFilter[] = ['all', 'active', 'queue', 'completed', 'errors']

type Props = {
  filter: MobileTaskCenterFilter
  counts: Record<MobileTaskCenterFilter, number>
  onChange: (filter: MobileTaskCenterFilter) => void
}

export function MobileTaskCenterFilters({ filter, counts, onChange }: Props) {
  const { t } = useI18n()
  const labels = t.mobile.tasksCenter.filters

  return (
    <div className="acMobileTaskCenterFilters" role="tablist" aria-label={t.mobile.tasksCenter.filtersAria}>
      {FILTER_IDS.map((id) => {
        const active = filter === id
        const count = counts[id]
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={
              active ? 'acMobileTaskCenterFilter acMobileTaskCenterFilterActive' : 'acMobileTaskCenterFilter'
            }
            onClick={() => onChange(id)}
          >
            {labels[id]}
            {count > 0 ? <span className="acMobileTaskCenterFilterCount">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
