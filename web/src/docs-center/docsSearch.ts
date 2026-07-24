import { DOCS_ARTICLES } from './docsCatalog'
import type { DocsArticle, DocsContentBlock } from './docsTypes'

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentBlockText(block: DocsContentBlock): string {
  if (block.type === 'heading') return block.title
  if (block.type === 'paragraph') return block.text
  if (block.type === 'list' || block.type === 'steps') return block.items.join(' ')
  if (block.type === 'note') return `${block.title} ${block.text}`
  return 'Поддержка Telegram MAX'
}

function articleSearchText(article: DocsArticle) {
  return normalizeSearchText(
    [
      article.title,
      article.summary,
      article.section,
      article.audience.join(' '),
      article.keywords.join(' '),
      article.anchors.map((anchor) => anchor.title).join(' '),
      article.content.map(contentBlockText).join(' '),
    ].join(' '),
  )
}

const SEARCH_INDEX = DOCS_ARTICLES.map((article) => ({
  article,
  searchText: articleSearchText(article),
}))

export function searchDocs(query: string): DocsArticle[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return DOCS_ARTICLES

  const terms = normalizedQuery.split(' ').filter(Boolean)
  return SEARCH_INDEX.filter(({ searchText }) => terms.every((term) => searchText.includes(term))).map(({ article }) => article)
}
