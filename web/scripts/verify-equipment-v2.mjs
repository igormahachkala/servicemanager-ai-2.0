import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * SMA-EQUIPMENT-V2-110A.
 *
 * Проверяется проводка экранов оборудования, а не правила доступа: правила живут
 * на бэкенде и покрыты equipment-v2.service.spec.ts, equipment-v2.repository.spec.ts
 * и equipment-photo-access.spec.ts. Здесь важно другое — что desktop и мобильный
 * экран спрашивают данные у сервера, а не решают за него, и что снимок берётся
 * через защищённую раздачу.
 *
 * Стиль повторяет verify-rounds-provider-location-scope.mjs: точечная проверка
 * исходника без рендера, потому что логика живёт в хуках компонента.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

/**
 * Комментарии убираются: в них названия прежнего поведения и канонических
 * примитивов упоминаются намеренно. Запреты ниже относятся к коду, не к тексту.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const desktop = read('src/views/EquipmentPage.tsx')
const mobile = read('src/mobile/MobileEquipmentPage.tsx')
const router = read('src/router.tsx')
const apiLayer = read('src/lib/api.ts')
const stubPages = read('src/lib/managementConsoleV2Pages.ts')

const desktopCode = stripComments(desktop)
const mobileCode = stripComments(mobile)

// ── маршруты: заглушки на /equipment больше нет ─────────────────────────────
assert.match(router, /path="equipment" element=\{<LazyRoute component=\{EquipmentPage\} \/>\}/)
assert.doesNotMatch(
  router,
  /path="equipment" element=\{<LazyRoute component=\{ManagementV2StubPage\} \/>\}/,
)
assert.doesNotMatch(stubPages, /path: '\/equipment'/)

// Мобильные маршруты заведены в обеих ветках оболочки: /m и /max.
assert.equal(
  (router.match(/path="equipment" element=\{<LazyRoute component=\{MobileEquipmentPage\} \/>\}/g) || []).length,
  2,
)
assert.equal(
  (router.match(/path="equipment\/:id" element=\{<LazyRoute component=\{MobileEquipmentPage\} \/>\}/g) || []).length,
  2,
)

// ── отбор идёт на сервере ───────────────────────────────────────────────────
assert.match(apiLayer, /export async function listEquipment/)
assert.match(apiLayer, /search\.set\('search', params\.search\)/)
assert.match(apiLayer, /search\.set\('locationId', params\.locationId\)/)
assert.match(apiLayer, /search\.set\('status', params\.status\)/)

// Поиск и фильтры попадают в ключ запроса — иначе экран показывал бы кэш от
// прошлых фильтров.
assert.match(desktopCode, /queryKey: \['equipment-list', scopeCompanyId, search, locationFilter, statusFilter\]/)
assert.match(desktopCode, /api\.listEquipment\(\{/)
assert.match(mobileCode, /queryKey: \['mobile-equipment', search\]/)

// Отбор самой выборки в браузере запрещён: это и есть «выгрузить весь парк».
// filter(Boolean) при склейке подписей к делу не относится.
for (const [name, code] of [['desktop', desktopCode], ['mobile', mobileCode]]) {
  assert.doesNotMatch(code, /rows\.filter\(/, `${name}: выборка фильтруется в браузере`)
  assert.doesNotMatch(code, /\.data \|\| \[\]\)\.filter\(/, `${name}: выборка фильтруется в браузере`)
}

// ── провайдерский контур повторяет «Локации», своего резолвера нет ──────────
assert.match(desktopCode, /api\.getLinkedClients\(\)/)
assert.match(desktopCode, /const isProviderScope = linkedClients\.length > 0/)
assert.match(desktopCode, /const scopeCompanyId = isProviderScope \? selectedClientId : ''/)
assert.match(desktopCode, /enabled: scopeReady/)

// ── снимок только через защищённую раздачу ─────────────────────────────────
for (const [name, code] of [['desktop', desktopCode], ['mobile', mobileCode]]) {
  assert.match(code, /ProtectedUploadImg/, `${name}: снимок должен идти через ProtectedUploadImg`)
  assert.doesNotMatch(code, /<img\s+src=/, `${name}: прямой <img src> обходит авторизацию`)
  assert.doesNotMatch(code, /\/uploads\//, `${name}: путь к файлу собирается не на фронтенде`)
}

// ── мобильный экран только читает ──────────────────────────────────────────
assert.doesNotMatch(mobileCode, /useMutation/)
assert.doesNotMatch(mobileCode, /api\.(createEquipment|updateEquipment|deleteEquipment|uploadEquipmentPhoto)/)
assert.doesNotMatch(mobileCode, /<form/)
assert.match(mobileCode, /api\.getEquipment\(equipmentId\)/)
assert.match(mobileCode, /api\.listEquipment/)

// Карточка показывает паспорт, ради которого её и открывают в поле.
for (const field of ['serialNumber', 'inventoryNumber', 'manufacturer', 'model', 'warrantyUntil']) {
  assert.match(mobileCode, new RegExp(`item\\.${field}`), `mobile: в карточке нет поля ${field}`)
}

// ── правка — только в управленческой части и только у ролей с LOCATIONS_MANAGE ──
assert.match(desktopCode, /const MANAGER_ROLES = \['ADMIN', 'MASTER', 'DISPATCHER'\]/)
assert.match(desktopCode, /const canManage = MANAGER_ROLES\.includes/)
assert.match(desktopCode, /canManage \? \(/)
assert.match(desktopCode, /api\.uploadEquipmentPhoto/)

// Статусы берутся из общего словаря, а не переписываются на экране.
assert.match(apiLayer, /export const EQUIPMENT_STATUS_LABELS/)
for (const code of [desktopCode, mobileCode]) {
  assert.match(code, /api\.EQUIPMENT_STATUS_LABELS/)
}

console.log('verify-equipment-v2: OK')
