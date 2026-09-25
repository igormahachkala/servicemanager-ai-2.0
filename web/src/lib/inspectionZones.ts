import type * as api from './api'

export type ZoneCheckpointItem = {
  id: string
  sortOrder: number
  zoneName?: string | null
  zoneSortOrder?: number | null
  checkpointSortOrder?: number | null
  defaultCategoryId?: string | null
  responseType?: api.InspectionCheckpointResponseType | null
  numericMin?: number | null
  numericMax?: number | null
  numericUnit?: string | null
}

export type InspectionZoneGroup<T extends ZoneCheckpointItem> = {
  key: string
  name: string
  zoneSortOrder: number
  items: T[]
}

export function responseTypeLabel(type?: api.InspectionCheckpointResponseType | null): string {
  if (type === 'YES_NO') return 'Да/Нет'
  if (type === 'NUMBER') return 'Число'
  if (type === 'TEXT') return 'Текст'
  if (type === 'PHOTO') return 'Фото'
  return 'Проблема/норма'
}

export function numericConstraintLabel(item: Pick<ZoneCheckpointItem, 'numericMin' | 'numericMax' | 'numericUnit'>): string {
  const parts: string[] = []
  if (item.numericMin !== null && item.numericMin !== undefined) parts.push(`мин. ${item.numericMin}`)
  if (item.numericMax !== null && item.numericMax !== undefined) parts.push(`макс. ${item.numericMax}`)
  if (item.numericUnit) parts.push(item.numericUnit)
  return parts.join(' · ')
}

export function inspectionDefaultTicketCategoryId(
  item: Pick<ZoneCheckpointItem, 'defaultCategoryId'>,
  categories: Array<{ id: string; isActive?: boolean }>,
): string {
  const categoryId = item.defaultCategoryId?.trim()
  if (!categoryId) return ''
  return categories.some((category) => category.id === categoryId && category.isActive !== false) ? categoryId : ''
}

export function inspectionTicketCategoryId(
  item: Pick<ZoneCheckpointItem, 'defaultCategoryId'>,
  categories: Array<{ id: string; isActive?: boolean }>,
  explicitCategoryId?: string,
): string {
  return explicitCategoryId === undefined
    ? inspectionDefaultTicketCategoryId(item, categories)
    : explicitCategoryId.trim()
}

export function groupInspectionItemsByZone<T extends ZoneCheckpointItem>(items: T[]): InspectionZoneGroup<T>[] {
  const sorted = [...items].sort(
    (a, b) =>
      (a.zoneSortOrder ?? 0) - (b.zoneSortOrder ?? 0) ||
      (a.checkpointSortOrder ?? a.sortOrder) - (b.checkpointSortOrder ?? b.sortOrder) ||
      a.sortOrder - b.sortOrder,
  )

  const groups = new Map<string, InspectionZoneGroup<T>>()
  for (const item of sorted) {
    const zoneSortOrder = item.zoneSortOrder ?? 0
    const name = item.zoneName?.trim() || 'Без зоны'
    const key = `${zoneSortOrder}:${name}`
    const group = groups.get(key)
    if (group) {
      group.items.push(item)
    } else {
      groups.set(key, { key, name, zoneSortOrder, items: [item] })
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.zoneSortOrder - b.zoneSortOrder)
}
