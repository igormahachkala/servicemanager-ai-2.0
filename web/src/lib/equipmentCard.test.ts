import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildPublicRequestLink } from './api'
import { appendBoardNavigationContextToPath } from './boardNavigationContext'
import {
  MANAGEMENT_ROUTES,
  buildManagementBreadcrumbs,
  validateManagementRoutes,
} from './managementRouteMeta'
import {
  canCreateTicketForEquipment,
  equipmentCreateTicketPath,
  equipmentPassportRows,
  equipmentPublicRequestLink,
  equipmentStatusLabel,
  equipmentTicketsPath,
  isEquipmentRetired,
  isWarrantyExpired,
} from './equipmentCard'

/**
 * SMA-EQUIPMENT-V2-FOUNDATION.
 *
 * Фундамент: отдельная карточка оборудования с прямой ссылкой и крошками,
 * связи Location↔Equipment↔Ticket и цепочка QR → Equipment → Ticket на
 * существующем публичном потоке.
 *
 * Окружение тестов node, DOM нет: решения проверяются исполнением, разметка
 * и маршруты — по исходнику.
 */

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const cardCode = codeOf(readSrc('views/EquipmentCardPage.tsx'))
const routerCode = readSrc('router.tsx')
const publicPageCode = codeOf(readSrc('views/PublicQuickRequestPage.tsx'))
const createTicketCode = codeOf(readSrc('views/CreateTicketPage.tsx'))

describe('V2 карточка оборудования: маршрут и крошки', () => {
  it('маршрут /equipment/:id объявлен в управленческом Shell', () => {
    const block = routerCode.slice(
      routerCode.indexOf('path="/"', routerCode.indexOf('path="/m"')),
      routerCode.indexOf('path="/max"'),
    )
    expect(block).toContain('<Route path="equipment/:id"')
    expect(block).toContain('component={EquipmentCardPage}')
    // Список остался на месте.
    expect(block).toContain('<Route path="equipment"')
  })

  it('карточка описана в карте маршрутов как дочерняя для списка', () => {
    expect(MANAGEMENT_ROUTES.find((route) => route.path === '/equipment/:id')).toEqual({
      path: '/equipment/:id',
      section: 'objects',
      pageLabel: 'Оборудование',
      breadcrumbLabel: 'Оборудование',
      parentPath: '/equipment',
      entity: 'equipment',
      primaryNav: false,
    })
  })

  it('крошки ведут от раздела через список к карточке', () => {
    const crumbs = buildManagementBreadcrumbs('/equipment/8f14e45f-ceea-467a-9a3c-1f0b9b6f2a11')

    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      'Объекты и оборудование',
      'Оборудование',
      'Оборудование',
    ])
    expect(crumbs[1].to).toBe('/equipment')
    expect(crumbs[2].to).toBeNull()
  })

  it('карта маршрутов осталась непротиворечивой', () => {
    expect(validateManagementRoutes()).toEqual([])
  })

  it('карточка доступна по прямой ссылке, а не выбором в списке', () => {
    expect(cardCode).toContain('useParams<{ id: string }>()')
    expect(codeOf(readSrc('views/EquipmentPage.tsx'))).toContain('/equipment/${item.id}')
  })
})

describe('V2 паспорт и жизненный цикл', () => {
  it('показываются только заполненные поля', () => {
    const rows = equipmentPassportRows({
      type: 'Кондиционер',
      manufacturer: 'Daikin',
      model: '',
      serialNumber: 'SN-1',
      inventoryNumber: null,
      commissionedAt: '2026-01-15T00:00:00.000Z',
      warrantyUntil: null,
      description: '   ',
    })

    expect(rows.map((row) => row.label)).toEqual([
      'Тип',
      'Производитель',
      'Серийный номер',
      'Введено в эксплуатацию',
    ])
  })

  it('жизненный цикл показывается как есть в Production, без переименования', () => {
    /*
     * Целевой набор ACTIVE/UNDER_REPAIR/RETIRED/REPLACED в этом фундаменте
     * НЕ вводится: это отдельное продуктовое решение и миграция. Карточка
     * обязана показывать то, что лежит в базе.
     */
    expect(equipmentStatusLabel('ACTIVE')).toBe('В работе')
    expect(equipmentStatusLabel('REPAIR')).toBe('В ремонте')
    expect(equipmentStatusLabel('INACTIVE')).toBe('Не используется')
    expect(equipmentStatusLabel('DECOMMISSIONED')).toBe('Списано')
    expect(equipmentStatusLabel('')).toBe('—')
  })

  it('незнакомое состояние не подменяется', () => {
    expect(equipmentStatusLabel('UNDER_REPAIR')).toBe('UNDER_REPAIR')
  })

  it('снятое оборудование помечается', () => {
    expect(isEquipmentRetired('INACTIVE')).toBe(true)
    expect(isEquipmentRetired('DECOMMISSIONED')).toBe(true)
    expect(isEquipmentRetired('ACTIVE')).toBe(false)
    expect(isEquipmentRetired('REPAIR')).toBe(false)
  })

  it('гарантия без даты не объявляется истёкшей', () => {
    const now = new Date('2026-10-05T12:00:00.000Z')
    expect(isWarrantyExpired(null, now)).toBeNull()
    expect(isWarrantyExpired('', now)).toBeNull()
    expect(isWarrantyExpired('не дата', now)).toBeNull()
    expect(isWarrantyExpired('2026-01-01T00:00:00.000Z', now)).toBe(true)
    expect(isWarrantyExpired('2027-01-01T00:00:00.000Z', now)).toBe(false)
  })
})

