/**
 * SMA-EQUIPMENT-V2-FOUNDATION — решения карточки оборудования.
 *
 * Чистый модуль: ни React, ни сети. Окружение тестов node, DOM нет, поэтому
 * всё, что можно вынести из разметки, проверяется исполнением.
 *
 * Прав этот модуль не выдаёт и не отнимает: доступ решает бэкенд
 * (LOCATIONS_VIEW для чтения, LOCATIONS_MANAGE для правки) той же
 * связкой Capability + Scope + Relationship, что и раньше.
 */

/**
 * Жизненный цикл.
 *
 * Значения взяты как есть из CURRENT Production: status — строка, и INACTIVE
 * несёт мягкое удаление (EquipmentService.remove ставит именно его).
 * Целевой набор ACTIVE/UNDER_REPAIR/RETIRED/REPLACED здесь НЕ вводится:
 * это отдельное продуктовое решение и миграция, см. отчёт. Карточка только
 * показывает то, что уже лежит в базе, и ничего не переименовывает.
 */
export const EQUIPMENT_STATUS_LABELS_RU: Record<string, string> = {
  ACTIVE: 'В работе',
  REPAIR: 'В ремонте',
  INACTIVE: 'Не используется',
  DECOMMISSIONED: 'Списано',
}

export function equipmentStatusLabel(status?: string | null): string {
  const key = (status || '').trim()
  if (!key) return '—'
  // Незнакомое значение показывается как есть: врать о состоянии нельзя.
  return EQUIPMENT_STATUS_LABELS_RU[key] || key
}

/** Снято с эксплуатации — для приглушения карточки и пометки в списках. */
export function isEquipmentRetired(status?: string | null): boolean {
  const key = (status || '').trim()
  return key === 'INACTIVE' || key === 'DECOMMISSIONED'
}

/** Паспортная строка: показывается только то, что заполнено. */
export type EquipmentPassportRow = { label: string; value: string }

export function equipmentPassportRows(item: {
  type?: string | null
  manufacturer?: string | null
  model?: string | null
  serialNumber?: string | null
  inventoryNumber?: string | null
  commissionedAt?: string | null
  warrantyUntil?: string | null
  description?: string | null
}): EquipmentPassportRow[] {
  const date = (iso?: string | null) => {
    const raw = (iso || '').trim()
    if (!raw) return ''
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString('ru-RU')
  }

  const candidates: EquipmentPassportRow[] = [
    { label: 'Тип', value: (item.type || '').trim() },
    { label: 'Производитель', value: (item.manufacturer || '').trim() },
    { label: 'Модель', value: (item.model || '').trim() },
    { label: 'Серийный номер', value: (item.serialNumber || '').trim() },
    { label: 'Инвентарный номер', value: (item.inventoryNumber || '').trim() },
    { label: 'Введено в эксплуатацию', value: date(item.commissionedAt) },
    { label: 'Гарантия до', value: date(item.warrantyUntil) },
    { label: 'Описание', value: (item.description || '').trim() },
  ]

  return candidates.filter((row) => !!row.value)
}

/**
 * Гарантия истекла?
 *
 * Отдельным решением, потому что это подсказка в карточке, а не поле базы.
 * Нет даты — нет и ответа: выдумывать «гарантия закончилась» нельзя.
 */
export function isWarrantyExpired(
  warrantyUntil?: string | null,
  now: Date = new Date(),
): boolean | null {
  const raw = (warrantyUntil || '').trim()
  if (!raw) return null
  const until = new Date(raw)
  if (Number.isNaN(until.getTime())) return null
  return until.getTime() < now.getTime()
}

/**
 * Ссылка на публичную заявку по конкретному оборудованию.
 *
 * Собирается существующим построителем и ведёт в существующий публичный
 * поток: второго создателя заявок и публичной ручки под оборудование
 * не появляется. Без токена или точки ссылки нет — пустая строка означает
 * «QR показывать нечего».
 */
export function equipmentPublicRequestLink(params: {
  buildLink: (token?: string | null, locationId?: string | null, equipmentId?: string | null) => string
  token?: string | null
  locationId?: string | null
  equipmentId?: string | null
}): string {
  if (!params.token || !params.locationId || !params.equipmentId) return ''
  return params.buildLink(params.token, params.locationId, params.equipmentId)
}

/**
 * Можно ли предложить создание заявки по этому оборудованию.
 *
 * Снятое оборудование новых заявок не порождает — и бэкенд публичной заявки
 * тоже принимает только ACTIVE. Это подсказка интерфейса, не право.
 */
export function canCreateTicketForEquipment(item: {
  status?: string | null
  locationId?: string | null
}): boolean {
  if (!item.locationId) return false
  return (item.status || '').trim() === 'ACTIVE'
}

/** Путь создания заявки по оборудованию: существующий маршрут, не новый. */
export function equipmentCreateTicketPath(item: {
  id: string
  locationId?: string | null
}): string {
  const params = new URLSearchParams()
  if (item.locationId) params.set('locationId', item.locationId)
  params.set('equipmentId', item.id)
  return `/tickets/new?${params.toString()}`
}

/** Путь к списку заявок этого оборудования: существующий контракт доски. */
export function equipmentTicketsPath(
  item: { id: string },
  appendBoardContext: (path: string, ctx: { selectedEquipmentId?: string }) => string,
): string {
  return appendBoardContext('/tickets', { selectedEquipmentId: item.id })
}
