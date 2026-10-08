import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import {
  MANAGEMENT_ROUTES,
  buildManagementBreadcrumbs,
  validateManagementRoutes,
} from '../lib/managementRouteMeta'
import { resolveLocationCardFailure, shouldShowCoordinates } from './LocationPage'

/**
 * SMA-LOCATION-CARD-L1-098.
 *
 * Оболочка карточки объекта. Проверяется три вещи: маршрут и крошки описаны
 * согласованно, список ведёт на карточку, и карточка показывает ровно
 * разрешённый V1 состав — без контактов, заметок, вложений, истории
 * и счётчиков.
 *
 * Окружение тестов node, DOM нет, поэтому решения, которые можно вынести
 * в чистые функции, проверяются исполнением: видимость координат и разбор
 * отказа загрузки. Всё, что существует только как разметка, проверяется
 * по исходнику — это принятая здесь идиома (см. managementRouteMeta.test.ts).
 */

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')

const locationPageSource = readSrc('views/LocationPage.tsx')

/**
 * Исходник без комментариев.
 *
 * Проверки «этого в карточке нет» обязаны смотреть на код, а не на прозу:
 * пояснение сверху перечисляет как раз то, чего в срезе нет, и дословный
 * поиск по всему файлу спотыкался бы о собственное объяснение.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

const locationPageCode = codeOf(locationPageSource)

const metaFor = (path: string) => MANAGEMENT_ROUTES.find((route) => route.path === path)

describe('098/1 маршрут карточки', () => {
  it('1. /locations/:id объявлен в управленческом Shell', () => {
    const router = readSrc('router.tsx')
    const block = router.slice(
      router.indexOf('path="/"', router.indexOf('path="/m"')),
      router.indexOf('path="/max"'),
    )

    expect(block).toContain('<Route path="locations/:id"')
    // Страница одна, второй карточки объекта не заведено.
    expect(router.match(/path="locations\/:id"/g)).toHaveLength(1)
    expect(block).toContain('component={LocationPage}')
  })

  it('1. маршрут не подменяет список и соседнюю аналитику', () => {
    const router = readSrc('router.tsx')
    expect(router).toContain('<Route path="locations"')
    expect(router).toContain('<Route path="analytics/locations"')
  })
})

describe('098/2 описание маршрута', () => {
  it('2. карточка описана ровно утверждённым набором полей', () => {
    expect(metaFor('/locations/:id')).toEqual({
      path: '/locations/:id',
      section: 'objects',
      pageLabel: 'Объект',
      breadcrumbLabel: 'Объект',
      parentPath: '/locations',
      entity: 'location',
      primaryNav: false,
    })
  })

  it('2. крошки дают «Точки → Объект», последняя не ссылка', () => {
    const crumbs = buildManagementBreadcrumbs('/locations/8f14e45f-ceea-467a-9a3c-1f0b9b6f2a11')

    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Объекты и оборудование', 'Точки', 'Объект'])
    expect(crumbs[1].to).toBe('/locations')
    expect(crumbs[2].to).toBeNull()
  })

  it('2. карта маршрутов осталась непротиворечивой', () => {
    expect(validateManagementRoutes()).toEqual([])
  })
})

describe('098/3 список ведёт на карточку', () => {
  const listSource = readSrc('components/locations/LocationList.tsx')

  it('3. имя объекта в строке списка — ссылка на /locations/:id', () => {
    // Путь строится общим билдером (locationCardPath), а не шаблоном на месте.
    expect(listSource).toContain('locationCardPath(')
    expect(listSource).toContain('<Link to={cardTo}>{location.name}</Link>')
  })

  it('3. ссылка несёт область списка, иначе карточка провайдера упрётся в 404', () => {
    /*
     * Область по-прежнему уезжает в ссылку, но ТЕМ параметром, который
     * контур использует: у провайдера scopeCompanyId — это id связанного
     * клиента, и «?companyId=» терял linked-часть сохранённой области с
     * первого же перехода.
     */
    expect(listSource).toContain('scopeCompanyId')
    expect(listSource).toContain('{ linkedClientCompanyId: scopeCompanyId }')
    expect(listSource).toContain('{ companyId: scopeCompanyId }')
    expect(listSource).not.toContain('companyId=${encodeURIComponent(scopeCompanyId)}')

    const page = readSrc('views/LocationsPage.tsx')
    expect(page).toContain('scopeCompanyId={scopeCompanyId}')
    expect(page).toContain('isProviderScope={isProviderScope}')
  })
})

describe('098/4 карточка читает существующий API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch() {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any) => {
        calls.push(String(url))
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 'loc-1', name: 'Точка' }),
        } as any
      }),
    )
    return calls
  }

  it('4. getLocation обращается к GET /locations/:id', async () => {
    const calls = stubFetch()

    await api.getLocation('loc-1')

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/locations/loc-1')
    expect(calls[0]).not.toContain('?companyId=')
  })

  it('4. область передаётся тем же параметром, что и в списке', async () => {
    const calls = stubFetch()

    await api.getLocation('loc-1', 'client-42')

    expect(calls[0]).toContain('/locations/loc-1?companyId=client-42')
  })

  it('4. второго endpoint под карточку не заведено', () => {
    /*
     * Проверяются пути запросов, а не ключи кэша: после L2 карточка держит
     * ключи вида 'location-card-…', и дословный поиск по имени спотыкался бы
     * о них, ничего не проверяя.
     */
    expect(locationPageCode).toContain('api.getLocation(')
    expect(locationPageCode).not.toContain("'/locations/card")
    expect(locationPageCode).not.toContain("'/location-card")
    expect(locationPageCode).not.toMatch(/\/locations\/\$\{[^}]+\}\/(card|summary)/)
  })
})

