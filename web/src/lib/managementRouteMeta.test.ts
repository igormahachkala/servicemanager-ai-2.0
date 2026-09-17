import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  MANAGEMENT_ROUTES,
  MANAGEMENT_SECTION_LABELS,
  buildManagementBreadcrumbs,
  looksLikeOpaqueId,
  matchManagementRoute,
  validateManagementRoutes,
} from './managementRouteMeta'

/**
 * SMA-MANAGEMENT-IA-BREADCRUMBS-121A.
 *
 * Проверяется чистый построитель, а не разметка: компонент рисует то, что
 * здесь решено, и отдельной логики не имеет. Окружение тестов node, DOM нет —
 * именно поэтому решение вынесено в чистый модуль.
 */

const labels = (pathname: string, options?: Parameters<typeof buildManagementBreadcrumbs>[1]) =>
  buildManagementBreadcrumbs(pathname, options).map((crumb) => crumb.label)

describe('121A разделы и страницы', () => {
  it.each([
    ['/board', ['Заявки', 'Доска']],
    ['/tickets', ['Заявки', 'Реестр']],
    ['/archive', ['Заявки', 'Архив']],
    ['/inspection/schedules', ['Обходы и планирование', 'План обходов']],
    ['/inspection/templates', ['Обходы и планирование', 'Шаблоны']],
    ['/inspection/runs', ['Обходы и планирование', 'История']],
    ['/locations', ['Объекты и оборудование', 'Точки']],
    ['/equipment', ['Объекты и оборудование', 'Оборудование']],
    ['/map', ['Объекты и оборудование', 'Карта']],
    ['/employees', ['Сотрудники и работа', 'Сотрудники']],
    ['/workforce', ['Сотрудники и работа', 'Смены и трудозатраты']],
    ['/analytics', ['Аналитика', 'Аналитика']],
    ['/company', ['Настройки', 'Компания']],
    ['/problem-categories', ['Настройки', 'Категории проблем']],
    ['/specializations', ['Настройки', 'Специализации']],
    ['/service-contracts', ['Настройки', 'Договоры и подрядчики']],
    ['/companies', ['Платформа', 'Компании']],
    ['/platform/permissions', ['Платформа', 'Роли и права']],
  ])('%s → %s', (pathname, expected) => {
    expect(labels(pathname)).toEqual(expected)
  })

  it('все подписи разделов на русском и заданы один раз', () => {
    for (const label of Object.values(MANAGEMENT_SECTION_LABELS)) {
      expect(label.trim()).not.toBe('')
      expect(/[А-Яа-яЁё]/.test(label)).toBe(true)
    }
  })
})

