/**
 * SMA-NOTIFICATION-PREFERENCES-UI-105C
 *
 * Инварианты экрана «Настройки → Уведомления»: русский текст, честный набор
 * каналов, отличимые умолчание и личная настройка, безопасное поведение при
 * плохом ответе API и отсутствие второго каталога на клиенте.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(resolve(root, rel), 'utf8')

const panel = read('src/components/notifications/NotificationPreferencesPanel.tsx')
const apiLayer = read('src/lib/api.ts')
const settingsPage = read('src/views/SettingsPage.tsx')
const mobileSettings = read('src/mobile/MobileSettingsPage.tsx')
const css = read('src/app.css')

const checks = []
const check = (name, fn) => { fn(); checks.push(name) }

check('экран доступен из настроек на десктопе и на мобильном', () => {
  for (const [name, source] of [['SettingsPage', settingsPage], ['MobileSettingsPage', mobileSettings]]) {
    assert.match(source, /NotificationPreferencesPanel/, `${name}: панель не подключена`)
  }
})

check('каталог не дублируется на клиенте', () => {
  // Подписи событий приходят с бэкенда; клиент не должен знать ключи событий.
  assert.doesNotMatch(panel, /ticket\.(created|assigned|comment_added|status_changed|sla_)/)
  assert.match(panel, /event\.labelRu/)
  assert.match(panel, /event\.descriptionRu/)
  assert.match(panel, /group\.titleRu/)
})

check('MAX не показывается как персональный тумблер', () => {
  // Канал рисуется только тот, что пришёл с бэкенда; жёстко зашитого MAX нет.
  assert.doesNotMatch(panel, /channels=\{\[[^\]]*MAX/)
  assert.match(panel, /\(event\.channels \|\| \[\]\)\.map/)
})

check('push отправлен на свой экран, а не продублирован', () => {
  assert.match(panel, /Push-уведомления на устройство настраиваются отдельно/)
})

check('умолчание и личная настройка различимы', () => {
  assert.match(panel, /state\.isOverride/)
  assert.match(panel, /По умолчанию/)
  assert.match(panel, /Вернуть умолчание/)
})

check('доступны выключение, включение и возврат к умолчанию', () => {
  assert.match(apiLayer, /export async function setNotificationPreference/)
  assert.match(apiLayer, /export async function clearNotificationPreference/)
  assert.match(apiLayer, /method: 'PATCH'/)
  assert.match(panel, /enabled: e\.target\.checked/)
  assert.match(panel, /resetM\.mutate/)
})

check('есть загрузка, ошибка, повтор и обратная связь на сохранение', () => {
  assert.match(panel, /Загружаем настройки…/)
  assert.match(panel, /settingsQ\.isError/)
  assert.match(panel, /Повторить/)
  assert.match(panel, /Сохраняем…/)
  assert.match(panel, /Не удалось сохранить настройку/)
  assert.match(panel, /Не удалось вернуть умолчание/)
})

check('плохой ответ API не роняет экран', () => {
  assert.match(panel, /Array\.isArray\(data\?\.groups\)/)
  assert.match(panel, /\(group\.events \|\| \[\]\)/)
  assert.match(panel, /\(event\.channels \|\| \[\]\)/)
})

check('пустой набор объясняется, а не выглядит поломкой', () => {
  assert.match(panel, /нет настраиваемых уведомлений/)
  assert.match(panel, /Это не отключает доставку/)
})

check('контролы доступны с клавиатуры и озвучиваются', () => {
  assert.match(panel, /aria-label=\{`\$\{event\.labelRu\} — \$\{channelLabel\(state\.channel\)\}`\}/)
  assert.match(panel, /aria-busy="true"/)
  assert.match(panel, /aria-live="polite"/)
  assert.match(panel, /role="alert"/)
  assert.match(panel, /<label className="notifPrefToggle">/)
})

check('верстка адаптивна', () => {
  assert.match(css, /\.notifPrefRow \{/)
  assert.match(css, /@media \(max-width: 768px\) \{[\s\S]*?\.notifPrefRow \{[\s\S]*?flex-direction: column/)
})

check('весь видимый текст русский', () => {
  const visible = [...panel.matchAll(/>([^<>{}\n]{4,})</g)].map((m) => m[1].trim()).filter(Boolean)
  for (const text of visible) {
    if (!/[A-Za-z]/.test(text)) continue
    // Допускается только название канала Push, оно же продуктовое имя.
    assert.ok(/Push/.test(text), `нерусский видимый текст: ${text}`)
  }
})

check('настройка не заявлена как способ получить доступ', () => {
  assert.match(panel, /никогда не открывает доступ/)
})

console.log(`verify-notification-preferences-ui: ${checks.length} проверок пройдено`)
for (const name of checks) console.log(`  ok  ${name}`)
