/**
 * SMA-ANALYTICS-V2-PHASE1 — группировка аналитики объектов «Город → Точки».
 *
 * Чистый модуль: ни React, ни сети. Окружение тестов node, DOM нет, поэтому
 * все решения вынесены сюда и проверяются исполнением.
 *
 * Прав этот модуль не выдаёт и не отнимает. Он получает УЖЕ разрешённые
 * бэкендом строки объектов (GET /analytics/locations — ANALYTICS_VIEW плюс
 * Capability + Scope + Relationship, включая сужение SECONDARY по 004C) и
 * только раскладывает их по городам. Ни один объект, которого бэкенд не
 * отдал, здесь появиться не может, и область запроса отсюда не меняется.
 *
 * Агрегаты заявок здесь НЕ пересчитываются: канонические показатели остаются
 * теми, что вернул бэкенд. См. комментарий к CityGroup.locationsCount.
 */

/** Город не заполнен. Отдельная понятная группа, а не «прочее». */
export const NO_CITY_KEY = '__no_city__'
export const NO_CITY_LABEL = 'Город не указан'

/** Выбран «все города». Пустая строка, чтобы ложилось в value у select. */
export const ALL_CITIES_KEY = ''

/** Минимум, который нужен для группировки: идентификатор и город. */
export type GroupableLocation = {
  locationId: string
  city?: string | null
}

export type CityGroup<T extends GroupableLocation> = {
  cityKey: string
  cityLabel: string
  locations: T[]
  /**
   * Количество точек в городе.
   *
   * Это мощность группы, а не показатель по заявкам: складывать
   * totalTickets по городу здесь нельзя. Бэкенд считает свои итоги сам
   * (summary), и сумма по строкам не обязана им совпадать — например,
   * заявки без объекта в строки не попадают вовсе. Поэтому в Phase 1
   * показывается только число точек.
   */
  locationsCount: number
}

/**
 * Ключ группировки.
 *
 * Нормализуется ТОЛЬКО ключ: пробелы по краям, внутренние пробелы в один,
 * регистр вниз. Данные в базе не меняются и запрос не трогается — «Москва»,
 * «москва» и « Москва  » попадают в одну группу, но сам город в строке
 * остаётся как есть.
 */
export function normalizeCityKey(city?: string | null): string {
  const collapsed = (city || '').replace(/\s+/g, ' ').trim()
  if (!collapsed) return NO_CITY_KEY
  return collapsed.toLocaleLowerCase('ru-RU')
}

/** Подпись города для интерфейса: как в данных, но без лишних пробелов. */
export function cityLabel(city?: string | null): string {
  const collapsed = (city || '').replace(/\s+/g, ' ').trim()
  return collapsed || NO_CITY_LABEL
}

/**
 * Разложить разрешённые строки объектов по городам.
 *
 * Порядок: города по алфавиту, «Город не указан» всегда последним — иначе
 * пустое значение всплывало бы выше настоящих городов. Внутри города
 * порядок строк сохраняется ровно такой, какой пришёл с бэкенда: он там
 * осмысленный (по убыванию заявок), и переупорядочивать его значило бы
 * подменять ответ.
 *
 * Подпись берётся от первой встреченной строки города: при разном регистре
 * группа одна, и показывается написание, которое бэкенд отдал первым.
 */
export function groupLocationsByCity<T extends GroupableLocation>(
  items: readonly T[],
): CityGroup<T>[] {
  const groups = new Map<string, CityGroup<T>>()

  for (const item of items) {
    const cityKey = normalizeCityKey(item.city)
    const existing = groups.get(cityKey)
    if (existing) {
      existing.locations.push(item)
      existing.locationsCount = existing.locations.length
      continue
    }
    groups.set(cityKey, {
      cityKey,
      cityLabel: cityLabel(item.city),
      locations: [item],
      locationsCount: 1,
    })
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.cityKey === NO_CITY_KEY) return 1
    if (right.cityKey === NO_CITY_KEY) return -1
    return left.cityLabel.localeCompare(right.cityLabel, 'ru-RU')
  })
}

/** Есть ли такой город среди разрешённых строк. */
export function hasCityGroup<T extends GroupableLocation>(
  groups: readonly CityGroup<T>[],
  cityKey: string,
): boolean {
  if (cityKey === ALL_CITIES_KEY) return true
  return groups.some((group) => group.cityKey === cityKey)
}

/**
 * Какие точки показывать.
 *
 * Отбор идёт по ИСХОДНЫМ строкам ответа, а не по группам, и поэтому
 * сохраняет порядок бэкенда в любом состоянии.
 *
 * Это важнее, чем кажется: бэкенд отдаёт точки по убыванию заявок
 * (analytics.service: sort по totalTickets DESC), и прежняя редакция при
 * «Все города» склеивала группы — список становился упорядоченным по
 * алфавиту городов, то есть на первом же экране точка с 500 заявками
 * оказывалась ниже точек с одной. Группы остались только для списка
 * городов; на порядок строк они больше не влияют.
 *
 * Фильтрация — это представление, а не расширение доступа: выбранная
 * точка, которой нет в разрешённых строках, ничего не добавляет.
 *
 * Пустой выбор точек означает «все точки этого города», а не «ни одной»:
 * иначе выбор города давал бы пустой экран.
 */
export function selectVisibleLocations<T extends GroupableLocation>(
  items: readonly T[],
  cityKey: string,
  selectedLocationIds: readonly string[] = [],
): T[] {
  const scoped =
    cityKey === ALL_CITIES_KEY
      ? items
      : items.filter((item) => normalizeCityKey(item.city) === cityKey)

  if (selectedLocationIds.length === 0) return [...scoped]

  const wanted = new Set(selectedLocationIds)
  return scoped.filter((item) => wanted.has(item.locationId))
}

/**
 * Переключить точку в выборе.
 *
 * Возвращает новый список, порядок добавления сохраняется — так выбор
 * выглядит предсказуемо, а не перескакивает.
 */
export function toggleLocationSelection(
  selectedLocationIds: readonly string[],
  locationId: string,
): string[] {
  return selectedLocationIds.includes(locationId)
    ? selectedLocationIds.filter((id) => id !== locationId)
    : [...selectedLocationIds, locationId]
}

/**
 * Привести выбор точек к новому составу разрешённых строк.
 *
 * Нужно при смене города и при обновлении данных: точки другого города либо
 * исчезнувшие из ответа в выборе оставаться не должны, иначе на экране
 * «выбрано 3», а показана одна.
 */
export function retainSelectableLocations<T extends GroupableLocation>(
  items: readonly T[],
  cityKey: string,
  selectedLocationIds: readonly string[],
): string[] {
  if (selectedLocationIds.length === 0) return []
  const available = new Set(
    selectVisibleLocations(items, cityKey).map((item) => item.locationId),
  )
  return selectedLocationIds.filter((id) => available.has(id))
}
