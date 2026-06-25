import type { MemoryEntry } from '../../domain/memory/memoryEntry'
import { MemoryCard } from './MemoryCard'
import { useI18n } from '../../i18n'

export function MemoryTimeline({ entries }: { entries: MemoryEntry[] }) {
  const { t } = useI18n()

  if (entries.length === 0) {
    return (
      <div className="mcMemoryEmpty">
        <div className="mcMemoryEmptyTitle">{t.memoryEngine.emptyTitle}</div>
        <p className="mcMemoryEmptyDesc">{t.memoryEngine.emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="mcMemoryTimeline">
      {entries.map((entry) => (
        <MemoryCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
