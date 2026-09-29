import type * as api from './api'

export type TemplateDraftItem = {
  id?: string
  title: string
  description: string
  zoneName: string
  zoneSortOrder: string
  checkpointSortOrder: string
  defaultCategoryId: string
  responseType: api.InspectionCheckpointResponseType
  numericMin: string
  numericMax: string
  numericUnit: string
  isRequired: boolean
}

export const emptyTemplateDraftItem = (): TemplateDraftItem => ({
  title: '',
  description: '',
  zoneName: '',
  zoneSortOrder: '',
  checkpointSortOrder: '',
  defaultCategoryId: '',
  responseType: 'NORMAL_PROBLEM',
  numericMin: '',
  numericMax: '',
  numericUnit: '',
  isRequired: true,
})

export function templateToDraftItems(template: api.InspectionTemplate): TemplateDraftItem[] {
  const items = template.items.map((item) => ({
    id: item.id,
    title: item.title || '',
    description: item.description || '',
    zoneName: item.zoneName || '',
    zoneSortOrder: String(item.zoneSortOrder ?? 0),
    checkpointSortOrder: String(item.checkpointSortOrder ?? item.sortOrder ?? 0),
    defaultCategoryId: item.defaultCategoryId || '',
    responseType: item.responseType || 'NORMAL_PROBLEM',
    numericMin: item.numericMin === null || item.numericMin === undefined ? '' : String(item.numericMin),
    numericMax: item.numericMax === null || item.numericMax === undefined ? '' : String(item.numericMax),
    numericUnit: item.numericUnit || '',
    isRequired: item.isRequired !== false,
  }))
  return items.length > 0 ? items : [emptyTemplateDraftItem()]
}

export function templateDraftSnapshot(name: string, description: string, items: TemplateDraftItem[]) {
  return JSON.stringify({
    name,
    description,
    items: items.map((item) => ({
      id: item.id || '',
      title: item.title,
      description: item.description,
      zoneName: item.zoneName,
      zoneSortOrder: item.zoneSortOrder,
      checkpointSortOrder: item.checkpointSortOrder,
      defaultCategoryId: item.defaultCategoryId,
      responseType: item.responseType,
      numericMin: item.numericMin,
      numericMax: item.numericMax,
      numericUnit: item.numericUnit,
      isRequired: item.isRequired,
    })),
  })
}

function draftHasContent(item: TemplateDraftItem) {
  return Boolean(
    item.title.trim() ||
      item.description.trim() ||
      item.zoneName.trim() ||
      item.zoneSortOrder.trim() ||
      item.checkpointSortOrder.trim() ||
      item.defaultCategoryId.trim() ||
      item.numericMin.trim() ||
      item.numericMax.trim() ||
      item.numericUnit.trim() ||
      item.responseType !== 'NORMAL_PROBLEM' ||
      !item.isRequired,
  )
}

function parseOptionalNumber(value: string, label: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) throw new Error(`${label}: укажите число`)
  return parsed
}

function parseOptionalInteger(value: string, label: string): number | undefined {
  const parsed = parseOptionalNumber(value, label)
  if (parsed === undefined) return undefined
  if (!Number.isInteger(parsed)) throw new Error(`${label}: укажите целое число`)
  return parsed
}

export function buildTemplatePayload(
  name: string,
  description: string,
  draftItems: TemplateDraftItem[],
): api.SaveInspectionTemplateInput {
  const items = draftItems
    .map((item, index) => {
      const title = item.title.trim()
      if (!title) {
        if (draftHasContent(item)) throw new Error(`Пункт ${index + 1}: укажите заголовок`)
        return null
      }

      const isNumberCheckpoint = item.responseType === 'NUMBER'
      const numericMin = isNumberCheckpoint ? parseOptionalNumber(item.numericMin, 'Минимум') : undefined
      const numericMax = isNumberCheckpoint ? parseOptionalNumber(item.numericMax, 'Максимум') : undefined
      if (numericMin !== undefined && numericMax !== undefined && numericMin > numericMax) {
        throw new Error('Минимум не может быть больше максимума')
      }

      return {
        id: item.id,
        title,
        description: item.description.trim() || undefined,
        zoneName: item.zoneName.trim() || undefined,
        zoneSortOrder: parseOptionalInteger(item.zoneSortOrder, 'Порядок зоны') ?? 0,
        checkpointSortOrder: parseOptionalInteger(item.checkpointSortOrder, 'Порядок пункта') ?? index,
        defaultCategoryId: item.defaultCategoryId.trim() || null,
        responseType: item.responseType,
        numericMin,
        numericMax,
        numericUnit: isNumberCheckpoint ? item.numericUnit.trim() || undefined : undefined,
        isRequired: item.isRequired,
        sortOrder: index,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  if (!name.trim()) throw new Error('Название шаблона обязательно')
  if (items.length === 0) throw new Error('Добавьте хотя бы один пункт обхода')

  return {
    name: name.trim(),
    description: description.trim() || undefined,
    items,
  }
}
