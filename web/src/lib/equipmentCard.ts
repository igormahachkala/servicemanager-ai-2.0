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

/**
 * Кто управляет деталями оборудования.
 *
 * Тот же круг, что в списке оборудования (EquipmentPage MANAGER_ROLES).
 * Держится здесь, чтобы карточка и список не разошлись, и намеренно НЕ
 * выводится из isFullAdminDesktopNavRole: тот предикат отвечает за видимость
 * пункта меню, а не за право.
 *
 * Это подсказка интерфейса. Право решает бэкенд: LOCATIONS_MANAGE.
 */
export const EQUIPMENT_PARTS_MANAGER_ROLES: readonly string[] = ['ADMIN', 'MASTER', 'DISPATCHER']

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

/**
 * Путь к карточке оборудования с сохранением области.
 *
 * Карточка читает companyId из адреса; без него провайдер, пришедший
 * из клиентского контура, получил бы «не найдено» на то оборудование,
 * которое только что видел. Поэтому область переносится явно.
 */
export type ScopeParams = {
  companyId?: string | null
  linkedClientCompanyId?: string | null
}

/**
 * Параметры области для адреса.
 *
 * Строка принимается как companyId — так область переносили раньше.
 *
 * Провайдерский контур задаётся linkedClientCompanyId: его читают доска,
 * создание заявки и карточка точки, и только он не даёт Shell перезаписать
 * сохранённую область без linked-части (persistScopeFromSearchParams
 * пишет пару целиком). Поэтому для провайдера посылать companyId нельзя,
 * хотя получатель его и примет.
 */
function scopeSearchParams(scope?: ScopeParams | string | null): URLSearchParams {
  const params = new URLSearchParams()
  const normalized: ScopeParams = typeof scope === 'string' ? { companyId: scope } : scope || {}
  const companyId = (normalized.companyId || '').trim()
  const linkedClientCompanyId = (normalized.linkedClientCompanyId || '').trim()
  if (companyId) params.set('companyId', companyId)
  if (linkedClientCompanyId) params.set('linkedClientCompanyId', linkedClientCompanyId)
  return params
}

function withScope(path: string, scope?: ScopeParams | string | null): string {
  const query = scopeSearchParams(scope).toString()
  return query ? `${path}?${query}` : path
}

export function equipmentListPath(scope?: ScopeParams | string | null): string {
  return withScope('/equipment', scope)
}

export function equipmentCardPath(equipmentId: string, scope?: ScopeParams | string | null): string {
  return withScope(`/equipment/${equipmentId}`, scope)
}

/** Путь создания заявки по оборудованию: существующий маршрут, не новый. */
export function equipmentCreateTicketPath(
  item: {
    id: string
    locationId?: string | null
  },
  scope?: ScopeParams | string | null,
): string {
  /*
   * Область обязательна, иначе переход «Создать заявку» у провайдера ведёт
   * в тупик: форма создания берёт контур из linkedClientCompanyId (адрес
   * или сохранённая область), а приход на карточку оборудования с
   * «?companyId=…» эту сохранённую область уже перезаписал без linked-части
   * (Shell вызывает persistScopeFromSearchParams на каждом переходе).
   * Тогда providerNeedsLinkedClient истинно и форма скрывается целиком —
   * предзаполнение до неё даже не доезжает.
   */
  const params = scopeSearchParams(scope)
  if (item.locationId) params.set('locationId', item.locationId)
  params.set('equipmentId', item.id)
  return `/tickets/new?${params.toString()}`
}

/**
 * Переход к заявкам этого оборудования.
 *
 * Доска восстанавливает фильтры ТОЛЬКО из состояния навигации роутера
 * (location.state.boardContext) — поисковую строку она не читает, сколько бы
 * boardEquipmentId там ни стояло. Поэтому фильтр едет состоянием, а адрес
 * остаётся обычным /tickets. Это тот же контракт, которым пользуется
 * карточка заявки; второго механизма не заводится.
 */
export type BoardScopeParams = {
  companyId?: string | null
  linkedClientCompanyId?: string | null
}

