import type { MemoryEntry } from '../../domain/memory/memoryEntry'
import { MemoryCard } from './MemoryCard'
import { ContextEmptyState } from '../empty-states'

export function MemoryTimeline({
  entries,
  variant = 'initial',
}: {
  entries: MemoryEntry[]
  variant?: 'initial' | 'filtered'
}) {
  if (entries.length === 0) {
    return <ContextEmptyState area="memory" variant={variant} compact />
  }

  return (
    <div className="mcMemoryTimeline">
      {entries.map((entry) => (
        <MemoryCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
