import { useId, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getDocsArticleBySlug } from '../../docs-center/docsCatalog'
import { getDocsBasePath } from '../../docs-center/docsPaths'
import './context-help.css'

export type ContextHelpProps = {
  /** Заголовок блока. */
  title?: string
  /** Что это — короткое определение раздела. */
  whatIsThis: ReactNode
  /** Для чего используется. */
  purpose: ReactNode
  /** Что сейчас происходит — динамическое состояние текущего экрана. */
  currentState?: ReactNode
  /** Следующий шаг для пользователя. */
  nextStep?: ReactNode
  /**
   * Slug статьи Documentation Center для ссылки «Подробнее».
   * Слабая связь: хранится только строка; валидируется по каталогу.
   */
  docSlug?: string
  /** Якорь внутри статьи Documentation Center. */
  docAnchorId?: string
  /** Подпись ссылки «Подробнее». */
  moreLabel?: string
  /** Открыт ли блок по умолчанию. */
  defaultOpen?: boolean
  /** Доп. класс для точечной раскладки на конкретной странице. */
  className?: string
}

/**
 * Context Help V1 — переиспользуемый блок подсказки для любого крупного экрана
 * (desktop / mobile / MAX). Ссылка «Подробнее» ведёт в Documentation Center и
 * учитывает текущий runtime через getDocsBasePath (остаётся в своём shell).
 * Если статья не найдена — fallback на индекс Documentation Center того же runtime.
 */
export function ContextHelp({
  title = 'Подсказка по разделу',
  whatIsThis,
  purpose,
  currentState,
  nextStep,
  docSlug,
  docAnchorId,
  moreLabel = 'Подробнее',
  defaultOpen = false,
  className,
}: ContextHelpProps) {
  const location = useLocation()
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  const docsBase = getDocsBasePath(location.pathname)
  const article = docSlug ? getDocsArticleBySlug(docSlug) : undefined
  const anchor = article && docAnchorId ? article.anchors.find((item) => item.id === docAnchorId) : undefined
  const moreHref = article
    ? `${docsBase}/${article.slug}${anchor ? `#${anchor.id}` : ''}`
    : docsBase

  return (
    <aside className={`contextHelp${className ? ` ${className}` : ''}`} aria-label="Контекстная помощь">
      <button
        type="button"
        className="contextHelpToggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="contextHelpIcon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.8.3-1.4 1-1.4 1.9v.3" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <span className="contextHelpTitle">{title}</span>
        <span className={`contextHelpChevron${open ? ' contextHelpChevron--open' : ''}`} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      <div id={bodyId} className="contextHelpBody" hidden={!open}>
        <dl className="contextHelpList">
          <div className="contextHelpItem">
            <dt>Что это</dt>
            <dd>{whatIsThis}</dd>
          </div>
          <div className="contextHelpItem">
            <dt>Для чего используется</dt>
            <dd>{purpose}</dd>
          </div>
          {currentState != null ? (
            <div className="contextHelpItem">
              <dt>Что сейчас происходит</dt>
              <dd>{currentState}</dd>
            </div>
          ) : null}
          {nextStep != null ? (
            <div className="contextHelpItem">
              <dt>Следующий шаг</dt>
              <dd>{nextStep}</dd>
            </div>
          ) : null}
        </dl>
        <Link className="contextHelpMore" to={moreHref}>
          {moreLabel}
          <span aria-hidden> →</span>
        </Link>
      </div>
    </aside>
  )
}
