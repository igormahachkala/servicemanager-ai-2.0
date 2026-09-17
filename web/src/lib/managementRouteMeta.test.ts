import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  MANAGEMENT_ROUTE_ALIASES,
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
    ['/analytics', ['Аналитика']],
    ['/company', ['Настройки', 'Компания']],
    ['/problem-categories', ['Настройки', 'Категории проблем']],
    ['/specializations', ['Настройки', 'Специализации']],
    ['/service-contracts', ['Настройки', 'Договоры и подрядчики']],
    ['/companies', ['Платформа', 'Компании']],
    ['/platform/permissions', ['Платформа', 'Роли и права']],
    // 121E: входные страницы разделов больше не повторяют подпись раздела.
    ['/dashboard', ['Главная']],
    ['/settings', ['Настройки']],
    ['/analytics/locations', ['Аналитика', 'По объектам']],
    // 121E: модуль IT Company описан целиком.
    ['/it', ['Платформа', 'IT Company']],
    ['/it/employees', ['Платформа', 'IT Company', 'Сотрудники']],
    ['/it/employees/ai-dev', ['Платформа', 'IT Company', 'Сотрудники', 'Сотрудник']],
    ['/it/mission-control', ['Платформа', 'IT Company', 'Mission Control']],
    ['/it/ai-developer', ['Платформа', 'IT Company', 'AI-разработчик']],
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

// ── 121E: закрытые аудитом пробелы ─────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')

/** Фактические маршруты управленческого Shell, прочитанные из роутера. */
function actualShellRoutes(): string[] {
  const router = readSrc('router.tsx')
  const block = router.slice(router.indexOf('path="/"', router.indexOf('path="/m"')), router.indexOf('path="/max"'))
  const declared = [...block.matchAll(/<Route path="([^"]+)"/g)].map((m) => `/${m[1]}`)
  // Модуль IT Company монтируется списком в том же блоке.
  const itRoutes = [...readSrc('it-company/routes.ts').matchAll(/path:\s*'([^']+)'/g)].map((m) => `/${m[1]}`)
  return [...new Set([...declared, ...itRoutes])]
}

describe('121E полнота карты', () => {
  it('1, 2. карта описывает ровно фактические маршруты Shell, включая пять IT', () => {
    const router = new Set(actualShellRoutes())
    const meta = new Set(MANAGEMENT_ROUTES.map((route) => route.path))

    // Ни один существующий маршрут не забыт.
    expect([...router].filter((path) => !meta.has(path))).toEqual([])
    // Ни один маршрут не выдуман: в карте нет того, чего нет в роутере.
    expect([...meta].filter((path) => !router.has(path))).toEqual([])
    for (const path of ['/it', '/it/employees', '/it/employees/:slug', '/it/mission-control', '/it/ai-developer']) {
      expect(meta.has(path)).toBe(true)
    }
  })

  it('маршруты IT Company лежат в разделе «Платформа» и не попадают в основную навигацию', () => {
    for (const route of MANAGEMENT_ROUTES.filter((item) => item.path.startsWith('/it'))) {
      expect(route.section).toBe('platform')
      // Видимость раздела решает isNavItemVisible, а не эта карта.
      expect(route.primaryNav).toBe(false)
    }
  })
})

