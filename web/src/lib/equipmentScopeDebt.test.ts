import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as api from './api'
import { equipmentListPath, locationCardPath } from './equipmentCard'

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')

/**
 * SMA-EQUIPMENT-V2 — закрытие отложенных долгов области.
 *
 * Три дефекта, отложенных при закрытии Equipment V2:
 *  1. persistScopeFromSearchParams писал пару областей целиком;
 *  2. список точек отдавал провайдерский контур как «?companyId=»;
 *  3. PLATFORM_ADMIN отсутствовал в двух ручках чтения оборудования.
 */

/* Минимальный localStorage: модуль api работает с window.localStorage. */
function installStorage() {
  const data = new Map<string, string>()
  const storage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size
    },
  }
  /*
   * location.search обязателен: читатели области сначала смотрят адрес и
   * только потом сохранённое значение. Пустая строка = «в адресе ничего».
   */
  ;(globalThis as any).window = {
    localStorage: storage,
    sessionStorage: storage,
    location: { search: '' },
  }
  ;(globalThis as any).localStorage = storage
  return data
}

const OWNER = { userId: 'user-1', companyId: 'provider-1', role: 'ADMIN' as const }

describe('1. область обновляется поключево, а не парой целиком', () => {
  beforeEach(() => {
    installStorage()
  })

  it('«?companyId=» не уничтожает linkedClientCompanyId', () => {
    // Провайдер уже в контуре связанного клиента.
    api.persistScopeFromSearchParams(new URLSearchParams('linkedClientCompanyId=client-A'), OWNER)
    expect(api.getLinkedClientCompanyId(OWNER)).toBe('client-A')

    /*
     * Переход несёт только companyId. Прежняя редакция записывала пару
     * целиком и обнуляла linked-часть — контур менялся от одного клика.
     */
    api.persistScopeFromSearchParams(new URLSearchParams('companyId=client-A'), OWNER)

    expect(api.getLinkedClientCompanyId(OWNER)).toBe('client-A')
  })

  it('«?linkedClientCompanyId=» не уничтожает companyId', () => {
    api.persistScopeFromSearchParams(new URLSearchParams('companyId=observed-1'), OWNER)
    expect(api.getObserverCompanyId(OWNER)).toBe('observed-1')

    api.persistScopeFromSearchParams(new URLSearchParams('linkedClientCompanyId=client-B'), OWNER)

    expect(api.getObserverCompanyId(OWNER)).toBe('observed-1')
    expect(api.getLinkedClientCompanyId(OWNER)).toBe('client-B')
  })

  it('контур переживает цепочку переходов: список → карточка → история → назад', () => {
    api.persistScopeFromSearchParams(new URLSearchParams('linkedClientCompanyId=client-A'), OWNER)

    // Каждый переход внутри карточки несёт свою область — и ни один не теряет контур.
    for (const search of [
      'linkedClientCompanyId=client-A',
      'companyId=client-A',
      'linkedClientCompanyId=client-A&tab=history',
      'companyId=client-A&tab=parts',
      '',
    ]) {
      api.persistScopeFromSearchParams(new URLSearchParams(search), OWNER)
      expect(api.getLinkedClientCompanyId(OWNER), `search=${search}`).toBe('client-A')
    }
  })

  it('чужая сохранённая область не подмешивается', () => {
    api.persistScopeFromSearchParams(new URLSearchParams('linkedClientCompanyId=client-A'), OWNER)

    // Другой владелец — сохранённое значение не наследуется.
    const other = { userId: 'user-2', companyId: 'provider-2', role: 'ADMIN' as const }
    api.persistScopeFromSearchParams(new URLSearchParams('companyId=observed-9'), other)

    expect(api.getLinkedClientCompanyId(other)).toBe('')
  })

  it('пустой адрес ничего не перезаписывает', () => {
    api.persistScopeFromSearchParams(new URLSearchParams('linkedClientCompanyId=client-A'), OWNER)
    api.persistScopeFromSearchParams(new URLSearchParams(''), OWNER)
    expect(api.getLinkedClientCompanyId(OWNER)).toBe('client-A')
  })
})