describe('V2 связи Location ↔ Equipment ↔ Ticket', () => {
  it('объект показывает своё оборудование ссылками на карточки', () => {
    const locationCode = codeOf(readSrc('views/LocationPage.tsx'))
    expect(locationCode).toContain('api.equipmentByLocation(locationId')
    expect(locationCode).toContain('/equipment/${unit.id}')
  })

  it('заявка показывает оборудование и ведёт в карточку', () => {
    const ticketCode = codeOf(readSrc('views/TicketPage.tsx'))
    expect(ticketCode).toContain('/equipment/${ticket.equipment.id}')
  })

  it('создание заявки идёт существующим маршрутом с предзаполнением', () => {
    expect(equipmentCreateTicketPath({ id: 'eq-1', locationId: 'loc-1' })).toBe(
      '/tickets/new?locationId=loc-1&equipmentId=eq-1',
    )
    // Второго создателя заявок не появляется: это /tickets/new.
    expect(cardCode).not.toContain('/equipment/new-ticket')
  })

  it('форма создания действительно читает предзаполнение', () => {
    /*
     * Иначе ссылка вела бы на незаполненную форму — параметр, который
     * страница игнорирует, хуже отсутствия параметра.
     */
    expect(createTicketCode).toContain("searchParams.get('locationId')")
    expect(createTicketCode).toContain("searchParams.get('equipmentId')")
    expect(createTicketCode).toContain('useState(presetLocationId)')
    expect(createTicketCode).toContain('useState(presetEquipmentId)')
  })

  it('заявки оборудования открываются существующим контрактом доски', () => {
    const path = equipmentTicketsPath({ id: 'eq-1' }, appendBoardNavigationContextToPath)
    expect(path).toContain('boardEquipmentId=eq-1')
    // Выдуманного параметра нет.
    expect(path).not.toContain('?equipmentId=')
  })

  it('снятое оборудование новых заявок не предлагает', () => {
    expect(canCreateTicketForEquipment({ status: 'ACTIVE', locationId: 'loc-1' })).toBe(true)
    expect(canCreateTicketForEquipment({ status: 'INACTIVE', locationId: 'loc-1' })).toBe(false)
    expect(canCreateTicketForEquipment({ status: 'REPAIR', locationId: 'loc-1' })).toBe(false)
    // Без объекта заявку по оборудованию создать нельзя.
    expect(canCreateTicketForEquipment({ status: 'ACTIVE', locationId: null })).toBe(false)
  })
})

