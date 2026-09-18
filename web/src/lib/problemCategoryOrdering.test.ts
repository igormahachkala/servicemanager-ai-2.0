import { describe, expect, it } from 'vitest'
import {
  isGenericFallbackCategoryName,
  orderProblemCategories,
  reconcileCategorySelection,
} from './problemCategoryOrdering'

describe('problem category ordering', () => {
  it('preserves normal category ordering and moves generic fallbacks last', () => {
    const categories = [
      { id: 'other', name: 'Другое' },
      { id: 'hvac', name: 'Кондиционирование' },
      { id: 'misc', name: ' Иной   запрос ' },
      { id: 'electric', name: 'Электрика' },
    ]

    expect(orderProblemCategories(categories).map((category) => category.id)).toEqual([
      'hvac',
      'electric',
      'other',
      'misc',
    ])
    expect(categories.map((category) => category.id)).toEqual(['other', 'hvac', 'misc', 'electric'])
  })

  it('recognizes fallback names with common casing and spacing differences', () => {
    expect(isGenericFallbackCategoryName('другое')).toBe(true)
    expect(isGenericFallbackCategoryName('ДРУГОЕ')).toBe(true)
    expect(isGenericFallbackCategoryName(' иной запрос ')).toBe(true)
    expect(isGenericFallbackCategoryName('Иной   запрос')).toBe(true)
    expect(isGenericFallbackCategoryName('Холодильное оборудование')).toBe(false)
  })

  it('does not auto-select the first available category', () => {
    const categories = [
      { id: 'hvac', name: 'Кондиционирование' },
      { id: 'other', name: 'Другое' },
    ]

    expect(reconcileCategorySelection('', categories)).toBe('')
    expect(reconcileCategorySelection('hvac', categories)).toBe('hvac')
    expect(reconcileCategorySelection('missing', categories)).toBe('')
  })
})
