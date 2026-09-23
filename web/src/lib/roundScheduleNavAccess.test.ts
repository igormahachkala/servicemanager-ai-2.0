import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { platformNavigation, tenantNavigation } from './navigation'

/**
 * SMA-ROUND-TECHNICIAN-ASSIGNMENT-025.
 *
 * Дефект был не в модели и не в правах: InspectionSchedule давно носит
 * assignedToUserId, страница «План обходов» построена целиком, маршрут
 * зарегистрирован, а managementRouteMeta объявляет её primaryNav. В меню
 * пункта не было — и назначить обход технику оказалось некуда нажать.
 *
 * Тест держит именно это: пункт есть в обоих меню, виден ровно тем ролям,
 * которым бэкенд разрешает управлять планом, и путь совпадает с тем, что
 * объявлено в карте маршрутов. Видимость пункта доступа не даёт — доступ
 * решает canManageSchedule на сервере, — поэтому проверяется совпадение
 * с политикой, а не сам доступ.
 */

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

const SCHEDULES_PATH = '/inspection/schedules'

/** Роли, которым бэкенд разрешает управлять планом: SCHEDULE_MANAGE_ROLES. */
const MANAGE_ROLES = ['ADMIN', 'DISPATCHER', 'MASTER', 'NETWORK_DIRECTOR']
/** Роли, которым план закрыт: исполнитель и клиентские роли без управления. */
const NON_MANAGE_ROLES = ['TECHNICIAN', 'CLIENT', 'STAFF', 'TERRITORIAL_MANAGER']

function sidebarPaths(config: { sidebar: Array<{ items: Array<{ to: string }> }> }) {
  return config.sidebar.flatMap((group) => group.items.map((item) => item.to))
}

describe('025 план обходов доступен из меню', () => {
  it('1. пункт есть в меню арендатора и платформы', () => {
    expect(sidebarPaths(tenantNavigation)).toContain(SCHEDULES_PATH)
    expect(sidebarPaths(platformNavigation)).toContain(SCHEDULES_PATH)
  })

  it('2. путь совпадает с картой управленческих маршрутов', () => {
    const meta = read('./managementRouteMeta.ts')
    // Карта уже объявляла страницу основной навигацией — меню обязано это отражать.
    expect(meta).toMatch(/path: '\/inspection\/schedules'[^}]*primaryNav: true/)
  })

  it('3. пункт стоит в разделе обходов перед шаблонами и историей', () => {
    const paths = sidebarPaths(tenantNavigation)
    const schedules = paths.indexOf(SCHEDULES_PATH)
    const templates = paths.indexOf('/inspection/templates')
    const runs = paths.indexOf('/inspection/runs')
    expect(schedules).toBeGreaterThanOrEqual(0)
    expect(schedules).toBeLessThan(templates)
    expect(templates).toBeLessThan(runs)
  })

  it('4. виден ровно управляющим ролям, и правило то же, что у шаблонов', () => {
    const shell = read('../ui/Shell.tsx')

    // Одно правило на два пункта: третий список ролей разошёлся бы с политикой.
    expect(shell).toContain(
      "if (item.to === '/inspection/schedules' || item.to === '/inspection/templates') {",
    )

    const rule = shell.slice(shell.indexOf("item.to === '/inspection/schedules'"))
    const line = rule.slice(0, rule.indexOf('}'))
    for (const role of MANAGE_ROLES) {
      expect(line).toContain(`'${role}'`)
    }
    for (const role of NON_MANAGE_ROLES) {
      expect(line).not.toContain(`'${role}'`)
    }
  })

  it('5. активный пункт подсвечивается на вложенных путях плана', () => {
    const shell = read('../ui/Shell.tsx')
    expect(shell).toContain(
      "if (targetPath === '/inspection/schedules') return currentPath.startsWith('/inspection/schedules')",
    )
  })

  it('6. назначение техника уходит в существующее поле плана, второго механизма нет', () => {
    const page = read('../views/InspectionSchedulesPage.tsx')
    // Страница создаёт план каноническим вызовом и кладёт техника в assignedToUserId.
    expect(page).toMatch(/api\.createInspectionSchedule\(/)
    expect(page).toMatch(/assignedToUserId: assignedToUserId \|\| undefined/)
    // Своего эндпоинта назначения не заводится.
    expect(page).not.toMatch(/assign(Round|Inspection)/i)
  })

  it('7. мобильный «Сегодня» сужает план сервером, а не параметром', () => {
    const today = read('../mobile/MobileInspectionTodayPage.tsx')
    expect(today).toMatch(/getInspectionSchedules\(\{ from: window\.from, to: window\.to, active: true \}\)/)
    // Клиент намеренно не передаёт assignedToUserId: сузить обязан сервер,
    // иначе параметр стал бы способом увидеть чужой план.
    expect(today).not.toMatch(/assignedToUserId:/)
  })
})

/**
 * SMA-ROUND-TECHNICIAN-ASSIGNMENT-025 — выбор техника.
 *
 * Проверяется контракт страницы, а не безопасность: правила доступа живут
 * на сервере, и тест следит ровно за тем, чтобы интерфейс их не дублировал
 * и не подменял своим списком.
 */
describe('025 выбор исполнителя в плане обходов', () => {
  const page = () => read('../views/InspectionSchedulesPage.tsx')

  it('8. кандидатов берёт сервер и только для выбранной точки', () => {
    const source = page()
    expect(source).toMatch(/api\.getAssignableRoundTechnicians\(locationId\)/)
    expect(source).toMatch(/enabled: canManage && !!locationId/)
    // Общий список всех активных сотрудников больше не источник кандидатов.
    expect(source).not.toMatch(/queryFn: api\.technicians/)
  })

  it('9. смена точки сбрасывает прежний выбор', () => {
    const source = page()
    expect(source).toMatch(/setLocationId\(e\.target\.value\); setAssignedToUserId\(''\)/)
  })

  it('10. выбор, ставший недействительным, очищается', () => {
    const source = page()
    expect(source).toMatch(/executors\.some\(\(candidate\) => candidate\.id === assignedToUserId\)/)
    expect(source).toMatch(/setAssignedToUserId\(''\)/)
  })

  it('11. пустое состояние объяснено по-русски, а не молчит', () => {
    const source = page()
    expect(source).toContain('Сначала выберите точку')
    expect(source).toContain('Для этой точки нет доступных исполнителей')
  })

  it('12. второго резолвера прав на клиенте нет', () => {
    const source = page()
    // Никаких проверок договоров, привязок и специализаций в React.
    for (const forbidden of ['serviceContract', 'locationBinding', 'specializationId', 'isExecutor']) {
      expect(source).not.toContain(forbidden)
    }
  })

  it('13. клиент запрашивает кандидатов канонической ручкой плана', () => {
    const api = read('./api.ts')
    expect(api).toMatch(/'\/inspection\/schedules\/assignable-technicians\?'/)
  })
})