describe('V2 QR → Equipment → Ticket', () => {
  it('1. ссылка объекта без оборудования работает как раньше', () => {
    expect(buildPublicRequestLink('tok', 'loc-1')).toContain('/r/tok')
    expect(buildPublicRequestLink('tok', 'loc-1')).toContain('locationId=loc-1')
    expect(buildPublicRequestLink('tok', 'loc-1')).not.toContain('equipmentId')
  })

  it('8. старые вызовы с одним и двумя аргументами не ломаются', () => {
    expect(buildPublicRequestLink('tok')).toContain('/r/tok')
    expect(buildPublicRequestLink('tok')).not.toContain('locationId')
    expect(buildPublicRequestLink(null)).toBe('')
    expect(buildPublicRequestLink('tok', null)).not.toContain('locationId')
  })

  it('2. ссылка оборудования ведёт в тот же публичный поток', () => {
    const link = buildPublicRequestLink('tok', 'loc-1', 'eq-1')

    expect(link).toContain('/r/tok')
    expect(link).toContain('locationId=loc-1')
    expect(link).toContain('equipmentId=eq-1')
    // Своей публичной страницы под оборудование не заводится.
    expect(link).not.toContain('/equipment')
  })

  it('оборудование без объекта в ссылку не попадает', () => {
    // Форма выбирает оборудование внутри точки; без точки параметр бессмыслен.
    expect(buildPublicRequestLink('tok', null, 'eq-1')).not.toContain('equipmentId')
  })

  it('3, 4. страница читает оба предзаполнения', () => {
    expect(publicPageCode).toContain("searchParams.get('locationId')")
    expect(publicPageCode).toContain("searchParams.get('equipmentId')")
    expect(publicPageCode).toContain('setEquipmentId(presetEquipmentId)')
  })

  it('4. оборудование предзаполняется только если оно есть на точке', () => {
    /*
     * Иначе пользователь увидел бы выбранным то, чего в списке нет, а бэкенд
     * потом отказал бы. Проверка идёт по уже полученному списку точки.
     */
    expect(publicPageCode).toContain('rows.some((item) => item.id === presetEquipmentId)')
  })

  it('6, 7. каноническая проверка остаётся на бэкенде', () => {
    const backend = readSrc('../../backend/src/public-request/public-request.service.ts')

    // Чужая компания, другая точка и неактивное оборудование отсекаются там.
    expect(backend).toContain('private async resolveEquipment')
    expect(backend).toMatch(/companyId,\s*\n\s*locationId,\s*\n\s*status: 'ACTIVE',/)
    expect(backend).toContain("throw new NotFoundException('Equipment not found')")
  })

  it('нового публичного бэкенда под QR не появилось', () => {
    const controller = readSrc('../../backend/src/public-request/public-request.controller.ts')
    expect(controller).not.toContain('equipment/qr')
    expect(controller).not.toContain('/qr')
  })

  it('карточка использует существующее модальное окно QR', () => {
    expect(cardCode).toContain('PublicQrModalLazy')
    expect(cardCode).toContain('equipmentPublicRequestLink')
    // Своего генератора QR не заводится.
    expect(cardCode).not.toContain('QRCode.toDataURL')
  })

  it('без токена кнопки QR нет: ссылка, ведущая никуда, не показывается', () => {
    expect(
      equipmentPublicRequestLink({
        buildLink: buildPublicRequestLink,
        token: null,
        locationId: 'loc-1',
        equipmentId: 'eq-1',
      }),
    ).toBe('')
    expect(
      equipmentPublicRequestLink({
        buildLink: buildPublicRequestLink,
        token: 'tok',
        locationId: '',
        equipmentId: 'eq-1',
      }),
    ).toBe('')
    expect(cardCode).toContain('qrUrl ? (')
  })
})

describe('V2 доступ: новой модели прав не вводится', () => {
  it('карточка читает теми же ручками, что и список', () => {
    // Всё обращение к api — и вызовы, и переданные по ссылке.
    const used = [...cardCode.matchAll(/api\.([A-Za-z0-9_]+)/g)].map((m) => m[1])
    expect([...new Set(used)].sort()).toEqual([
      'buildPublicRequestLink',
      'company',
      'getEquipment',
      'isFullAdminDesktopNavRole',
      'me',
    ])
  })

  it('бэкенд остаётся источником истины: прав на фронте не вычисляется', () => {
    expect(cardCode).not.toContain('PERMISSIONS')
    expect(cardCode).not.toContain('hasPermission')
    expect(cardCode).not.toContain('LOCATIONS_MANAGE')
  })

  it('существующие права маршрутов оборудования не менялись', () => {
    const controller = readSrc('../../backend/src/equipment/equipment.controller.ts')

    // Чтение — LOCATIONS_VIEW, запись — LOCATIONS_MANAGE, как было.
    expect(controller).toContain('@RequirePermission(PERMISSIONS.LOCATIONS_VIEW)')
    expect(controller).toContain('@RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)')
    expect(controller).not.toContain('EQUIPMENT_VIEW')
    expect(controller).not.toContain('EQUIPMENT_MANAGE')
  })

  it('недоступное и несуществующее оборудование неотличимы', () => {
    expect(cardCode).toContain('Оборудование не найдено')
    expect(cardCode).not.toContain('403')
    expect(cardCode).not.toContain('Нет доступа')
  })
})

describe('V2 объём фундамента', () => {
  const deferred: Array<[string, string[]]> = [
    ['склад', ['warehouse', 'Склад']],
    ['ТО/ППР', ['maintenancePlan', 'ППР', 'Регламент']],
    ['TCO и аналитика отказов', ['tco', 'TCO', 'failureAnalytics']],
    ['предиктив', ['predictive', 'Предиктив']],
    ['FailureCause', ['failureCause', 'FailureCause']],
  ]

  it.each(deferred)('%s в фундамент не входит', (_label, needles) => {
    for (const needle of needles) {
      expect(cardCode, needle).not.toContain(needle)
    }
  })

  it('схема и миграции не затронуты этим фундаментом', () => {
    // Решение владельца: lifecycle enum и FailureCause — отдельной задачей.
    expect(cardCode).not.toContain('lifecycleStatus')
  })
})
