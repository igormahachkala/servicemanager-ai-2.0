import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ALL_CITIES_KEY,
  NO_CITY_KEY,
  NO_CITY_LABEL,
  cityLabel,
  groupLocationsByCity,
  hasCityGroup,
  normalizeCityKey,
  retainSelectableLocations,
  selectVisibleLocations,
  toggleLocationSelection,
} from './locationAnalyticsGrouping'

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

type Row = { locationId: string; city?: string | null; locationName: string; totalTickets: number }

const row = (locationId: string, city: string | null, totalTickets = 0): Row => ({
  locationId,
  city,
  locationName: `Точка ${locationId}`,
  totalTickets,
})

describe('ANALYTICS V2 Phase 1: город → точки', () => {
  it('1. несколько городов: группы по алфавиту, «не указан» последним', () => {
    const groups = groupLocationsByCity([
      row('l1', 'Самара'),
      row('l2', null),
      row('l3', 'Казань'),
      row('l4', 'Самара'),
    ])

    expect(groups.map((g) => g.cityLabel)).toEqual(['Казань', 'Самара', NO_CITY_LABEL])
    expect(groups.map((g) => g.locationsCount)).toEqual([1, 2, 1])
    // Ни одна строка не потеряна и не продублирована.
    expect(groups.flatMap((g) => g.locations.map((l) => l.locationId)).sort()).toEqual([
      'l1',
      'l2',
      'l3',
      'l4',
    ])
  })

  it('2. один город: видны только его точки', () => {
    const items = [row('l1', 'Казань'), row('l2', 'Самара'), row('l3', 'Казань')]
    const visible = selectVisibleLocations(items, normalizeCityKey('Казань'))

    expect(visible.map((l) => l.locationId)).toEqual(['l1', 'l3'])
    /*
     * «Все города» возвращает ответ КАК ЕСТЬ, а не склейку групп.
     * Прежняя редакция этого теста закрепляла порядок по группам
     * (l1, l3, l2) — то есть ровно ту регрессию, из-за которой список
     * выстраивался по алфавиту городов вместо порядка бэкенда.
     */
    expect(selectVisibleLocations(items, ALL_CITIES_KEY).map((l) => l.locationId)).toEqual([
      'l1',
      'l2',
      'l3',
    ])
  })

  it('2a. РЕГРЕССИЯ: «Все города» сохраняет ранжирование бэкенда по заявкам', () => {
    /*
     * Бэкенд отдаёт точки по убыванию заявок
     * (analytics.service: .sort((a, b) => b.totalTickets - a.totalTickets)),
     * и Production рисовал их напрямую. Группировка по городам не должна
     * этот порядок трогать: иначе на первом же экране, когда пользователь
     * ничего не выбрал, точка с 500 заявками оказывается ниже точек с одной.
     */
    /*
     * Идентификаторы намеренно НЕ по алфавиту: иначе проверка прошла бы и
     * при сортировке на фронтенде, которой тут быть не должно вовсе.
     */
    const items = [
      row('z', 'Ярославль', 500),
      row('a', 'Абакан', 1),
      row('m', 'Абакан', 1),
    ]

    const visible = selectVisibleLocations(items, ALL_CITIES_KEY)

    expect(visible.map((l) => l.totalTickets)).toEqual([500, 1, 1])
    // Ни алфавит города, ни алфавит идентификатора порядок не меняют.
    expect(visible.map((l) => l.locationId)).toEqual(['z', 'a', 'm'])
    expect(groupLocationsByCity(items).map((g) => g.cityLabel)).toEqual(['Абакан', 'Ярославль'])

    // Внутри выбранного города — тоже порядок ответа, не алфавит.
    expect(
      selectVisibleLocations(items, normalizeCityKey('Абакан')).map((l) => l.locationId),
    ).toEqual(['a', 'm'])

    // И при выборе нескольких точек порядок остаётся ответным.
    expect(
      selectVisibleLocations(items, ALL_CITIES_KEY, ['m', 'z']).map((l) => l.locationId),
    ).toEqual(['z', 'm'])
  })

  it('3. city = null/пустая строка/пробелы — одна понятная группа', () => {
    const groups = groupLocationsByCity([
      row('l1', null),
      row('l2', ''),
      row('l3', '   '),
      row('l4', 'Казань'),
    ])

    const noCity = groups.find((g) => g.cityKey === NO_CITY_KEY)
    expect(noCity?.cityLabel).toBe(NO_CITY_LABEL)
    expect(noCity?.locations.map((l) => l.locationId)).toEqual(['l1', 'l2', 'l3'])
    expect(groups).toHaveLength(2)

    expect(normalizeCityKey(undefined)).toBe(NO_CITY_KEY)
    expect(cityLabel(null)).toBe(NO_CITY_LABEL)
  })

  it('4. регистр и пробелы: одна группа, данные не меняются', () => {
    const rows = [row('l1', 'Москва'), row('l2', 'москва'), row('l3', '  МОСКВА  '), row('l4', 'Москва  Сити')]
    const groups = groupLocationsByCity(rows)

    const moscow = groups.find((g) => g.cityKey === 'москва')
    expect(moscow?.locations.map((l) => l.locationId)).toEqual(['l1', 'l2', 'l3'])
    // Подпись — написание первой встреченной строки, без крайних пробелов.
    expect(moscow?.cityLabel).toBe('Москва')
    // Внутренние пробелы сжимаются только в ключе; «Москва Сити» — другой город.
    expect(groups.map((g) => g.cityKey)).toEqual(['москва', 'москва сити'])

    // Исходные строки не мутированы: нормализация касается только ключа.
    expect(rows[2].city).toBe('  МОСКВА  ')
    expect(rows[1].city).toBe('москва')
  })

  it('5. выбор нескольких точек внутри города', () => {
    const items = [
      row('l1', 'Казань'),
      row('l2', 'Казань'),
      row('l3', 'Казань'),
      row('l4', 'Самара'),
    ]
    const kazan = normalizeCityKey('Казань')

    let selected = toggleLocationSelection([], 'l1')
    selected = toggleLocationSelection(selected, 'l3')
    expect(selected).toEqual(['l1', 'l3'])

    expect(selectVisibleLocations(items, kazan, selected).map((l) => l.locationId)).toEqual(['l1', 'l3'])

    // Повторное нажатие снимает выбор.
    selected = toggleLocationSelection(selected, 'l1')
    expect(selected).toEqual(['l3'])

    // Пустой выбор — это «все точки города», а не пустой экран.
    expect(selectVisibleLocations(items, kazan, []).map((l) => l.locationId)).toEqual(['l1', 'l2', 'l3'])

    // Точка другого города в выборе ничего не добавляет: доступ не расширяется.
    expect(selectVisibleLocations(items, kazan, ['l4']).map((l) => l.locationId)).toEqual([])
  })

  it('6. пустой ответ: групп нет, выбор ничего не ломает', () => {
    const items: Row[] = []
    const groups = groupLocationsByCity(items)

    expect(groups).toEqual([])
    expect(selectVisibleLocations(items, ALL_CITIES_KEY)).toEqual([])
    expect(selectVisibleLocations(items, 'казань', ['l1'])).toEqual([])
    expect(hasCityGroup(groups, ALL_CITIES_KEY)).toBe(true)
    expect(hasCityGroup(groups, 'казань')).toBe(false)
    expect(retainSelectableLocations(items, ALL_CITIES_KEY, ['l1'])).toEqual([])
  })

  it('7. выбор приводится к новому составу: смена города и обновление данных', () => {
    const items = [row('l1', 'Казань'), row('l2', 'Казань'), row('l3', 'Самара')]

    // Смена города сбрасывает точки другого города.
    expect(retainSelectableLocations(items, normalizeCityKey('Самара'), ['l1', 'l2'])).toEqual([])
    expect(retainSelectableLocations(items, normalizeCityKey('Казань'), ['l1', 'l3'])).toEqual(['l1'])

    // Исчезнувшая из ответа точка в выборе не остаётся.
    expect(retainSelectableLocations([row('l1', 'Казань')], ALL_CITIES_KEY, ['l1', 'l2'])).toEqual(['l1'])
  })

  it('8. возврат ко всем городам: выбранный город перестаёт сужать', () => {
    const items = [row('l1', 'Казань'), row('l2', 'Самара')]

    expect(selectVisibleLocations(items, normalizeCityKey('Казань')).map((l) => l.locationId)).toEqual(['l1'])
    expect(selectVisibleLocations(items, ALL_CITIES_KEY).map((l) => l.locationId)).toEqual(['l1', 'l2'])
  })

  it('9. порядок строк внутри города — как у бэкенда, не пересортирован', () => {
    // Бэкенд отдаёт по убыванию заявок; группировка этот порядок сохраняет.
    // Идентификаторы не по алфавиту — сортировка была бы заметна.
    const items = [row('l9', 'Казань', 40), row('l2', 'Казань', 7), row('l5', 'Казань', 19)]
    const groups = groupLocationsByCity(items)

    expect(groups[0].locations.map((l) => l.totalTickets)).toEqual([40, 7, 19])
    expect(groups[0].locations.map((l) => l.locationId)).toEqual(['l9', 'l2', 'l5'])
    expect(
      selectVisibleLocations(items, normalizeCityKey('Казань')).map((l) => l.locationId),
    ).toEqual(['l9', 'l2', 'l5'])
  })

  it('10. агрегаты заявок на фронтенде не пересчитываются', () => {
    /*
     * Phase 1 группирует и фильтрует уже разрешённые строки. Складывать
     * totalTickets по городу нельзя: канонические итоги считает бэкенд
     * (summary), и сумма по строкам ему не обязана совпадать.
     */
    const code = codeOf(readSrc('lib/locationAnalyticsGrouping.ts'))
    expect(code).not.toMatch(/totalTickets/)
    expect(code).not.toMatch(/overdueTickets/)
    expect(code).not.toMatch(/reduce\(/)

    // В группе есть только мощность, и она равна длине списка.
    const groups = groupLocationsByCity([row('l1', 'Казань', 40), row('l2', 'Казань', 7)])
    expect(groups[0].locationsCount).toBe(groups[0].locations.length)
  })

  it('11. страница берёт решения из этого модуля и не шлёт город на бэкенд', () => {
    const page = codeOf(readSrc('views/LocationAnalyticsPage.tsx'))
    expect(page).toContain('groupLocationsByCity(')
    expect(page).toContain('selectVisibleLocations(')
    expect(page).toContain('retainSelectableLocations(')

    /*
     * Phase 1 — только фронтенд: ни city, ни locationIds[] в запрос не
     * уезжают, иначе бэкенд пришлось бы менять.
     */
    expect(page).not.toMatch(/city:\s/)
    expect(page).not.toMatch(/locationIds/)

    // Канонический summary остаётся от бэкенда.
    expect(page).toContain('summary?.totalTickets')

    /*
     * Список обязан рисоваться ПО ОТОБРАННЫМ строкам. Без этого выбор
     * города и точек остался бы украшением: контроль показал, что замена
     * visibleLocations на items не ломала ни одной проверки.
     */
    expect(page).toContain('visibleLocations.map(')
    expect(page).not.toContain('items.map(')

    /*
     * Отбор идёт по исходным строкам, иначе порядок бэкенда теряется.
     */
    expect(page).toContain('selectVisibleLocations(items, selectedCityKey')
    expect(page).toContain('retainSelectableLocations(items, selectedCityKey')
    expect(page).not.toContain('selectVisibleLocations(cityGroups')
  })

  it('12. подпись у сводки — видимый текст, а не комментарий', () => {
    /*
     * Ревью нашло, что оговорка про область показателей лежала в JSX-комментарии,
     * то есть пользователю её не видно: при выбранном городе список сужался, а
     * «Всего заявок» оставалось по всей области и читалось как итог выбора.
     *
     * codeOf срезает комментарии — если подпись переживает срез, это разметка.
     */
    const page = codeOf(readSrc('views/LocationAnalyticsPage.tsx'))
    expect(page).toMatch(/Показатели рассчитаны по всему доступному объёму данных/)

    // И по-прежнему никаких пересчётов: итоги берутся у бэкенда.
    expect(page).toContain('summary?.totalTickets')
    expect(page).not.toMatch(/\.reduce\(/)
  })
})
