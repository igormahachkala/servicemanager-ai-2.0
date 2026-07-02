import type { PlatformGlossaryTermId } from '../../domain/guided/platformGlossary'
import { resolveGlossaryTermId } from '../../domain/guided/platformGlossary'
import { useHelpCenter } from '../../hooks/useHelpCenter'
import { useI18n } from '../../i18n'

type Props = {
  term: PlatformGlossaryTermId | 'memoryEvolution' | 'prompt'
  label?: string
  compact?: boolean
}

export function TermTooltip({ term, label, compact = false }: Props) {
  const { t } = useI18n()
  const { openHelpCenter } = useHelpCenter()
  const resolvedId = resolveGlossaryTermId(term) ?? (term as PlatformGlossaryTermId)
  const entry = t.guidedExperience.terms[resolvedId]
  const summary = entry.summary ?? entry.tooltip

  return (
    <span className={`acTermTooltip${compact ? ' acTermTooltipCompact' : ''}`}>
      {label ?? entry.label}
      <button
        type="button"
        className="acTermTooltipTrigger"
        aria-label={`${entry.label}: ${summary}. ${t.guidedExperience.openTermInHelp}`}
        aria-describedby={`ac-term-tooltip-${resolvedId}`}
        onClick={() => openHelpCenter(resolvedId)}
      >
        ⓘ
      </button>
      <span id={`ac-term-tooltip-${resolvedId}`} role="tooltip" className="acTermTooltipBubble">
        <span className="acTermTooltipSummary">{summary}</span>
        <span className="acTermTooltipMore">{t.guidedExperience.openTermInHelp}</span>
      </span>
    </span>
  )
}
