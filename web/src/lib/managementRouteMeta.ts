import { sanitizeInternalAppPath } from './returnToNavigation'

/**
 * SMA-MANAGEMENT-IA-BREADCRUMBS-121A — одна карта управленческих маршрутов.
 *
 * До неё связь «страница → раздел» не была записана нигде: боковое меню
 * (lib/navigation.ts) знает плоский список ссылок, роутер знает пути, а к какому
 * разделу относится страница и что у неё за родитель — не знал никто. Крошки,
 * собранные на каждой странице по отдельности, разошлись бы в первый же месяц.
 *
 * Чего здесь нет намеренно:
 *
 * Прав и ролей. Этот модуль отвечает на вопрос «где я нахожусь», а не «что мне
 * разрешено». Видимость управленческой части решает сервер через
 * canAccessManagementSurface, отдельные пункты — isNavItemVisible в Shell.
 * Если сюда добавить роль, появится вторая матрица доступа, расходящаяся
 * с первой молча. Поэтому построитель крошек не принимает пользователя вовсе:
 * ему нечем ошибиться.
 *
 * Своего санитайзера ссылок. Пути пропускаются через канонический
 * sanitizeInternalAppPath из returnToNavigation — тот же, что охраняет возврат
 * между контурами (116E). Второй список разрешённых корней разошёлся бы с ним.
 */

export type ManagementSection =
  | 'home'
  | 'tickets'
  | 'rounds'
  | 'objects'
  | 'workforce'
  | 'analytics'
  | 'settings'
  | 'platform'

/** Русские подписи разделов. Единственное место, где они заданы. */
export const MANAGEMENT_SECTION_LABELS: Record<ManagementSection, string> = {
  home: 'Главная',
  tickets: 'Заявки',
  rounds: 'Обходы и планирование',
  objects: 'Объекты и оборудование',
  workforce: 'Сотрудники и работа',
  analytics: 'Аналитика',
  settings: 'Настройки',
  platform: 'Платформа',
}

/**
 * Вид сущности у детального маршрута. Имя такой страницы приходит из уже
 * загруженных данных, а до загрузки подставляется нейтральная подпись:
 * показывать идентификатор человеку нельзя, а пустое место ломает цепочку.
 */
export type ManagementEntityKind = 'ticket' | 'location' | 'equipment' | 'run' | 'employee' | 'act'

export const MANAGEMENT_ENTITY_FALLBACK_LABELS: Record<ManagementEntityKind, string> = {
  ticket: 'Заявка',
  location: 'Объект',
  equipment: 'Оборудование',
  run: 'Обход',
  employee: 'Сотрудник',
  act: 'Акт',
}

export type ManagementRouteMeta = {
  /** Шаблон пути ровно как в роутере, с :параметрами. */
  path: string
  section: ManagementSection
  /** Подпись страницы в заголовке. */
  pageLabel: string
  /** Подпись в крошках: иногда короче заголовка. */
  breadcrumbLabel: string
  /** Шаблон родителя внутри раздела; null — страница сразу под разделом. */
  parentPath: string | null
  /** Уровень сущности: подпись берётся из данных страницы. */
  entity: ManagementEntityKind | null
  /**
   * Готов ли маршрут к показу в основной навигации следующими срезами.
   * Здесь ничего не скрывает и не показывает — только помечает.
   */
  primaryNav: boolean
}

/**
 * Карта заполнена по фактическому списку маршрутов из web/src/router.tsx.
 * Ни один маршрут не удаляется и не перенаправляется: это только разметка.
 */
