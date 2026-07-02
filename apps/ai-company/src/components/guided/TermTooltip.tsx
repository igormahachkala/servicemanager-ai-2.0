import { useCallback, useEffect, useId, useState } from 'react'
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
  const { isOpen: helpCenterOpen, openHelpCenter } = useHelpCenter()
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const tooltipId = useId()
  const resolvedId = resolveGlossaryTermId(term) ?? (term as PlatformGlossaryTermId)
  const entry = t.guidedExperience.terms[resolvedId]
  const summary = entry.summary ?? entry.tooltip
  const helpCta = t.guidedExperience.tooltipHelpCta

  const showTooltip = useCallback(() => {
    setTooltipOpen(true)
  }, [])

  const hideTooltip = useCallback(() => {
    setTooltipOpen(false)
  }, [])

  const openTermHelp = useCallback(() => {
    setTooltipOpen(false)
    openHelpCenter(resolvedId)
  }, [openHelpCenter, resolvedId])

  useEffect(() => {
    if (helpCenterOpen) {
      setTooltipOpen(false)
    }
  }, [helpCenterOpen])

  useEffect(() => {
    if (!tooltipOpen || helpCenterOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setTooltipOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [helpCenterOpen, tooltipOpen])

  return (
    <span className={`acTermTooltip${compact ? ' acTermTooltipCompact' : ''}`}>
      {label ?? entry.label}
      <span
        className="acTermTooltipControl"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            hideTooltip()
          }
        }}
      >
        <button
          type="button"
          className="acTermTooltipTrigger"
          aria-label={`${entry.label}: ${summary}. ${helpCta}`}
          aria-expanded={tooltipOpen}
          aria-controls={tooltipId}
          onClick={openTermHelp}
        >
          ⓘ
        </button>
        <span
          id={tooltipId}
          role="tooltip"
          className={`acTermTooltipBubble${tooltipOpen ? ' acTermTooltipBubbleOpen' : ''}`}
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
        >
          <span className="acTermTooltipSummary">{summary}</span>
          <button type="button" className="acTermTooltipCta" onClick={openTermHelp}>
            {helpCta}
          </button>
        </span>
      </span>
    </span>
  )
}