describe('121A вложенность и сущности', () => {
  it('заявка встаёт под реестр, а не под раздел напрямую', () => {
    const crumbs = buildManagementBreadcrumbs('/tickets/8f14e45f-ceea-467a-9a3c-1f0b9b6f2a11')
    expect(crumbs.map((c) => c.label)).toEqual(['Заявки', 'Реестр', 'Заявка'])
    // Ссылка на реестр настоящая, последняя крошка ссылкой не является.
    expect(crumbs[1].to).toBe('/tickets')
    expect(crumbs[2].to).toBeNull()
  })

  it('10. подпись сущности берётся из данных страницы', () => {
    const crumbs = buildManagementBreadcrumbs('/tickets/8f14e45f-ceea-467a-9a3c-1f0b9b6f2a11', {
      entityLabels: { '/tickets/:id': 'Заявка №123' },
    })
    expect(crumbs.map((c) => c.label)).toEqual(['Заявки', 'Реестр', 'Заявка №123'])
  })

  it('11. идентификатор не становится подписью для человека', () => {
    const uuid = '8f14e45f-ceea-467a-9a3c-1f0b9b6f2a11'
    const crumbs = buildManagementBreadcrumbs(`/tickets/${uuid}`, {
      // Страница по ошибке отдала идентификатор вместо названия.
      entityLabels: { '/tickets/:id': uuid },
    })

    expect(crumbs.map((c) => c.label)).toEqual(['Заявки', 'Реестр', 'Заявка'])
    // Ни в одной подписи идентификатора нет.
    for (const crumb of crumbs) expect(crumb.label).not.toContain(uuid)
  })

  it('11. идентификаторы прочих видов тоже отбрасываются', () => {
    for (const id of [
      '8f14e45f-ceea-467a-9a3c-1f0b9b6f2a11',
      'ckv9v1c4t0000qzrmn831i7rn',
      '01H8XGJWBWBAQ4V1P2T3Y4Z5A6',
      'a1b2c3d4e5f60718293a4b5c',
    ]) {
      expect(looksLikeOpaqueId(id)).toBe(true)
      const crumbs = buildManagementBreadcrumbs('/inspection/runs/run-1', {
        entityLabels: { '/inspection/runs/:id': id },
      })
      expect(crumbs[crumbs.length - 1].label).toBe('Обход')
    }
  })

  it('человекочитаемые названия идентификаторами не считаются', () => {
    for (const name of ['Уфа 5', 'Холодильник 2', 'Заявка №123', 'Утренний обход Уфа 5', 'Иван Петров']) {
      expect(looksLikeOpaqueId(name)).toBe(false)
    }
  })

  it('нейтральная подпись подставляется, пока данные не загружены', () => {
    expect(labels('/inspection/runs/run-1')).toEqual(['Обходы и планирование', 'История', 'Обход'])
    expect(labels('/tickets/t-1')).toEqual(['Заявки', 'Реестр', 'Заявка'])
  })

  it('трёхуровневая цепочка акта обхода собирается целиком', () => {
    const crumbs = buildManagementBreadcrumbs('/inspection/runs/run-7/report', {
      entityLabels: { '/inspection/runs/:id': 'Утренний обход Уфа 5' },
    })

    expect(crumbs.map((c) => c.label)).toEqual([
      'Обходы и планирование',
      'История',
      'Утренний обход Уфа 5',
      'Акт',
    ])
    // Родительские ссылки подставляют настоящий идентификатор из адреса.
    expect(crumbs[2].to).toBe('/inspection/runs/run-7')
  })

  it('длинный шаблон не перехватывается коротким', () => {
    expect(matchManagementRoute('/inspection/runs/run-7/report')?.meta.path).toBe('/inspection/runs/:id/report')
    expect(matchManagementRoute('/inspection/runs/run-7')?.meta.path).toBe('/inspection/runs/:id')
    expect(matchManagementRoute('/inspection/runs')?.meta.path).toBe('/inspection/runs')
  })
})

describe('121A ссылки и адрес', () => {
  it('строка запроса и якорь сохраняются только у текущей страницы', () => {
    const crumbs = buildManagementBreadcrumbs('/tickets/t-1', {
      search: '?section=comments',
      hash: '#top',
    })
    // Текущая крошка ссылкой не является, но родитель не тащит чужое состояние.
    expect(crumbs[crumbs.length - 1].to).toBeNull()
    expect(crumbs[1].to).toBe('/tickets')
  })

  it('ссылки остаются внутренними и проходят канонический санитайзер', () => {
    for (const path of ['/tickets/t-1', '/inspection/runs/run-7/report', '/analytics/locations']) {
      for (const crumb of buildManagementBreadcrumbs(path)) {
        if (crumb.to === null) continue
        expect(crumb.to.startsWith('/')).toBe(true)
        expect(crumb.to.startsWith('//')).toBe(false)
        expect(crumb.to).not.toMatch(/^[a-z]+:/i)
      }
    }
  })
})

describe('121A устойчивость', () => {
  it('12. неизвестный маршрут не ломает страницу', () => {
    for (const path of ['/unknown', '/', '', null, undefined, '/m/tickets', '/max/settings', 'not-a-path']) {
      expect(() => buildManagementBreadcrumbs(path as any)).not.toThrow()
      expect(buildManagementBreadcrumbs(path as any)).toEqual([])
    }
  })

  it('карта маршрутов целостна: без дублей и с существующими родителями', () => {
    expect(validateManagementRoutes()).toEqual([])
  })

  it('дубль пути в карте обнаруживается проверкой', () => {
    const withDuplicate = [...MANAGEMENT_ROUTES, { ...MANAGEMENT_ROUTES[1] }]
    expect(validateManagementRoutes(withDuplicate)).toContain(`дубль маршрута: ${MANAGEMENT_ROUTES[1].path}`)
  })

  it('ссылка на несуществующего родителя обнаруживается проверкой', () => {
    const broken = [{ ...MANAGEMENT_ROUTES[0], path: '/orphan', parentPath: '/nowhere' }]
    expect(validateManagementRoutes(broken).join(' ')).toContain('родитель не найден')
  })
})