export const MANAGEMENT_ROUTES: readonly ManagementRouteMeta[] = Object.freeze([
  // ── Главная ───────────────────────────────────────────────────────────────
  { path: '/dashboard', section: 'home', pageLabel: 'Главная', breadcrumbLabel: 'Главная', parentPath: null, entity: null, primaryNav: true },

  // ── Заявки ────────────────────────────────────────────────────────────────
  { path: '/board', section: 'tickets', pageLabel: 'Доска', breadcrumbLabel: 'Доска', parentPath: null, entity: null, primaryNav: true },
  { path: '/tickets', section: 'tickets', pageLabel: 'Реестр', breadcrumbLabel: 'Реестр', parentPath: null, entity: null, primaryNav: true },
  { path: '/archive', section: 'tickets', pageLabel: 'Архив', breadcrumbLabel: 'Архив', parentPath: null, entity: null, primaryNav: true },
  { path: '/tickets/new', section: 'tickets', pageLabel: 'Новая заявка', breadcrumbLabel: 'Новая заявка', parentPath: '/tickets', entity: null, primaryNav: false },
  { path: '/tickets/:id', section: 'tickets', pageLabel: 'Заявка', breadcrumbLabel: 'Заявка', parentPath: '/tickets', entity: 'ticket', primaryNav: false },

  // ── Обходы и планирование ─────────────────────────────────────────────────
  { path: '/inspection/schedules', section: 'rounds', pageLabel: 'План обходов', breadcrumbLabel: 'План обходов', parentPath: null, entity: null, primaryNav: true },
  { path: '/inspection/templates', section: 'rounds', pageLabel: 'Шаблоны', breadcrumbLabel: 'Шаблоны', parentPath: null, entity: null, primaryNav: true },
  { path: '/inspection/runs', section: 'rounds', pageLabel: 'История', breadcrumbLabel: 'История', parentPath: null, entity: null, primaryNav: true },
  { path: '/inspection/runs/:id', section: 'rounds', pageLabel: 'Обход', breadcrumbLabel: 'Обход', parentPath: '/inspection/runs', entity: 'run', primaryNav: false },
  { path: '/inspection/runs/:id/report', section: 'rounds', pageLabel: 'Акт', breadcrumbLabel: 'Акт', parentPath: '/inspection/runs/:id', entity: null, primaryNav: false },
  { path: '/inspection/quick/:runId', section: 'rounds', pageLabel: 'Быстрый обход', breadcrumbLabel: 'Быстрый обход', parentPath: '/inspection/runs', entity: 'run', primaryNav: false },

  // ── Объекты и оборудование ────────────────────────────────────────────────
  { path: '/locations', section: 'objects', pageLabel: 'Точки', breadcrumbLabel: 'Точки', parentPath: null, entity: null, primaryNav: true },
  { path: '/objects', section: 'objects', pageLabel: 'Точки', breadcrumbLabel: 'Точки', parentPath: null, entity: null, primaryNav: false },
  { path: '/equipment', section: 'objects', pageLabel: 'Оборудование', breadcrumbLabel: 'Оборудование', parentPath: null, entity: null, primaryNav: true },
  { path: '/map', section: 'objects', pageLabel: 'Карта', breadcrumbLabel: 'Карта', parentPath: null, entity: null, primaryNav: true },

  // ── Сотрудники и работа ───────────────────────────────────────────────────
  { path: '/employees', section: 'workforce', pageLabel: 'Сотрудники', breadcrumbLabel: 'Сотрудники', parentPath: null, entity: null, primaryNav: true },
  { path: '/users', section: 'workforce', pageLabel: 'Сотрудники', breadcrumbLabel: 'Сотрудники', parentPath: null, entity: null, primaryNav: false },
  { path: '/workforce', section: 'workforce', pageLabel: 'Смены и трудозатраты', breadcrumbLabel: 'Смены и трудозатраты', parentPath: null, entity: null, primaryNav: true },
  { path: '/technician', section: 'workforce', pageLabel: 'Техник', breadcrumbLabel: 'Техник', parentPath: null, entity: null, primaryNav: false },

  // ── Аналитика ─────────────────────────────────────────────────────────────
  { path: '/analytics', section: 'analytics', pageLabel: 'Аналитика', breadcrumbLabel: 'Аналитика', parentPath: null, entity: null, primaryNav: true },
  { path: '/analytics/locations', section: 'analytics', pageLabel: 'По объектам', breadcrumbLabel: 'По объектам', parentPath: '/analytics', entity: null, primaryNav: false },

  // ── Настройки ─────────────────────────────────────────────────────────────
  { path: '/settings', section: 'settings', pageLabel: 'Настройки', breadcrumbLabel: 'Настройки', parentPath: null, entity: null, primaryNav: true },
  { path: '/company', section: 'settings', pageLabel: 'Компания', breadcrumbLabel: 'Компания', parentPath: null, entity: null, primaryNav: true },
  { path: '/problem-categories', section: 'settings', pageLabel: 'Категории проблем', breadcrumbLabel: 'Категории проблем', parentPath: null, entity: null, primaryNav: true },
  { path: '/specializations', section: 'settings', pageLabel: 'Специализации', breadcrumbLabel: 'Специализации', parentPath: null, entity: null, primaryNav: true },
  { path: '/service-contracts', section: 'settings', pageLabel: 'Договоры и подрядчики', breadcrumbLabel: 'Договоры и подрядчики', parentPath: null, entity: null, primaryNav: true },
  { path: '/contractors', section: 'settings', pageLabel: 'Подрядчики', breadcrumbLabel: 'Подрядчики', parentPath: null, entity: null, primaryNav: false },
  { path: '/access-constructor', section: 'settings', pageLabel: 'Конструктор доступа', breadcrumbLabel: 'Конструктор доступа', parentPath: null, entity: null, primaryNav: false },
  { path: '/permissions', section: 'settings', pageLabel: 'Роли и права', breadcrumbLabel: 'Роли и права', parentPath: null, entity: null, primaryNav: false },
  { path: '/acts', section: 'settings', pageLabel: 'Акты', breadcrumbLabel: 'Акты', parentPath: null, entity: null, primaryNav: false },
  { path: '/assistant', section: 'settings', pageLabel: 'Ассистент', breadcrumbLabel: 'Ассистент', parentPath: null, entity: null, primaryNav: false },

  // ── Платформа: только существующие маршруты ───────────────────────────────
  { path: '/companies', section: 'platform', pageLabel: 'Компании', breadcrumbLabel: 'Компании', parentPath: null, entity: null, primaryNav: true },
  { path: '/platform/permissions', section: 'platform', pageLabel: 'Роли и права', breadcrumbLabel: 'Роли и права', parentPath: null, entity: null, primaryNav: true },
  { path: '/platform/access-constructor', section: 'platform', pageLabel: 'Конструктор доступа', breadcrumbLabel: 'Конструктор доступа', parentPath: null, entity: null, primaryNav: false },
  { path: '/agents/engineering', section: 'platform', pageLabel: 'Engineering Agent', breadcrumbLabel: 'Engineering Agent', parentPath: null, entity: null, primaryNav: false },

  /**
   * 121E: модуль IT Company. Эти маршруты монтируются в том же управленческом
   * Shell списком IT_COMPANY_ROUTES (router.tsx), и без них на пяти страницах
   * цепочка просто не строилась.
   *
   * Подпись «IT Company» — существующая терминология продукта: так раздел
   * назван в боковом меню (lib/navigation.ts) и на карточке главной. Второе
   * имя для того же раздела было бы хуже, чем нерусское слово.
   *
   * Вложенность взята из самих страниц: AIEmployeeDetailsPage возвращает
   * ссылкой на /it/employees, а Mission Control и AI-разработчик — на /it.
   */
  { path: '/it', section: 'platform', pageLabel: 'IT Company', breadcrumbLabel: 'IT Company', parentPath: null, entity: null, primaryNav: false },
  { path: '/it/employees', section: 'platform', pageLabel: 'Сотрудники', breadcrumbLabel: 'Сотрудники', parentPath: '/it', entity: null, primaryNav: false },
  { path: '/it/employees/:slug', section: 'platform', pageLabel: 'Сотрудник', breadcrumbLabel: 'Сотрудник', parentPath: '/it/employees', entity: 'employee', primaryNav: false },
  { path: '/it/mission-control', section: 'platform', pageLabel: 'Mission Control', breadcrumbLabel: 'Mission Control', parentPath: '/it', entity: null, primaryNav: false },
  { path: '/it/ai-developer', section: 'platform', pageLabel: 'AI-разработчик', breadcrumbLabel: 'AI-разработчик', parentPath: '/it', entity: null, primaryNav: false },
])

