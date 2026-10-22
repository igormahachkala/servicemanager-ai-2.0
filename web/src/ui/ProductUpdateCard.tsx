import { Link } from 'react-router-dom'

import type { ProductUpdate } from '../lib/api'
import { audienceLabel, formatUpdateDate, paragraphs, safeFeaturePath, visibleMedia } from '../lib/productUpdates'

type CardContent = Pick<
  ProductUpdate,
  'title' | 'summary' | 'changes' | 'howToUse' | 'featurePath' | 'media' | 'audienceRoles' | 'publishedAt'
>

function Section({ title, text }: { title: string; text: string }) {
  const items = paragraphs(text)
  if (!items.length) return null
  return (
    <section style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>{title}</h4>
      {items.map((line, index) => (
        <p key={index} style={{ margin: '0 0 6px', lineHeight: 1.5 }}>
          {line}
        </p>
      ))}
    </section>
  )
}

/**
 * Карточка обновления — одна разметка для «Что нового», предпросмотра в
 * редакторе и мобильной ленты. Ссылки и картинки проходят повторную проверку
 * (safeFeaturePath / visibleMedia): опасный адрес в разметку не попадает.
 */
export function ProductUpdateCard({ update, showAudience = false }: { update: CardContent; showAudience?: boolean }) {
  const featurePath = safeFeaturePath(update.featurePath)
  const media = visibleMedia(update.media)

  return (
    <article>
      <h3 style={{ margin: 0 }}>{update.title || 'Без заголовка'}</h3>
      <div className="muted small" style={{ marginTop: 4 }}>
        {update.publishedAt ? formatUpdateDate(update.publishedAt) : 'Не опубликовано'}
        {showAudience ? ` · ${audienceLabel(update.audienceRoles)}` : ''}
      </div>
      {update.summary ? <p style={{ margin: '12px 0 0', fontWeight: 600, lineHeight: 1.5 }}>{update.summary}</p> : null}

      <Section title="Что изменилось" text={update.changes} />
      <Section title="Как пользоваться" text={update.howToUse} />

      {media.length ? (
        <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          {media.map((item, index) => (
            <figure key={index} style={{ margin: 0 }}>
              <img
                src={item.url}
                alt={item.caption || `Иллюстрация ${index + 1}`}
                loading="lazy"
                style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid #e5e7eb' }}
              />
              {item.caption ? (
                <figcaption className="muted small" style={{ marginTop: 4 }}>
                  {item.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </section>
      ) : null}

      {featurePath ? (
        <div style={{ marginTop: 16 }}>
          <Link to={featurePath}>Перейти к функции →</Link>
        </div>
      ) : null}
    </article>
  )
}
