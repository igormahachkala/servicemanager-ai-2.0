export type CategoryLike = {
  id: string
  name?: string | null
}

function normalizeCategoryName(name?: string | null): string {
  return (name || '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
}

export function isGenericFallbackCategoryName(name?: string | null): boolean {
  const normalized = normalizeCategoryName(name)
  return normalized === 'другое' || normalized === 'иной запрос'
}

export function orderProblemCategories<T extends CategoryLike>(categories: readonly T[]): T[] {
  return [...categories].sort((a, b) => {
    const aFallback = isGenericFallbackCategoryName(a.name)
    const bFallback = isGenericFallbackCategoryName(b.name)
    if (aFallback === bFallback) return 0
    return aFallback ? 1 : -1
  })
}

export function reconcileCategorySelection<T extends CategoryLike>(currentId: string, categories: readonly T[]): string {
  if (!currentId) return ''
  return categories.some((category) => category.id === currentId) ? currentId : ''
}
