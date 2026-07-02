import { Link } from 'react-router-dom'
import type { UxGuidancePageId } from '../../domain/guided'
import { PAGE_GUIDE_TERMS } from '../../domain/guided'
import { useI18n } from '../../i18n'
import { TermTooltip } from './TermTooltip'

type Props = {
  pageId: UxGuidancePageId
}

export function UxGuidancePanel({ pageId }: Props) {
  const { t } = useI18n()
  const guide = t.guidedExperience.pages[pageId]
  const sections = t.guidedExperience.sections
  const terms = PAGE_GUIDE_TERMS[pageId]

  return (
    <aside className="acUxGuidance" aria-label={guide.title}>
      <div className="acUxGuidanceMain">
        <div className="acUxGuidanceIntro">
          <h2 className="acUxGuidanceTitle">{guide.title}</h2>
          <p className="acUxGuidanceHint">
            <span className="acUxGuidanceHintIcon" aria-hidden="true">
              ⓘ
            </span>
            <span>{guide.hint}</span>
          </p>
        </div>

        <div className="acUxGuidanceActions">
          <Link to={guide.learnMorePath} className="acLink acUxGuidanceLearnMore">
            {t.guidedExperience.learnMore} →
          </Link>
          <Link to={guide.docsPath} className="mcBtn mcBtnSecondary mcBtnSm">
            {t.guidedExperience.openDocs}
          </Link>
        </div>

        <dl className="acUxGuidanceDetails">
          <div className="acUxGuidanceDetailRow">
            <dt>{sections.whatItIs}</dt>
            <dd>{guide.whatItIs}</dd>
          </div>
          <div className="acUxGuidanceDetailRow">
            <dt>{sections.purpose}</dt>
            <dd>{guide.purpose}</dd>
          </div>
          <div className="acUxGuidanceDetailRow">
            <dt>{sections.onScreen}</dt>
            <dd>{guide.onScreen}</dd>
          </div>
          <div className="acUxGuidanceDetailRow">
            <dt>{sections.nextStep}</dt>
            <dd>{guide.nextStep}</dd>
          </div>
          <div className="acUxGuidanceDetailRow">
            <dt>{sections.downstream}</dt>
            <dd>{guide.downstream}</dd>
          </div>
        </dl>
      </div>

      {terms.length > 0 ? (
        <div className="acUxGuidanceTerms">
          <span className="acUxGuidanceTermsLabel">{t.guidedExperience.termsLabel}</span>
          <div className="acUxGuidanceTermsList">
            {terms.map((term) => (
              <TermTooltip key={term} term={term} compact />
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

export const PageGuideCard = UxGuidancePanel
