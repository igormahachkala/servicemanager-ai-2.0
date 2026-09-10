import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Проверяется проводка экранов, а не правила доступа: доступ живёт на бэкенде
 * и покрыт equipment-history-parts.service.spec.ts, где EquipmentService
 * собирается настоящий. Здесь важно другое — что фронтенд спрашивает данные
 * у сервера, что мобильный экран остаётся читающим и что складского в интерфейс
 * не просочилось.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

/** Комментарии убираются: в них термины упоминаются намеренно. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const page = stripComments(read('src/views/EquipmentPage.tsx'))
const historyTab = stripComments(read('src/components/equipment/EquipmentHistoryTab.tsx'))
const partsTab = stripComments(read('src/components/equipment/EquipmentPartsTab.tsx'))
const mobile = stripComments(read('src/mobile/MobileEquipmentPage.tsx'))
const apiLayer = stripComments(read('src/lib/api.ts'))

// ── вкладки карточки ───────────────────────────────────────────────────────
for (const label of ['Обзор', 'История', 'Компоненты']) {
  assert.match(page, new RegExp(`'${label}'`), `desktop: нет вкладки ${label}`)
}
assert.match(page, /<EquipmentHistoryTab/)
assert.match(page, /<EquipmentPartsTab/)

// ── история берётся с сервера, своей копии цикла нет ───────────────────────
assert.match(apiLayer, /export async function getEquipmentHistory/)
assert.match(historyTab, /api\.getEquipmentHistory/)
assert.match(historyTab, /entry\.workReports/)
assert.match(historyTab, /entry\.result/)
assert.match(historyTab, /Открыть заявку/)
// Состав работ по деталям — только из partsInstalled/partsRemoved,
// то есть из InstalledPart, а не из текста заявки.
assert.match(historyTab, /entry\.partsInstalled/)
assert.match(historyTab, /entry\.partsRemoved/)
assert.doesNotMatch(historyTab, /problemText\.(match|includes|search)/)
assert.doesNotMatch(historyTab, /replace\w*\s*=\s*\/.*\/(i|g)/)

// ── замена: обязательная заявка и явные «снимаем/ставим» ───────────────────
assert.match(partsTab, /Что снимаем/)
assert.match(partsTab, /Установлено сейчас/)
assert.match(partsTab, /История замен/)
assert.match(partsTab, /Добавить комплектующую/)
assert.match(partsTab, /Заменить/)
assert.match(partsTab, /По какой заявке/)
// Замена без заявки не отправляется — интерфейс не даёт обойти правило сервера.
assert.match(partsTab, /if \(!form\.ticketId\)/)
assert.match(partsTab, /api\.replaceEquipmentPart/)
assert.match(partsTab, /api\.installEquipmentPart/)

// Разделение «стоит сейчас» / «снято» приходит с сервера, а не считается тут.
assert.match(partsTab, /partsQ\.data\?\.installed/)
assert.match(partsTab, /partsQ\.data\?\.history/)
assert.doesNotMatch(partsTab, /\.filter\(\s*\(?\w+\)?\s*=>\s*\w+\.removedAt/)

// ── мобильный экран только читает ──────────────────────────────────────────
assert.doesNotMatch(mobile, /useMutation/)
assert.doesNotMatch(mobile, /<form/)
for (const write of [
  'installEquipmentPart',
  'replaceEquipmentPart',
  'createPartDefinition',
  'createEquipment',
  'updateEquipment',
  'uploadEquipmentPhoto',
]) {
  assert.doesNotMatch(mobile, new RegExp(`api\\.${write}`), `mobile: запись ${write} недопустима`)
}
assert.match(mobile, /api\.getEquipmentHistory/)
assert.match(mobile, /api\.getEquipmentParts/)
assert.match(mobile, /заводятся и заменяются в управленческой части/)

// ── граница склада ─────────────────────────────────────────────────────────
const warehouseTerms = [
  'stockQuantity', 'stockLevel', 'onHand', 'purchasePrice', 'unitPrice',
  'reservation', 'reserved', 'writeOff', 'inventoryCount', 'warehouse',
]
for (const [name, code] of [['api', apiLayer], ['parts', partsTab], ['history', historyTab], ['mobile', mobile]]) {
  for (const term of warehouseTerms) {
    assert.doesNotMatch(code, new RegExp(`\\b${term}\\b`, 'i'), `${name}: складской термин ${term} — граница нарушена`)
  }
}

// PartDefinition в типах не несёт складских полей.
const defType = apiLayer.match(/export type PartDefinitionItem = \{[\s\S]*?\n\}/)
assert.ok(defType, 'нет типа PartDefinitionItem')
for (const term of ['price', 'stock', 'cost', 'reserved']) {
  assert.doesNotMatch(defType[0], new RegExp(term, 'i'), `PartDefinitionItem: поле ${term} — граница склада нарушена`)
}

// status установленной детали приходит с сервера вычисленным.
assert.match(apiLayer, /status: 'INSTALLED' \| 'REMOVED'/)

console.log('verify-equipment-history-parts: OK')
