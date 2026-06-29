import type { GuidedTermId } from '../../domain/guided'
import { useI18n } from '../../i18n'

type Props = {
  term: GuidedTermId
  label?: string
  compact?: boolean
}

export function TermTooltip({ term, label, compact = false }: Props) {
  const { t } = useI18n()
  const entry = t.guidedExperience.terms[term]

  return (
    <span className={`acTermTooltip${compact ? ' acTermTooltipCompact' : ''}`}>
      {label ?? entry.label}
      <button
        type="button"
        className="acTermTooltipTrigger"
        aria-label={entry.tooltip}
        aria-describedby={`ac-term-tooltip-${term}`}
      >
        ⓘ
      </button>
      <span id={`ac-term-tooltip-${term}`} role="tooltip" className="acTermTooltipBubble">
        {entry.tooltip}
      </span>
    </span>
  )
}