/**
 * 121E: алиасы и их канонические адреса.
 *
 * Оба пути живут в роутере и оба должны описываться, но в основной навигации
 * место только у канонического: иначе один и тот же экран получит два пункта.
 */
export const MANAGEMENT_ROUTE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  '/objects': '/locations',
  '/users': '/employees',
  '/contractors': '/service-contracts',
})

/**
 * Проверка целостности карты. Держится отдельной функцией, чтобы дубль пути
 * или ссылка на несуществующего родителя падали в тесте, а не проявлялись
 * кривой цепочкой у пользователя.
 */
export function validateManagementRoutes(routes: readonly ManagementRouteMeta[] = MANAGEMENT_ROUTES): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const known = new Map(routes.map((route) => [route.path, route]))

  for (const route of routes) {
    if (seen.has(route.path)) problems.push(`дубль маршрута: ${route.path}`)
    seen.add(route.path)
    if (route.parentPath && !known.has(route.parentPath)) {
      problems.push(`родитель не найден: ${route.path} → ${route.parentPath}`)
    }
    if (!route.breadcrumbLabel.trim()) problems.push(`пустая подпись крошки: ${route.path}`)
  }

  problems.push(...findParentCycles(routes, known))
  problems.push(...findPrimaryNavProblems(routes))

  return problems
}