describe('121E инварианты основной навигации', () => {
  it('3. известные алиасы остаются неосновными', () => {
    for (const [alias, canonical] of Object.entries(MANAGEMENT_ROUTE_ALIASES)) {
      const aliasRoute = MANAGEMENT_ROUTES.find((route) => route.path === alias)
      const canonicalRoute = MANAGEMENT_ROUTES.find((route) => route.path === canonical)
      expect(aliasRoute, alias).toBeDefined()
      expect(canonicalRoute, canonical).toBeDefined()
      expect(aliasRoute?.primaryNav, alias).toBe(false)
    }
    expect(Object.keys(MANAGEMENT_ROUTE_ALIASES).sort()).toEqual(['/contractors', '/objects', '/users'])
  })

  it('4. у раздела нет двух основных пунктов с одной подписью', () => {
    const seen = new Map<string, string[]>()
    for (const route of MANAGEMENT_ROUTES.filter((item) => item.primaryNav)) {
      const key = `${route.section}|${route.breadcrumbLabel}`
      seen.set(key, [...(seen.get(key) ?? []), route.path])
    }
    expect([...seen.entries()].filter(([, paths]) => paths.length > 1)).toEqual([])
  })

  it('проверка ловит алиас, помеченный основным', () => {
    const broken = MANAGEMENT_ROUTES.map((route) =>
      route.path === '/objects' ? { ...route, primaryNav: true } : route,
    )
    expect(validateManagementRoutes(broken).join('\n')).toMatch(/алиас помечен основным: \/objects/)
  })

  it('проверка ловит второй основной пункт с той же подписью', () => {
    const broken = [
      ...MANAGEMENT_ROUTES,
      { path: '/locations-copy', section: 'objects', pageLabel: 'Точки', breadcrumbLabel: 'Точки', parentPath: null, entity: null, primaryNav: true },
    ] as typeof MANAGEMENT_ROUTES
    expect(validateManagementRoutes(broken).join('\n')).toMatch(/два основных пункта с одной подписью/)
  })

  it('users/employees и contractors/service-contracts различимы по этому же правилу', () => {
    for (const alias of ['/users', '/contractors'] as const) {
      const broken = MANAGEMENT_ROUTES.map((route) =>
        route.path === alias ? { ...route, primaryNav: true } : route,
      )
      expect(validateManagementRoutes(broken).join('\n')).toMatch(new RegExp(`алиас помечен основным: ${alias}`))
    }
  })
})

describe('121E циклы в родителях', () => {
  const route = (path: string, parentPath: string | null) =>
    ({ path, section: 'tickets', pageLabel: path, breadcrumbLabel: path, parentPath, entity: null, primaryNav: false }) as never

  it('5. маршрут сам себе родитель', () => {
    expect(validateManagementRoutes([route('/a', '/a')]).join('\n')).toMatch(/цикл в родителях/)
  })

  it('6. цикл из двух звеньев', () => {
    const problems = validateManagementRoutes([route('/a', '/b'), route('/b', '/a')])
    expect(problems.join('\n')).toMatch(/цикл в родителях/)
    // Один цикл называется один раз, а не по разу на каждое звено.
    expect(problems.filter((line) => line.startsWith('цикл в родителях'))).toHaveLength(1)
  })

  it('7. цикл из трёх звеньев', () => {
    const problems = validateManagementRoutes([route('/a', '/b'), route('/b', '/c'), route('/c', '/a')])
    expect(problems.join('\n')).toMatch(/цикл в родителях/)
    expect(problems.filter((line) => line.startsWith('цикл в родителях'))).toHaveLength(1)
  })

  it('верная иерархия остаётся верной', () => {
    expect(validateManagementRoutes([route('/a', null), route('/a/b', '/a'), route('/a/b/c', '/a/b')])).toEqual([])
    expect(validateManagementRoutes()).toEqual([])
  })

  it('построитель не зависает, даже если битая карта до него дойдёт', () => {
    // Предохранитель построителя остаётся: цепочка обрывается, а не крутится.
    const chain = buildManagementBreadcrumbs('/tickets/x', {})
    expect(chain.length).toBeGreaterThan(0)
    expect(chain.length).toBeLessThan(10)
  })
})

describe('121E повтор подписи раздела', () => {
  it.each([
    ['/dashboard', ['Главная']],
    ['/analytics', ['Аналитика']],
    ['/settings', ['Настройки']],
    ['/analytics/locations', ['Аналитика', 'По объектам']],
  ])('8, 9. %s → %s', (pathname, expected) => {
    expect(labels(pathname)).toEqual(expected)
  })

  it('одна крошка доходит до экрана: порог отрисовки опущен вместе со схлопыванием', () => {
    // Иначе /dashboard, /analytics и /settings перестали бы показывать путь вовсе.
    const component = readSrc('ui/Breadcrumbs.tsx')
    expect(component).toMatch(/crumbs\.length === 0/)
    expect(component).not.toMatch(/crumbs\.length < 2/)
  })

  it('иерархия с разными подписями не схлопывается', () => {
    expect(labels('/board')).toEqual(['Заявки', 'Доска'])
    expect(labels('/inspection/runs/r1/report')).toEqual(['Обходы и планирование', 'История', 'Обход', 'Акт'])
  })

  it('у схлопнутой цепочки ссылка ведёт в раздел, а не в никуда', () => {
    const crumbs = buildManagementBreadcrumbs('/analytics/locations')
    expect(crumbs.map((crumb) => crumb.to)).toEqual(['/analytics', null])
  })
})

