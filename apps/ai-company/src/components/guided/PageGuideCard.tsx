import { Link } from 'react-router-dom'
import type { GuidedPageId } from '../../domain/guided'
import { PAGE_GUIDE_TERMS } from '../../domain/guided'
import { useI18n } from '../../i18n'
import { TermTooltip } from './TermTooltip'

type Props = {
  pageId: GuidedPageId
}

export function PageGuideCard({ pageId }: Props) {
  const { t } = useI18n()
  const guide = t.guidedExperience.pages[pageId]
  const terms = PAGE_GUIDE_TERMS[pageId]

  return (
    <aside className="acPageGuide" aria-label={guide.title}>
      <div className="acPageGuideMain">
        <h2 className="acPageGuideTitle">{guide.title}</h2>
        <p className="acPageGuideDescription">{guide.description}</p>
        <p className="acPageGuideNext">
          <span className="acPageGuideNextLabel">{t.guidedExperience.nextStepLabel}</span>
          {guide.nextStep}
        </p>
        <Link to={guide.learnMorePath} className="acPageGuideLearnMore acLink">
          {t.guidedExperience.learnMore} →
        </Link>
      </div>
      {terms.length > 0 ? (
        <div className="acPageGuideTerms">
          <span className="acPageGuideTermsLabel">{t.guidedExperience.termsLabel}</span>
          <div className="acPageGuideTermsList">
            {terms.map((term) => (
              <TermTooltip key={term} term={term} compact />
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
