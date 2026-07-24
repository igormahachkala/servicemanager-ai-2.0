import { Link, Navigate, useParams } from 'react-router-dom'
import { SupportContactBlock } from '../components/SupportContactBlock'
import { DOCS_ARTICLES, getDocsArticleBySlug, getDocsSectionMeta } from './docsCatalog'
import type { DocsContentBlock } from './docsTypes'
import './docs-center.css'

function renderBlock(block: DocsContentBlock, index: number) {
  if (block.type === 'heading') {
    return (
      <h2 key={`${block.anchorId}-${index}`} id={block.anchorId} className="docsArticleHeading">
        {block.title}
      </h2>
    )
  }

  if (block.type === 'paragraph') {
    return <p key={index}>{block.text}</p>
  }

  if (block.type === 'list') {
    return (
      <ul key={index} className="docsArticleList">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  if (block.type === 'steps') {
    return (
      <ol key={index} className="docsArticleList docsArticleSteps">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    )
  }

  if (block.type === 'note') {
    return (
      <div key={index} className={`docsNote docsNote--${block.tone || 'info'}`}>
        <div className="docsNoteTitle">{block.title}</div>
        <div>{block.text}</div>
      </div>
    )
  }

  return (
    <div key={index} className="docsSupportBlock">
      <SupportContactBlock titleTag="div" />
    </div>
  )
}

export function DocumentationArticlePage() {
  const { slug } = useParams()
  const article = getDocsArticleBySlug(slug)

  if (!article) return <Navigate to="/docs" replace />

  const section = getDocsSectionMeta(article.section)

  return (
    <div className="docsCenterPage">
      <div className="docsArticleLayout">
        <aside className="docsSidebar panel" aria-label="Навигация по документации">
          <Link to="/docs" className="docsBackLink">
            ← Документация
          </Link>
          <div className="docsSidebarGroup">
            <h2>Материалы</h2>
            <nav className="docsSectionNav">
              {DOCS_ARTICLES.map((item) => (
                <Link
                  key={item.id}
                  to={`/docs/${item.slug}`}
                  className={item.id === article.id ? 'docsSectionLink docsSectionLink--active' : 'docsSectionLink'}
                  aria-current={item.id === article.id ? 'page' : undefined}
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>

          <div className="docsSidebarGroup">
            <h2>На странице</h2>
            <nav className="docsAnchorNav">
              {article.anchors.map((anchor) => (
                <a key={anchor.id} href={`#${anchor.id}`}>
                  {anchor.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="docsArticle panel">
          <div className="docsArticleHeader">
            <span className="docsArticleSection">{section.title}</span>
            <h1>{article.title}</h1>
            <p>{article.summary}</p>
            <div className="docsAudienceRow" aria-label="Аудитория">
              {article.audience.map((audience) => (
                <span key={audience}>{audience}</span>
              ))}
            </div>
          </div>

          <div className="docsArticleContent">{article.content.map(renderBlock)}</div>
        </article>
      </div>
    </div>
  )
}
