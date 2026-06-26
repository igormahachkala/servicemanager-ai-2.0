import type { HandoffChecklistItem } from '../../domain/handoff'
import { useI18n } from '../../i18n'

export function HandoffChecklist({ items }: { items: HandoffChecklistItem[] }) {
  const { t } = useI18n()

  if (items.length === 0) {
    return <p className="mcMuted">{t.handoffEngine.noChecklist}</p>
  }

  return (
    <ul className="acHandoffChecklist">
      {items.map((item) => (
        <li key={item.id} className={item.done ? 'acHandoffChecklistItem acHandoffChecklistItemDone' : 'acHandoffChecklistItem'}>
          <span className="acHandoffChecklistMark" aria-hidden>
            {item.done ? '✓' : '○'}
          </span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
