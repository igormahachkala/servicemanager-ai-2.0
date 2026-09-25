import { describe, expect, it } from 'vitest'

import {
  groupInspectionItemsByZone,
  inspectionDefaultTicketCategoryId,
  inspectionTicketCategoryId,
} from './inspectionZones'

describe('inspection zone helpers', () => {
  it('groups checkpoints by ordered zone and checkpoint order', () => {
    const zones = groupInspectionItemsByZone([
      { id: 'b', sortOrder: 1, zoneName: 'Кухня', zoneSortOrder: 1, checkpointSortOrder: 1 },
      { id: 'a', sortOrder: 0, zoneName: 'Зал', zoneSortOrder: 0, checkpointSortOrder: 0 },
      { id: 'c', sortOrder: 2, zoneName: 'Кухня', zoneSortOrder: 1, checkpointSortOrder: 0 },
    ])

    expect(zones.map((zone) => zone.name)).toEqual(['Зал', 'Кухня'])
    expect(zones[1].items.map((item) => item.id)).toEqual(['c', 'b'])
  })

  it('uses only active snapshot default categories for ticket prefill', () => {
    const categories = [
      { id: 'cat-disabled', isActive: false },
      { id: 'cat-active', isActive: true },
    ]

    expect(inspectionDefaultTicketCategoryId({ defaultCategoryId: 'cat-active' }, categories)).toBe('cat-active')
    expect(inspectionDefaultTicketCategoryId({ defaultCategoryId: 'cat-disabled' }, categories)).toBe('')
    expect(inspectionDefaultTicketCategoryId({ defaultCategoryId: 'missing-cat' }, categories)).toBe('')
    expect(inspectionDefaultTicketCategoryId({ defaultCategoryId: null }, categories)).toBe('')
  })

  it('preserves an explicit category change or clear instead of reapplying the default', () => {
    const item = { defaultCategoryId: 'cat-default' }
    const categories = [
      { id: 'cat-default', isActive: true },
      { id: 'cat-explicit', isActive: true },
    ]

    expect(inspectionTicketCategoryId(item, categories)).toBe('cat-default')
    expect(inspectionTicketCategoryId(item, categories, 'cat-explicit')).toBe('cat-explicit')
    expect(inspectionTicketCategoryId(item, categories, '')).toBe('')
  })
})
