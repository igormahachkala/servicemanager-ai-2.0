import { describe, expect, it } from 'vitest'

import { buildTemplatePayload, templateToDraftItems } from './inspectionTemplateEditor'

function template() {
  return {
    id: 'template-1',
    companyId: 'provider-1',
    name: 'Обход',
    description: null,
    isActive: true,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    items: [{
      id: 'item-1',
      title: 'Проверка',
      description: null,
      sortOrder: 0,
      zoneName: 'Зона',
      zoneSortOrder: 0,
      checkpointSortOrder: 0,
      defaultCategoryId: 'category-v1',
      responseType: 'NORMAL_PROBLEM' as const,
      numericMin: null,
      numericMax: null,
      numericUnit: null,
      isRequired: true,
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    }],
  }
}

describe('inspection template editor persistence', () => {
  it('reopens and saves zone/checkpoint ordering without tenant category state', () => {
    const draft = templateToDraftItems(template())
    draft[0].zoneName = 'Новая зона'
    draft[0].zoneSortOrder = '2'
    draft[0].checkpointSortOrder = '3'

    expect(buildTemplatePayload('Обход', '', draft).items[0]).toMatchObject({
      zoneName: 'Новая зона',
      zoneSortOrder: 2,
      checkpointSortOrder: 3,
      defaultCategoryId: 'category-v1',
    })
  })

  it('persists an explicit checkpoint hint change and clear on reopen', () => {
    const changed = templateToDraftItems(template())
    changed[0].defaultCategoryId = 'category-v2'
    expect(buildTemplatePayload('Обход', '', changed).items[0].defaultCategoryId).toBe('category-v2')

    changed[0].defaultCategoryId = ''
    expect(buildTemplatePayload('Обход', '', changed).items[0].defaultCategoryId).toBeNull()
  })
})
