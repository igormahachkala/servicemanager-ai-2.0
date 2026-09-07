import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * SMA-ROUNDS-V1-PROVIDER-CLIENT-LOCATION-SELECTOR-103B.
 *
 * Проверяется проводка экранов обходов, а не правила доступа: правила живут на
 * бэкенде (097 + канонические примитивы контракта) и покрыты
 * inspection.service.access.spec.ts. Здесь важно другое — что фронтенд спрашивает
 * данные в контуре клиента и не пытается решать доступ сам.
 *
 * Стиль повторяет web/scripts/verify-mobile-shift-gate.mjs: точечная проверка
 * исходника без рендера, потому что логика живёт в хуках компонента.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

const roundCreation = read('src/views/InspectionTemplatesPage.tsx')
const desktopRun = read('src/views/InspectionRunPage.tsx')
const mobileRun = read('src/mobile/MobileInspectionRunPage.tsx')
const quickRun = read('src/views/InspectionQuickPage.tsx')

// ── создание обхода: площадки берутся в контуре выбранного клиента ──────────
assert.match(roundCreation, /api\.getLinkedClients\(\)/)
assert.match(roundCreation, /const isProviderScope = linkedClients\.length > 0/)
assert.match(roundCreation, /const scopeCompanyId = isProviderScope \? selectedClientId : ''/)

// Список площадок запрашивается с companyId клиента и кэшируется по нему.
assert.match(roundCreation, /queryKey: \['locations', scopeCompanyId\]/)
assert.match(roundCreation, /api\.locations\(scopeCompanyId \|\| undefined\)/)

// В провайдерском контуре без выбранного клиента запрос не уходит вовсе:
// без companyId бэкенд вернул бы точки самого провайдера, а их в обходе быть не должно.
assert.match(roundCreation, /enabled: !isProviderScope \|\| !!scopeCompanyId/)

// Клиентский контур не задет: linked-clients пуст → companyId не передаётся.
assert.match(roundCreation, /if \(!isProviderScope\) \{\s*\n\s*if \(selectedClientId\) setSelectedClientId\(''\)/)

// Выбор клиента есть в интерфейсе, и до него площадку выбрать нельзя.
assert.match(roundCreation, /Клиент \(контур\)/)
assert.match(roundCreation, /disabled=\{isProviderScope && !scopeCompanyId\}/)

// ── заявка из пункта: каталог категорий в контуре владельца площадки (103) ──
for (const [name, source] of [
  ['InspectionRunPage', desktopRun],
  ['MobileInspectionRunPage', mobileRun],
  ['InspectionQuickPage', quickRun],
]) {
  assert.match(
    source,
    /const targetClientCompanyId = runQ\.data\?\.location\?\.clientCompanyId \|\| ''/,
    `${name}: каталог категорий должен браться по владельцу площадки`,
  )
  assert.match(
    source,
    /queryKey: \['problem-categories', targetClientCompanyId\]/,
    `${name}: companyId обязан входить в ключ кэша`,
  )
  assert.match(
    source,
    /api\.problemCategories\(targetClientCompanyId\)/,
    `${name}: категории запрашиваются в контуре клиента`,
  )
  assert.match(source, /enabled: !!targetClientCompanyId/, `${name}: без клиента запрос не уходит`)
}

// ── мобильная ссылка на связанную заявку (SMA-103-MOBILE-OPEN-LINKED-TICKET-FIX) ──
// Заявка принадлежит владельцу площадки. Контур ссылки обязан считаться от него,
// а не от компании исполнителя обхода, иначе провайдер получает «не найдена».
assert.match(mobileRun, /function linkedTicketHref\(ticketId: string\): string/)
assert.match(
  mobileRun,
  /scopeForMobileTicketLink\(meQ\.data, pageScope, \{ companyId: targetClientCompanyId \}\)/,
  'мобильная ссылка должна считать контур каноническим помощником от владельца заявки',
)
assert.match(
  mobileRun,
  /state=\{mobileTicketNavState\('home', targetClientCompanyId \|\| run\?\.companyId\)\}/,
  'в состояние навигации передаётся владелец заявки, а не компания обхода',
)
// Идентификатор — uuid заявки, не её номер: номер показывается, но не адресует.
assert.match(mobileRun, /linkedTicketHref\(createdTicketId\)/)
assert.doesNotMatch(mobileRun, /\/tickets\/\$\{createdTicketNumber\}/)
assert.match(desktopRun, /to=\{'\/tickets\/' \+ item\.ticketId\}/, 'десктопная ссылка не менялась')

// Прежнее поведение — подстановка location.search обхода целиком — убрано:
// чужой linkedClientCompanyId из него побеждал бы владельца заявки.
assert.doesNotMatch(
  mobileRun,
  /\/tickets\/\$\{createdTicketId\}`\)\}\$\{location\.search\}/,
  'search обхода не должен подставляться в ссылку на заявку',
)

// ── второго резолвера доступа во фронтенде нет ─────────────────────────────
/**
 * Комментарии убираются: в них имена канонических примитивов упоминаются
 * намеренно — чтобы читатель знал, где живут правила. Запрет относится к коду.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

for (const [name, source] of [
  ['InspectionTemplatesPage', roundCreation],
  ['InspectionRunPage', desktopRun],
  ['MobileInspectionRunPage', mobileRun],
  ['InspectionQuickPage', quickRun],
]) {
  const code = stripComments(source)
  for (const forbidden of [
    /getLinkedClientAccess/,
    /isServiceContractLocationAllowed/,
    /locationMode/,
    /SELECTED_LOCATIONS/,
    /ALL_LOCATIONS/,
  ]) {
    assert.doesNotMatch(
      code,
      forbidden,
      `${name}: правила контракта решает бэкенд, во фронтенде их быть не должно (${forbidden})`,
    )
  }
}

console.log('verify-rounds-provider-location-scope: PASS')
