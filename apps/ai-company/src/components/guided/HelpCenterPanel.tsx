import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PLATFORM_GLOSSARY_TERM_IDS,
  type PlatformGlossaryTermId,
} from '../../domain/guided/platformGlossary'
import { useHelpCenter } from '../../hooks/useHelpCenter'
import { useI18n } from '../../i18n'

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

export function HelpCenterPanel() {
  const { t } = useI18n()
  const { isOpen, selectedTermId, closeHelpCenter, selectTerm } = useHelpCenter()
  const copy = t.guidedExperience.helpCenter
  const sections = t.guidedExperience.termSections
  const terms = t.guidedExperience.terms
  const [query, setQuery] = useState('')

  const activeTermId = selectedTermId ?? PLATFORM_GLOSSARY_TERM_IDS[0]

  const filteredTermIds = useMemo(() => {
    const needle = normalizeSearch(query)
    if (!needle) return PLATFORM_GLOSSARY_TERM_IDS
    return PLATFORM_GLOSSARY_TERM_IDS.filter((termId) => {
      const entry = terms[termId]
      if (!entry) return false
      const haystack = [
        entry.label,
        entry.summary,
        entry.description,
        entry.whereUsed,
        ...entry.related.map((item) => item.label),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, terms])

  const activeEntry = terms[activeTermId]

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHelpCenter()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeHelpCenter, isOpen])

  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !selectedTermId) return
    if (!filteredTermIds.includes(selectedTermId) && filteredTermIds.length > 0) {
      selectTerm(filteredTermIds[0] as PlatformGlossaryTermId)
    }
  }, [filteredTermIds, isOpen, selectTerm, selectedTermId])

  if (!isOpen) return null

  return (
    <div className="acHelpCenterRoot" role="presentation">
      <div
        className="acHelpCenterBackdrop"
        aria-hidden="true"
        onClick={closeHelpCenter}
      />
      <section
        className="acHelpCenterPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ac-help-center-title"
      >
        <header className="acHelpCenterHeader">
          <div>
            <h2 id="ac-help-center-title" className="acHelpCenterTitle">
              {copy.title}
            </h2>
            <p className="acHelpCenterSubtitle">{copy.subtitle}</p>
          </div>
          <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" onClick={closeHelpCenter}>
            {copy.close}
          </button>
        </header>

        <div className="acHelpCenterSearchRow">
          <input
            type="search"
            className="acHelpCenterSearch"
            value={query}
            placeholder={copy.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={copy.searchPlaceholder}
          />
        </div>

        <div className="acHelpCenterBody">
          <nav className="acHelpCenterNav" aria-label={copy.allTerms}>
            <ul className="acHelpCenterNavList">
              {filteredTermIds.map((termId) => {
                const entry = terms[termId]
                const isActive = termId === activeTermId
                return (
                  <li key={termId}>
                    <button
                      type="button"
                      className={`acHelpCenterNavItem${isActive ? ' acHelpCenterNavItemActive' : ''}`}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => selectTerm(termId)}
                    >
                      <span className="acHelpCenterNavLabel">{entry.label}</span>
                      <span className="acHelpCenterNavSummary">{entry.summary}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {filteredTermIds.length === 0 ? (
              <p className="acHelpCenterEmpty">{copy.noResults}</p>
            ) : null}
          </nav>

          <article className="acHelpCenterDetail" aria-live="polite">
            {activeEntry ? (
              <>
                <h3 className="acHelpCenterDetailTitle">{activeEntry.label}</h3>
                <dl className="acHelpCenterDetailList">
                  <div className="acHelpCenterDetailRow">
                    <dt>{sections.summary}</dt>
                    <dd>{activeEntry.summary}</dd>
                  </div>
                  <div className="acHelpCenterDetailRow">
                    <dt>{sections.description}</dt>
                    <dd>{activeEntry.description}</dd>
                  </div>
                  <div className="acHelpCenterDetailRow">
                    <dt>{sections.whereUsed}</dt>
                    <dd>{activeEntry.whereUsed}</dd>
                  </div>
                  <div className="acHelpCenterDetailRow">
                    <dt>{sections.related}</dt>
                    <dd>
                      <ul className="acHelpCenterRelatedList">
                        {activeEntry.related.map((item) => (
                          <li key={`${activeTermId}-${item.path}`}>
                            <Link
                              to={item.path}
                              className="acLink"
                              onClick={closeHelpCenter}
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="acHelpCenterEmpty">{copy.selectTerm}</p>
            )}
          </article>
        </div>
      </section>
    </div>
  )
}