/**
 * 121E: любой цикл в родителях, а не только «сам себе родитель».
 *
 * Прежняя проверка ловила /a → /a и пропускала /a → /b → /a: у обоих
 * маршрутов родитель существовал, и ни один не ссылался на себя. Цепочка при
 * этом обрывалась предохранителем построителя, то есть дефект жил молча.
 * Поэтому здесь проходится вся цепочка каждого маршрута, а найденный цикл
 * называется один раз — по наименьшему пути, чтобы один и тот же цикл не
 * печатался столько раз, сколько в нём звеньев.
 */
function findParentCycles(
  routes: readonly ManagementRouteMeta[],
  known: Map<string, ManagementRouteMeta>,
): string[] {
  const reported = new Set<string>()
  const problems: string[] = []

  for (const route of routes) {
    const path: string[] = []
    const onPath = new Set<string>()
    let cursor: ManagementRouteMeta | undefined = route

    while (cursor) {
      if (onPath.has(cursor.path)) {
        const cycle = path.slice(path.indexOf(cursor.path))
        const key = [...cycle].sort().join('|')
        if (!reported.has(key)) {
          reported.add(key)
          problems.push(`цикл в родителях: ${[...cycle, cursor.path].join(' → ')}`)
        }
        break
      }
      onPath.add(cursor.path)
      path.push(cursor.path)
      cursor = cursor.parentPath ? known.get(cursor.parentPath) : undefined
    }
  }

  return problems
}

/**
 * 121E: инварианты основной навигации.
 *
 * primaryNav пока ничего не скрывает и не показывает — это метка для будущих
 * срезов. Но именно поэтому ошибка в ней сейчас незаметна: пометить алиас
 * /objects основным рядом с каноническим /locations можно было, и ни один
 * тест этого не замечал. Когда по метке начнут строить меню, в нём появятся
 * два пункта «Точки», ведущие в одно место.
 */
