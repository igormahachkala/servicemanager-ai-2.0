import { MEMORY_FUTURE_CAPABILITIES } from '../../domain/memory/memory'
import { useI18n } from '../../i18n'

export function MemorySummary() {
  const { t } = useI18n()

  return (
    <div className="mcMemorySummary">
      <p className="mcMemorySummaryLead">{t.memoryEngine.summary.lead}</p>
      <p className="mcMemorySummaryNote">{t.memoryEngine.summary.modelIndependent}</p>
      <div className="mcMemoryFutureGrid">
        {MEMORY_FUTURE_CAPABILITIES.map((capability) => (
          <div key={capability} className="mcMemoryFutureItem">
            <span className="mcMemoryFutureBadge">{t.memoryEngine.futureBadge}</span>
            <span className="mcMemoryFutureLabel">{t.memoryEngine.future[capability]}</span>
            <span className="mcMemoryFutureDesc">{t.memoryEngine.futureDesc[capability]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