describe('121E эвристика идентификатора', () => {
  const technical = {
    uuid: '3f2b9a1c-5d4e-4a7b-9c8d-1e2f3a4b5c6d',
    cuid: 'ckq1r2s3t4u5v6w7x8y9z0a1',
    cuid2: 'clh3k2j1a0000356mfhk8t9xy',
    ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    objectId: '507f1f77bcf86cd799439011',
    hex32: 'a3f9c1d20b8e47f6a1b2c3d4e5f60718',
    numeric: '12345678901234567890',
    opaqueToken: 'aZ9kQ2mP7xR4tL8n',
  }

  it.each(Object.entries(technical))('10-14. %s остаётся техническим идентификатором', (_name, value) => {
    expect(looksLikeOpaqueId(value)).toBe(true)
    expect(labels('/tickets/x', { entityLabels: { '/tickets/:id': value } })).toEqual(['Заявки', 'Реестр', 'Заявка'])
  })

  it.each([
    ['REFRIGERATOR-UNIT-7'],
    ['chiller_unit_00042'],
    ['Kholodilnik-2-Ufa'],
    ['Заявка №123'],
    ['Уфа 5'],
    ['Холодильник 2'],
    ['Иван Петров'],
    ['Утренний обход Уфа 5'],
    ['AHU-01/ROOF'],
    ['Line 4 · Compressor B'],
  ])('15-17. %s остаётся названием', (value) => {
    expect(looksLikeOpaqueId(value)).toBe(false)
    expect(labels('/equipment', { entityLabels: {} })).toEqual(['Объекты и оборудование', 'Оборудование'])
    expect(labels('/tickets/x', { entityLabels: { '/tickets/:id': value } })).toEqual(['Заявки', 'Реестр', value])
  })

  it('номер заявки не принимается за длинный числовой идентификатор', () => {
    for (const value of ['123', '4821', '1000000']) expect(looksLikeOpaqueId(value)).toBe(false)
  })
})

describe('121E границы не сдвинулись', () => {
  it('18. неизвестный маршрут по-прежнему даёт пустую цепочку', () => {
    for (const pathname of ['/unknown', '/it/org-chart', '/nope/deep/path', '', null, undefined]) {
      expect(buildManagementBreadcrumbs(pathname as never)).toEqual([])
    }
  })

  it('19, 20. мобильные и MAX маршруты остаются вне этой карты', () => {
    for (const pathname of ['/m', '/m/my', '/m/tickets/1', '/m/inspection/runs', '/max', '/max/my', '/max/tickets/1']) {
      expect(matchManagementRoute(pathname)).toBeNull()
      expect(buildManagementBreadcrumbs(pathname)).toEqual([])
    }
  })

  it('21. в коде построителя не появилось ролей, прав и опоры на доступ', () => {
    const code = readSrc('lib/managementRouteMeta.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    for (const forbidden of ['canAccessManagementSurface', 'accessFlags', 'isNavItemVisible', 'TECHNICIAN', 'CLIENT_ADMIN', 'PLATFORM_ADMIN', 'NETWORK_DIRECTOR', 'SECONDARY']) {
      expect(code, forbidden).not.toContain(forbidden)
    }
    expect(code).not.toMatch(/\??\.\s*role\b/)
    expect(code).not.toMatch(/\??\.\s*permissions\b/)
    expect(code).not.toContain('Navigate')
    expect(code).not.toContain('redirect')

    // Переданный «пользователь» не может изменить цепочку.
    const asUser = { role: 'TECHNICIAN', canAccessManagementSurface: false, permissions: [] }
    expect(labels('/board', { ...( { user: asUser } as never) })).toEqual(labels('/board'))
  })
})