function findPrimaryNavProblems(routes: readonly ManagementRouteMeta[]): string[] {
  const problems: string[] = []

  for (const [path, canonical] of Object.entries(MANAGEMENT_ROUTE_ALIASES)) {
    const alias = routes.find((route) => route.path === path)
    if (alias?.primaryNav) {
      problems.push(`алиас помечен основным: ${path} (канонический — ${canonical})`)
    }
  }

  const byDestination = new Map<string, string[]>()
  for (const route of routes) {
    if (!route.primaryNav) continue
    const key = `${route.section}|${route.breadcrumbLabel}`
    byDestination.set(key, [...(byDestination.get(key) ?? []), route.path])
  }
  for (const [key, paths] of byDestination) {
    if (paths.length > 1) {
      problems.push(`два основных пункта с одной подписью: ${key} → ${paths.join(', ')}`)
    }
  }

  return problems
}

const SEGMENT_PARAM = /^:/

/** Совпадение конкретного пути с шаблоном роутера, включая :параметры. */
function matchTemplate(pathname: string, template: string): Record<string, string> | null {
  const actual = pathname.split('/').filter(Boolean)
  const expected = template.split('/').filter(Boolean)
  if (actual.length !== expected.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < expected.length; i += 1) {
    const part = expected[i]
    if (SEGMENT_PARAM.test(part)) {
      params[part.slice(1)] = actual[i]
      continue
    }
    if (part !== actual[i]) return null
  }
  return params
}

export type ManagementRouteMatch = {
  meta: ManagementRouteMeta
  params: Record<string, string>
}

/**
 * Поиск описания маршрута. Более длинные шаблоны проверяются раньше, иначе
 * `/inspection/runs/:id` перехватывал бы `/inspection/runs/:id/report`.
 */
export function matchManagementRoute(pathname?: string | null): ManagementRouteMatch | null {
  const clean = (pathname || '').split('?')[0].split('#')[0]
  if (!clean.startsWith('/')) return null

  const ordered = [...MANAGEMENT_ROUTES].sort(
    (a, b) => b.path.split('/').length - a.path.split('/').length,
  )
  for (const meta of ordered) {
    const params = matchTemplate(clean, meta.path)
    if (params) return { meta, params }
  }
  return null
}

/**
 * Похоже ли значение на внутренний идентификатор. Такие подписи человеку
 * не показываются никогда: в крошке место названию объекта или номеру заявки,
 * а не uuid из адресной строки.
 */
export function looksLikeOpaqueId(value?: string | null): boolean {
  const raw = (value || '').trim()
  if (!raw) return false

  // Полноценный uuid — единственная известная форма с разделителями.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return true

  /**
   * Остальные технические идентификаторы — один сплошной токен. Наличие
   * разделителя поэтому исключает их все сразу, и именно на этом держится
   * уточнение 121E: «REFRIGERATOR-UNIT-7», «chiller_unit_00042» и
   * «Kholodilnik-2-Ufa» — названия, а не идентификаторы, и подменять их
   * словом «Оборудование» нельзя.
   */
  if (/[\s._\-/]/.test(raw)) return false

  // ObjectId (24) и длинный чистый hex.
  if (raw.length >= 24 && /^[0-9a-f]+$/i.test(raw)) return true
  // Длинный числовой идентификатор. Номера заявок короче на порядок.
  if (raw.length >= 16 && /^[0-9]+$/.test(raw)) return true
  // ULID: ровно 26 символов алфавита Крокфорда (без I, L, O, U).
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(raw)) return true
  // CUID v1 и CUID2: строчный токен без разделителей характерной длины.
  if (/^c[a-z0-9]{24}$/.test(raw)) return true
  if (/^[a-z][a-z0-9]{23,31}$/.test(raw)) return true
  /**
   * Прочий длинный сплошной токен из латиницы и цифр. Кириллица сюда не
   * попадает намеренно: русское название без пробелов — это название,
   * а идентификаторы в продукте латинские.
   */
  if (raw.length >= 16 && /^[0-9A-Za-z]+$/.test(raw)) return true

  return false
}

export type Breadcrumb = {
  label: string
  /** Внутренний путь или null у текущей страницы: последняя крошка не ссылка. */
  to: string | null
}