describe('121A границы среза', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'managementRouteMeta.ts'),
    'utf8',
  )

  /**
   * Проверяется код, а не текст. Слова «права» и «permissions» законно
   * встречаются в путях маршрутов (/permissions) и в пояснениях, поэтому
   * поиск по всему файлу давал бы ложные срабатывания и со временем был бы
   * отключён — то есть перестал бы защищать. Комментарии и строковые
   * литералы снимаются, и в оставшемся коде ищутся обращения к доступу.
   */
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``')

  it('13. в коде построителя нет обращений к ролям и правам', () => {
    /*
     * Вторая матрица доступа — обычный конец таких модулей, и расходится она
     * молча. Видимость управленческой части решает сервер, отдельные пункты —
     * Shell. Здесь отвечают только на вопрос «где я».
     */
    for (const forbidden of [
      'UserRole',
      'PERMISSIONS',
      'canAccess',
      'canView',
      'PLATFORM_ADMIN',
      'TECHNICIAN',
      'isNavItemVisible',
      'user.role',
      'me.role',
    ]) {
      expect(codeOnly).not.toContain(forbidden)
    }
  })

  it('13. модуль не тянет за собой навигационную безопасность', () => {
    // Единственная зависимость — канонический санитайзер путей. В частности,
    // lib/navigation.ts с его ролевыми помощниками здесь не используется.
    const imports = source.match(/^import[^\n]*from '([^']+)'/gm) ?? []
    const sources = imports.map((line) => line.replace(/^.*from '([^']+)'$/, '$1'))
    expect(sources).toEqual(['./returnToNavigation'])
  })

  it('13. переданный пользователь не может изменить цепочку', () => {
    /*
     * Главная проверка запрета, и она поведенческая. Структурный поиск по
     * тексту обходится в одну строку: имя роли — строковый литерал, а лишний
     * необязательный параметр не меняет .length у функции. Поэтому здесь
     * спрашивается результат: сколько бы ролей ни передали третьим аргументом,
     * цепочка обязана остаться прежней.
     */
    const baseline = buildManagementBreadcrumbs('/board')
    const detail = buildManagementBreadcrumbs('/tickets/t-1')

    for (const role of ['TECHNICIAN', 'CLIENT', 'PLATFORM_ADMIN', 'ADMIN', 'DISPATCHER', null, undefined]) {
      const asUser = { role, canAccessManagementSurface: false, permissions: [] } as any
      expect((buildManagementBreadcrumbs as any)('/board', {}, asUser)).toEqual(baseline)
      expect((buildManagementBreadcrumbs as any)('/tickets/t-1', {}, asUser)).toEqual(detail)
      // И в виде второго аргумента тоже: настройки — не место для роли.
      expect((buildManagementBreadcrumbs as any)('/board', asUser)).toEqual(baseline)
    }
  })

  it('13. в коде нет имён ролей и обращений к полю роли', () => {
    // Литералы здесь НЕ снимаются: имя роли живёт именно в литерале.
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')

    for (const roleName of [
      'PLATFORM_ADMIN',
      'TECHNICIAN',
      'DISPATCHER',
      'NETWORK_DIRECTOR',
      'TERRITORIAL_MANAGER',
      'CLIENT_ADMIN',
    ]) {
      expect(withoutComments).not.toContain(roleName)
    }
    // Обращение к полю роли в любой записи, включая необязательную цепочку.
    expect(withoutComments).not.toMatch(/\??\.\s*role\b/)
    expect(withoutComments).not.toMatch(/\[\s*['"]role['"]\s*\]/)
    expect(withoutComments).not.toMatch(/\??\.\s*permissions\b/)
  })

  it('срез не удаляет маршруты и не перенаправляет их', () => {
    expect(source).not.toContain('Navigate')
    expect(source).not.toContain('redirect')
    // Метка primaryNav только помечает; ничего не скрывает в этом срезе.
    expect(MANAGEMENT_ROUTES.some((route) => route.primaryNav)).toBe(true)
    expect(MANAGEMENT_ROUTES.some((route) => !route.primaryNav)).toBe(true)
  })
})