describe('098/5 состав карточки V1', () => {
  it('5. показаны только утверждённые скалярные поля', () => {
    for (const field of [
      'location.name',
      'location.platformCode',
      'location.externalCode',
      'location.city',
      'location.region',
      'location.address',
      'location.latitude',
      'location.longitude',
    ]) {
      expect(locationPageSource, field).toContain(field)
    }
    // Статус берётся из существующей семантики, своего поля status у API нет.
    expect(locationPageSource).toContain('location.deletedAt')
    expect(locationPageSource).toContain('location.isActive')
  })
})

describe('098/6 координаты', () => {
  it('6. показываются только когда есть обе величины', () => {
    expect(shouldShowCoordinates({ latitude: 55.75, longitude: 37.62 })).toBe(true)
    expect(shouldShowCoordinates({ latitude: 0, longitude: 0 })).toBe(true)
  })

  it('6. скрыты, если не хватает любой из них', () => {
    expect(shouldShowCoordinates({ latitude: 55.75, longitude: null })).toBe(false)
    expect(shouldShowCoordinates({ latitude: null, longitude: 37.62 })).toBe(false)
    expect(shouldShowCoordinates({})).toBe(false)
    expect(shouldShowCoordinates({ latitude: null, longitude: null })).toBe(false)
  })

  it('6. координаты ведут на существующую карту и не встраивают её', () => {
    expect(locationPageSource).toContain('<Link to="/map">')
    for (const embed of ['iframe', 'ymaps', 'YMaps', 'leaflet', 'mapbox', 'GoogleMap']) {
      expect(locationPageCode, embed).not.toContain(embed)
    }
  })
})

describe('098/7 404 ничего не выдаёт', () => {
  it('7. недоступный и несуществующий объект дают одно состояние', () => {
    /*
     * Бэкенд отвечает одинаковым 404 на объект вне области видимости
     * и на несуществующий. Клиент обязан вести себя так же: любое различие
     * здесь превратилось бы в способ проверить существование чужой точки.
     */
    const outOfScope = new api.ApiRequestError('Location not found', 404, { message: 'Location not found' })
    const missing = new api.ApiRequestError('Location not found', 404, { message: 'Location not found' })

    expect(resolveLocationCardFailure(outOfScope)).toBe('not-found')
    expect(resolveLocationCardFailure(missing)).toBe('not-found')
    expect(resolveLocationCardFailure(outOfScope)).toBe(resolveLocationCardFailure(missing))
  })

  it('7. прочие отказы не выдаются за «не найдено»', () => {
    expect(resolveLocationCardFailure(new api.ApiRequestError('Forbidden', 403))).toBe('error')
    expect(resolveLocationCardFailure(new api.ApiRequestError('Boom', 500))).toBe('error')
    expect(resolveLocationCardFailure(new Error('network'))).toBe('error')
    expect(resolveLocationCardFailure(undefined)).toBe('error')
  })

  it('7. состояние «не найдено» единственное и ведёт назад к списку', () => {
    expect(locationPageCode.match(/Объект не найден/g)?.length).toBeGreaterThanOrEqual(1)
    expect(locationPageCode).toContain('К списку точек')
    // Ни кода ответа, ни причины отказа в разметку не просачивается.
    expect(locationPageCode).not.toContain('403')
    expect(locationPageCode).not.toContain('Нет доступа')
    expect(locationPageCode).not.toContain('Forbidden')
  })

  it('7. загрузка и ошибка имеют свои состояния', () => {
    expect(locationPageSource).toContain('Загружаем объект…')
    expect(locationPageSource).toContain('Повторить')
    expect(locationPageSource).toContain('refetch()')
  })
})

describe('098/8-12 объём среза не расширен', () => {
  const forbidden: Array<[string, string[]]> = [
    ['8. контакты', ['Контакт', 'contacts', 'Contacts', 'phone', 'Телефон']],
    ['9. заметки', ['Заметк', 'notes', 'Notes', 'comment', 'Комментар']],
    ['10. вложения', ['Вложени', 'attachment', 'Attachment', 'upload', 'Файл']],
    ['11. история', ['История', 'history', 'History', 'timeline', 'Timeline']],
    /*
     * L2 (SMA-LOCATION-CARD-L2-AGGREGATES-102) по решению владельца добавил
     * сводки по оборудованию, заявкам и обходам — их запрет снят здесь
     * осознанно. Ответственные остались отложенными: готового
     * location-scoped API под них нет, и карточка их не показывает.
     */
    ['12. ответственные', ['Ответственн', 'locationBindings', 'responsible']],
  ]

  it.each(forbidden)('%s в карточке отсутствуют', (_label, needles) => {
    for (const needle of needles) {
      expect(locationPageCode, needle).not.toContain(needle)
    }
  })

  it('12. карточка не ходит ни в один посторонний API', () => {
    // Состав расширен ровно на три сводки L2 и больше ни на что.
    const apiCalls = [...locationPageCode.matchAll(/api\.([A-Za-z0-9_]+)\(/g)].map((m) => m[1])
    expect([...new Set(apiCalls)].sort()).toEqual([
      'analyticsLocations',
      'equipmentByLocation',
      'getInspectionSchedules',
      'getLocation',
      'listEquipment',
    ])
  })
})
