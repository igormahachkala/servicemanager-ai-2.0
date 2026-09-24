import {
  categoryGuidanceRootClassName,
  getCategoryGuidance,
} from '../lib/categoryGuidance'

type Props = {
  categoryName: string | null | undefined
  variant: 'desktop' | 'mobile'
  /** Только нумерованный список шагов (без заголовка из каталога) — для экрана после создания заявки. */
  stepsOnly?: boolean
}

/** Подсказки заказчику по категории заявки (без модалок). */
export function CategoryGuidancePanel({ categoryName, variant, stepsOnly }: Props) {
  const g = getCategoryGuidance(categoryName)
  const titleClass = variant === 'mobile' ? 'mobileCategoryGuidanceTitle' : 'categoryGuidanceTitle'
  const listClass = variant === 'mobile' ? 'mobileCategoryGuidanceList' : 'categoryGuidanceList'

  if (stepsOnly) {
    return (
      <div
        className={categoryGuidanceRootClassName(g.level, variant)}
        role="region"
        aria-label="До приезда техника"
      >
        <ol className={listClass}>
          {g.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className={categoryGuidanceRootClassName(g.level, variant)} role="region" aria-label={g.title}>
      <div className={titleClass}>{g.title}</div>
      <ol className={listClass}>
        {g.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}
