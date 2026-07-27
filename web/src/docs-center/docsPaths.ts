export type DocsBasePath = '/docs' | '/m/docs' | '/max/docs'

/**
 * Определяет базовый путь Documentation Center по текущему runtime,
 * чтобы одни и те же страницы каталога работали в desktop, mobile (/m)
 * и MAX (/max) shell без второго каталога или контент-модели.
 *
 * Внутренние ссылки и unknown-slug fallback используют этот базовый путь,
 * поэтому пользователь остаётся в своём shell (browser back тоже).
 */
export function getDocsBasePath(pathname?: string | null): DocsBasePath {
  const path = pathname || ''
  if (path === '/max' || path.startsWith('/max/')) return '/max/docs'
  if (path === '/m' || path.startsWith('/m/')) return '/m/docs'
  return '/docs'
}