export type BuildBreadcrumbsOptions = {
  /**
   * Человекочитаемые подписи для детальных уровней, по шаблону маршрута.
   * Берутся из уже загруженных данных страницы; идентификаторы отбрасываются.
   */
  entityLabels?: Partial<Record<string, string | null | undefined>>
  /** Строка запроса и якорь текущего адреса: сохраняются только у текущей крошки. */
  search?: string
  hash?: string
}

function normalizeSuffix(value?: string): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  return raw.startsWith('?') || raw.startsWith('#') ? raw : ''
}

/** Подставляет значения параметров в шаблон, чтобы получить настоящий путь. */
function fillTemplate(template: string, params: Record<string, string>): string {
  return template
    .split('/')
    .map((part) => (SEGMENT_PARAM.test(part) ? params[part.slice(1)] ?? part : part))
    .join('/')
}

/**
 * Цепочка крошек для управленческой страницы.
 *
 * Пользователя в параметрах нет намеренно — см. пояснение в начале файла.
 * Неизвестный путь даёт пустую цепочку, а не исключение: навигация не должна
 * ронять страницу из-за того, что маршрут забыли описать.
 */
export function buildManagementBreadcrumbs(
  pathname?: string | null,
  options: BuildBreadcrumbsOptions = {},
): Breadcrumb[] {
  const match = matchManagementRoute(pathname)
  if (!match) return []

  const chain: ManagementRouteMeta[] = []
  let cursor: ManagementRouteMeta | null = match.meta
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.path)) {
    guard.add(cursor.path)
    chain.unshift(cursor)
    cursor = cursor.parentPath
      ? MANAGEMENT_ROUTES.find((route) => route.path === cursor!.parentPath) ?? null
      : null
  }

  const crumbs: Breadcrumb[] = [
    { label: MANAGEMENT_SECTION_LABELS[match.meta.section], to: null },
  ]

  const currentSuffix = `${normalizeSuffix(options.search)}${normalizeSuffix(options.hash)}`

  for (const meta of chain) {
    const isCurrent = meta.path === match.meta.path
    let label = meta.breadcrumbLabel

    if (meta.entity) {
      const supplied = (options.entityLabels?.[meta.path] || '').trim()
      /*
       * Подпись из данных принимается, только если это действительно название.
       * Идентификатор отбрасывается: показать его человеку хуже, чем показать
       * нейтральное слово, — он ничего не сообщает и выглядит поломкой.
       */
      label = supplied && !looksLikeOpaqueId(supplied)
        ? supplied
        : MANAGEMENT_ENTITY_FALLBACK_LABELS[meta.entity]
    }

    const filled = fillTemplate(meta.path, match.params)
    // Строка запроса и якорь имеют смысл только для той страницы, где открыты;
    // у родителей они относились бы к чужому состоянию.
    const target = sanitizeInternalAppPath(isCurrent ? `${filled}${currentSuffix}` : filled)

    crumbs.push({ label, to: isCurrent ? null : target || null })
  }

  return collapseDuplicateSectionLabel(crumbs)
}

/**
 * 121E: «Главная / Главная» — не иерархия, а повтор.
 *
 * У разделов, чья входная страница называется так же, как сам раздел, первые
 * две крошки совпадали дословно: /dashboard давал «Главная / Главная»,
 * /analytics — «Аналитика / Аналитика», /analytics/locations — «Аналитика /
 * Аналитика / По объектам». Лишняя остаётся подпись раздела: у страницы,
 * в отличие от неё, может быть ссылка, и она нужнее.
 *
 * Там, где подписи различаются, иерархия сохраняется полностью.
 */
function collapseDuplicateSectionLabel(crumbs: Breadcrumb[]): Breadcrumb[] {
  if (crumbs.length < 2) return crumbs
  return crumbs[0].label === crumbs[1].label ? crumbs.slice(1) : crumbs
}