export function equipmentTicketsLink(
  item: { id: string },
  scope?: BoardScopeParams,
): {
  to: string
  state: { boardContext: { selectedEquipmentId: string } }
} {
  /*
   * Область переносится ИМЕННО тем параметром, который доска учитывает для
   * этой роли, — выбор делает вызывающий, роли этот модуль не знает.
   *
   * companyId доска принимает только у PLATFORM_ADMIN
   * (observerCompanyId = role === 'PLATFORM_ADMIN' ? requested : ''),
   * а контур провайдера задаётся linkedClientCompanyId. Поэтому
   * «?companyId=…» для провайдера не только открывал доску в другом
   * контуре, но и перезаписывал сохранённую область без
   * linkedClientCompanyId, ломая её для последующих страниц.
   */
  const params = new URLSearchParams()
  const companyId = (scope?.companyId || '').trim()
  const linkedClientCompanyId = (scope?.linkedClientCompanyId || '').trim()
  if (companyId) params.set('companyId', companyId)
  if (linkedClientCompanyId) params.set('linkedClientCompanyId', linkedClientCompanyId)
  const query = params.toString()
  return {
    to: query ? `/tickets?${query}` : '/tickets',
    state: { boardContext: { selectedEquipmentId: item.id } },
  }
}

/**
 * Путь к карточке точки с сохранением области.
 *
 * Без области провайдер и наблюдатель получали 404 на ту точку, с которой
 * пришли: своей области LocationPage не выводит, берёт только из адреса.
 *
 * Принимает она ОБА параметра (companyId и linkedClientCompanyId), так что
 * посылать нужно тот, который не ломает сохранённую область, — для
 * провайдера это linkedClientCompanyId. Прежняя редакция этого примечания
 * утверждала, что читается только companyId, и дважды завела правку не
 * туда: сначала в 404, потом в затирание linked-части.
 */
export function locationCardPath(locationId: string, scope?: ScopeParams | string | null): string {
  return withScope(`/locations/${locationId}`, scope)
}

/** Список точек с сохранением области — тем же параметром, которым она пришла. */
export function locationsListPath(scope?: ScopeParams | string | null): string {
  return withScope('/locations', scope)
}

/**
 * Сверка фильтров доски с составом полученных карточек.
 *
 * Вынесено из BoardPage, чтобы решение проверялось ИСПОЛНЕНИЕМ: прошлый
 * раз его охраняли только совпадения по тексту исходника, и дефект,
 * восстановленный вторым эффектом, проходил все тесты.
 */
export function boardFilterReconciliation(input: {
  boardLoaded: boolean
  selectedLocationId: string
  selectedEquipmentId: string
  locationOptions: readonly { id: string }[]
}): { clearLocation: boolean; clearEquipment: boolean } {
  /*
   * Без данных не сверяем: варианты берутся из загруженных карточек, и на
   * холодном входе список пуст — так восстановленный фильтр и затирался.
   */
  if (!input.boardLoaded) return { clearLocation: false, clearEquipment: false }
  if (
    input.selectedLocationId &&
    !input.locationOptions.some((item) => item.id === input.selectedLocationId)
  ) {
    return { clearLocation: true, clearEquipment: true }
  }
  /*
   * Оборудование по составу карточек не снимается: выбранная позиция
   * всегда остаётся вариантом (boardEquipmentOptions), иначе оборудование
   * без заявок снимало бы собственный фильтр и доска показывала бы ВСЕ
   * заявки вместо пустой выборки. Снять фильтр можно вручную — в списке
   * есть «Все».
   */
  return { clearLocation: false, clearEquipment: false }
}

/** Варианты фильтра оборудования: состав карточек плюс сама выбранная позиция. */
export function boardEquipmentOptions(
  cards: readonly {
    location?: { id?: string | null } | null
    equipment?: { id?: string | null; name?: string | null; type?: string | null } | null
  }[],
  selectedLocationId: string,
  selectedEquipmentId: string,
): { id: string; label: string }[] {
  const map = new Map<string, string>()
  for (const card of cards) {
    if (selectedLocationId && card.location?.id !== selectedLocationId) continue
    if (card.equipment?.id) {
      map.set(card.equipment.id, [card.equipment.name, card.equipment.type].filter(Boolean).join(' · '))
    }
  }
  if (selectedEquipmentId && !map.has(selectedEquipmentId)) {
    map.set(selectedEquipmentId, 'Выбранное оборудование')
  }
  return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
}
