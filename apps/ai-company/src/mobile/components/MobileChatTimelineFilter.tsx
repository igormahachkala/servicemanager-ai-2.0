import type { MobileChatTimelineFilterId } from '../chat/mobileChatTimelineTypes'

type Props = {
  value: MobileChatTimelineFilterId
  options: { id: MobileChatTimelineFilterId; label: string }[]
  ariaLabel: string
  onChange: (value: MobileChatTimelineFilterId) => void
}

export function MobileChatTimelineFilter({ value, options, ariaLabel, onChange }: Props) {
  return (
    <div className="acMobileChatTimelineFilter" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            className={`acMobileChatTimelineFilterBtn${active ? ' acMobileChatTimelineFilterBtnActive' : ''}`}
            aria-pressed={active}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
