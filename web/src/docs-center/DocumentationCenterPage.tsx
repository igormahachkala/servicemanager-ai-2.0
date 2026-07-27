import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SupportContactBlock } from '../components/SupportContactBlock'
import { DOCS_ARTICLES, DOCS_SECTIONS, getDocsSectionMeta } from './docsCatalog'
import { getDocsBasePath } from './docsPaths'
import { searchDocs } from './docsSearch'
import './docs-center.css'

export function DocumentationCenterPage() {
  const location = useLocation()
  const docsBase = getDocsBasePath(location.pathname)
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchDocs(query), [query])
  const isSearching = query.trim().length > 0

  return (
    <div className="docsCenterPage">
      <section className="docsHero" aria-labelledby="docs-title">
        <div>
          <div className="docsEyebrow">Сервис Менеджер</div>
          <h1 id="docs-title">Документация</h1>
          <p>
            Authenticated Documentation Center V1 помогает быстро найти проверенную пользовательскую информацию по
            существующим разделам продукта. Контент хранится как статический каталог без backend и CMS.
          </p>
        </div>
        <div className="docsHeroMeta" aria-label="Статус документации">
          <span>V1</span>
          <span>Frontend-only</span>
          <span>Authenticated</span>
        </div>
      </section>

      <section className="docsSearchPanel panel" aria-labelledby="docs-search-title">
        <div>
          <h2 id="docs-search-title">Поиск по документации</h2>
          <p className="muted small">Ищет по названию, описанию, ключевым словам и тексту статей.</p>
        </div>
        <label className="docsSearchLabel">
          <span className="small">Поиск</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например: push, заявки, конструктор доступа"
            aria-describedby="docs-search-help"
          />
        </label>
        <div id="docs-search-help" className="muted small">
          Поиск регистронезависимый и поддерживает русский текст.
        </div>
      </section>

      <div className="docsLayout">
        <aside className="docsSidebar panel" aria-label="Разделы документации">
          <h2>Разделы</h2>
          <nav className="docsSectionNav">
            {DOCS_SECTIONS.map((section) => {
              const article = DOCS_ARTICLES.find((item) => item.section === section.id)
              return article ? (
                <Link key={section.id} to={`${docsBase}/${article.slug}`} className="docsSectionLink">
                  <span>{section.title}</span>
                  <span className="muted small">{section.summary}</span>
                </Link>
              ) : null
            })}
          </nav>
        </aside>

        <main className="docsMain" aria-live="polite">
          <div className="docsResultHeader">
            <div>
              <h2>{isSearching ? 'Результаты поиска' : 'Все материалы V1'}</h2>
              <div className="muted small">
                {results.length
                  ? `Найдено материалов: ${results.length}`
                  : 'Материалы по этому запросу не найдены.'}
              </div>
            </div>
            {isSearching ? (
              <button type="button" className="ghost" onClick={() => setQuery('')}>
                Сбросить поиск
              </button>
            ) : null}
          </div>

          {results.length ? (
            <div className="docsCardGrid">
              {results.map((article) => {
                const section = getDocsSectionMeta(article.section)
                return (
                  <Link key={article.id} to={`${docsBase}/${article.slug}`} className="docsArticleCard">
                    <span className="docsArticleSection">{section.title}</span>
                    <h3>{article.title}</h3>
                    <p>{article.summary}</p>
                    <span className="docsArticleMeta">{article.anchors.length} раздела</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="docsEmptyState panel">
              <h3>Ничего не найдено</h3>
              <p className="muted">
                Попробуйте другой термин: «заявки», «push», «роль», «поддержка» или «быстрый старт».
              </p>
            </div>
          )}

          <section className="docsQuickLinks panel" aria-labelledby="docs-quick-links-title">
            <h2 id="docs-quick-links-title">Быстрые ссылки</h2>
            <div className="docsQuickLinksRow">
              <Link to={`${docsBase}/quick-start`}>Первый вход</Link>
              <Link to={`${docsBase}/executor-guide`}>Работа техника</Link>
              <Link to={`${docsBase}/admin-guide`}>Администрирование</Link>
              <Link to={`${docsBase}/support`}>Поддержка</Link>
            </div>
          </section>

          <section className="docsSupportPreview panel" aria-labelledby="docs-support-preview-title">
            <h2 id="docs-support-preview-title">Нужна помощь?</h2>
            <p className="muted small">Контакты поддержки переиспользуются из единого компонента продукта.</p>
            <SupportContactBlock titleTag="div" />
          </section>
        </main>
      </div>
    </div>
  )
}