describe('2. список точек сохраняет канонический контур с первого перехода', () => {
  it('провайдеру уезжает linkedClientCompanyId, не companyId', () => {
    const list = readSrc('components/locations/LocationList.tsx')

    expect(list).toContain('locationCardPath(')
    expect(list).toContain('{ linkedClientCompanyId: scopeCompanyId }')
    expect(list).toContain('{ companyId: scopeCompanyId }')
    // Прежней формы, терявшей linked-контур, не осталось.
    expect(list).not.toMatch(/\/locations\/\$\{location\.id\}\?companyId=/)

    // Вызывающий передаёт признак контура: роль список не выводит.
    expect(readSrc('views/LocationsPage.tsx')).toContain('isProviderScope={isProviderScope}')
  })

  it('построитель отдаёт ровно тот параметр, который получил', () => {
    expect(locationCardPath('loc-1', { linkedClientCompanyId: 'client-A' })).toBe(
      '/locations/loc-1?linkedClientCompanyId=client-A',
    )
    expect(locationCardPath('loc-1', { companyId: 'observed-1' })).toBe('/locations/loc-1?companyId=observed-1')
    expect(locationCardPath('loc-1', { companyId: '' })).toBe('/locations/loc-1')
  })

  it('карточка точки принимает оба параметра и возвращает тот же', () => {
    const page = readSrc('views/LocationPage.tsx')
    expect(page).toContain("searchParams.get('linkedClientCompanyId')")
    expect(page).toContain('const companyId = scopeFromCompanyId || scopeFromLinkedClient')
    expect(page).toContain('equipmentCardPath(unit.id, outboundScope)')
  })

  it('переход к списку оборудования сохраняет ровно входной контур', () => {
    expect(equipmentListPath({ linkedClientCompanyId: 'client-A' })).toBe(
      '/equipment?linkedClientCompanyId=client-A',
    )
    expect(equipmentListPath({ linkedClientCompanyId: 'client-B' })).toBe(
      '/equipment?linkedClientCompanyId=client-B',
    )
    expect(equipmentListPath({ companyId: 'client-own' })).toBe(
      '/equipment?companyId=client-own',
    )
    expect(equipmentListPath({})).toBe('/equipment')

    const page = readSrc('views/LocationPage.tsx')
    expect(page).toContain('equipmentListPath(outboundScope)')
    expect(page).not.toContain('<Link to="/equipment">')
  })
})

describe('3. PLATFORM_ADMIN читает оборудование по существующему контракту', () => {
  const controller = () => readSrc('../../backend/src/equipment/equipment.controller.ts')

  it('обе ручки чтения включают наблюдателя, как и соседние', () => {
    const src = controller()
    const getById = src.slice(src.indexOf("@Get(':id')"), src.indexOf('findOne('))
    const byLocation = src.slice(src.indexOf("@Get('location/:locationId')"), src.indexOf('findAllByLocation('))

    expect(getById).toContain('UserRole.PLATFORM_ADMIN')
    expect(byLocation).toContain('UserRole.PLATFORM_ADMIN')
  })

  it('права и механизм области не менялись', () => {
    const src = controller()
    // Тот же LOCATIONS_VIEW, никакого отдельного капабилити под оборудование.
    expect(src).toContain('@RequirePermission(PERMISSIONS.LOCATIONS_VIEW)')
    expect(src).not.toContain('EQUIPMENT_VIEW')
    expect(src).not.toContain('EQUIPMENT_MANAGE')

    /*
     * Область сужает сервис существующим механизмом: отдельного резолвера
     * под наблюдателя не появляется, wildcard-гранта нет.
     */
    const service = readSrc('../../backend/src/equipment/equipment.service.ts')
    expect(service).toContain('resolveObserverScopeCompanyId')
    expect(service).toContain('CompanyType.CLIENT')
  })

  it('запись наблюдателю не открывается', () => {
    const src = controller()
    const writeBlock = src.slice(src.indexOf("@Patch(':id')"))
    expect(writeBlock).not.toContain('UserRole.PLATFORM_ADMIN')
  })
})
