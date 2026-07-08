import { useI18n } from '../../i18n'
import { MobileDecisionCard } from '../components/MobileDecisionCard'
import { MobileDecisionFilters, MobileDecisionsEmptyState } from '../components/MobileDecisionFilters'
import { useMobileOwnerDecisions } from '../hooks/useMobileOwnerDecisions'

export function MobileDecisionsPage() {
  const { t } = useI18n()
  const { filter, setFilter, items, counts, approve, reject } = useMobileOwnerDecisions()

  return (
    <div className="acMobileDecisionsPage">
      <p className="acMobileDecisionsIntro">{t.mobile.decisions.intro}</p>

      <MobileDecisionFilters filter={filter} counts={counts} onChange={setFilter} />

      {items.length === 0 ? (
        <MobileDecisionsEmptyState filter={filter} />
      ) : (
        <div className="acMobileDecisionsList">
          {items.map((item) => (
            <MobileDecisionCard
              key={item.id}
              item={item}
              onApprove={approve}
              onReject={reject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
