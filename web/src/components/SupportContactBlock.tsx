import { SUPPORT_MAX_URL, SUPPORT_TELEGRAM_URL } from '../lib/supportUrls'
import '../mobile/mobile.css'

type SupportContactBlockProps = {
  /** Заголовок секции для иерархии заголовков на странице. */
  titleTag?: 'h2' | 'h3' | 'div'
}

export function SupportContactBlock({ titleTag = 'h3' }: SupportContactBlockProps) {
  const titleClass = 'supportContactTitle'
  const titleNode =
    titleTag === 'h2' ? (
      <h2 className={titleClass}>Поддержка</h2>
    ) : titleTag === 'div' ? (
      <div className={titleClass} role="heading" aria-level={3}>
        Поддержка
      </div>
    ) : (
      <h3 className={titleClass}>Поддержка</h3>
    )

  return (
    <div className="supportContactBlock">
      {titleNode}
      <div className="supportContactStack">
        <button
          type="button"
          className="supportContactBtn supportContactBtn--telegram"
          onClick={() => window.open(SUPPORT_TELEGRAM_URL, '_blank')}
        >
          Написать в Telegram
        </button>
        <button
          type="button"
          className="supportContactBtn supportContactBtn--max"
          onClick={() => window.open(SUPPORT_MAX_URL, '_blank')}
        >
          Написать в MAX
        </button>
      </div>
    </div>
  )
}
