import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { supportsPersonalNotificationPreferences } from './mobileRoute'

/**
 * SMA-NOTIFICATION-PREFERENCES-V1-FRESH-RECONCILIATION-122E.
 *
 * 117W охранял эти же свойства двумя скриптами verify-*.mjs. В текущем проекте
 * такой инфраструктуры больше нет — во фронтенде один набор проверок, Vitest,
 * и проверки переписаны под него. Среда node, DOM нет: решение о поверхности
 * вынесено в чистую функцию, остальное проверяется по исходникам.
 */

const here = dirname(fileURLToPath(import.meta.url))
const read = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')

const router = () => read('router.tsx')
const mobileSettings = () => read('mobile/MobileSettingsPage.tsx')
const desktopSettings = () => read('views/SettingsPage.tsx')
const panel = () => read('components/notifications/NotificationPreferencesPanel.tsx')
const apiSource = () => read('lib/api.ts')

// ── 4. личные настройки живут в мобильном продукте ─────────────────────────

describe('122E поверхность личных настроек', () => {
  it('4. /m поддерживает личные настройки', () => {
    for (const path of ['/m', '/m/settings', '/m/profile', '/m/tickets/1']) {
      expect(supportsPersonalNotificationPreferences(path)).toBe(true)
    }
  })

  it('6. /max личные настройки не поддерживает', () => {
    for (const path of ['/max', '/max/settings', '/max/profile', '/max/tickets/1']) {
      expect(supportsPersonalNotificationPreferences(path)).toBe(false)
    }
  })

  it('6. один и тот же экран настроек, панель показывается только на /m', () => {
    const source = mobileSettings()
    // Экран общий для обоих корней — второй реализации для MAX не заводится.
    expect((router().match(/path="settings" element=\{<LazyRoute component=\{MobileSettingsPage\}/g) || []).length).toBe(2)
    expect(source).toMatch(/supportsPersonalNotificationPreferences\(location\.pathname\)/)
    expect(source).toMatch(/showPersonalNotificationPreferences \?/)
    // Панель на экране ровно одна.
    expect((source.match(/<NotificationPreferencesPanel \/>/g) || []).length).toBe(1)
  })

  it('5. мобильные настройки не уводят в Management и не редиректят', () => {
    const source = mobileSettings()
    // Ссылки в управленческую часть на экране есть и были до задачи, но
    // сами настройки уведомлений никуда не перенаправляют.
    // Срез — ровно охраняемый блок: от условия до его закрытия.
    const start = source.indexOf('showPersonalNotificationPreferences ?')
    const guarded = source.slice(start, source.indexOf(') : null}', start))
    expect(guarded).toContain('NotificationPreferencesPanel')
    expect(guarded).not.toMatch(/Navigate|workspaces|managementHomePath/)
    expect(panel()).not.toMatch(/Navigate|workspaces|managementHomePath|\/management/)
  })
})

// ── 7. один бэкенд на оба клиента ──────────────────────────────────────────

describe('122E общий бэкенд настроек', () => {
  it('7. desktop и mobile рисуют одну и ту же панель', () => {
    expect(desktopSettings()).toMatch(/<NotificationPreferencesPanel \/>/)
    expect(mobileSettings()).toMatch(/<NotificationPreferencesPanel \/>/)
  })

  it('7. хранилище настроек одно: единственный canonical endpoint', () => {
    const api = apiSource()
    const endpoints = [...api.matchAll(/'\/notifications\/preferences[^']*'/g)].map((m) => m[0])
    expect(endpoints.length).toBeGreaterThan(0)
    for (const endpoint of endpoints) expect(endpoint).toMatch(/^'\/notifications\/preferences/)
    // Второго хранилища/пути нет.
    expect(api).not.toMatch(/notification-preferences-v2|\/preferences\/personal|localStorage[^\n]*notifPref/)
    expect(panel()).not.toMatch(/localStorage|sessionStorage/)
  })
})

// ── подавление, а не разрешение ────────────────────────────────────────────

describe('122E настройка только подавляет', () => {
  it('клиентский тип позволяет отправить только enabled: false', () => {
    const api = apiSource()
    expect(api).toMatch(/enabled: false/)
    // Литеральный тип: включить настройкой нельзя, можно только снять её.
    expect(api).not.toMatch(/enabled: boolean/)
    expect(api).toMatch(/NotificationSettingsState = 'INHERITED' \| 'OFF'/)
  })

  it('включение снимает личную настройку, а не создаёт разрешающую', () => {
    const source = panel()
    expect(source).toMatch(/if \(change\.target\.checked\) resetM\.mutate\(input\)/)
    expect(source).toMatch(/else disableM\.mutate\(input\)/)
    expect(source).not.toMatch(/enabled:\s*(true|change\.target\.checked)/)
  })

  it('панель не обещает доступа', () => {
    expect(panel()).not.toMatch(/получить доступ|открывает доступ|даёт доступ/)
  })
})

// ── 8. только существующие события и каналы ────────────────────────────────

describe('122E модель событий', () => {
  it('8. список событий приходит с бэкенда, фронтенд его не выдумывает', () => {
    const source = panel()
    expect(source).toMatch(/settingsQ\.data\?\.contours/)
    expect(source).toMatch(/section\.contour/)
    expect(source).toMatch(/event\.labelRu/)
    expect(source).toMatch(/event\.descriptionRu/)
    // Ни одного зашитого имени события в разметке.
    expect(source).not.toMatch(/'ticket\.[a-z_]+'|"ticket\.[a-z_]+"/)
  })

  it('8. канал V1 только IN_APP; MAX личным каналом не является', () => {
    expect(apiSource()).toMatch(/NotificationSettingsChannel = 'IN_APP'/)
    expect(panel()).not.toMatch(/>MAX</)
    // PUSH остаётся отдельной legacy-настройкой и упомянут как таковой.
    expect(panel().replace(/\s+/g, ' ')).toMatch(/Push-уведомления настраиваются отдельно/)
  })
})
