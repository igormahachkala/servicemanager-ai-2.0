import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const list = read('src/mobile/MobileInspectionList.tsx')
const start = read('src/mobile/MobileInspectionStartPage.tsx')
const router = read('src/router.tsx')
const backend = read('../backend/src/inspection/inspection.service.ts')

assert.match(list, /Начать обход/)
assert.match(list, /inspection\/start/)
assert.equal((router.match(/path="inspection\/start"/g) || []).length, 2)

assert.match(start, /api\.getInspectionTemplates/)
assert.match(start, /api\.getTechnicianBoundContexts/)
assert.match(start, /api\.getLinkedClients/)
assert.match(start, /api\.locations\(clientCompanyId \|\| undefined\)/)
assert.match(start, /api\.startInspectionRun/)
assert.match(start, /useOfflineStatus/)
assert.match(start, /!offline\.online/)
assert.match(start, /Начать новый обход можно только онлайн/)
assert.match(start, /templates\.length === 1/)
assert.match(start, /activeLocations\.length === 1/)
assert.match(start, /clientOptions\.length > 1/)
assert.match(start, /clientOptions\.length === 1/)
assert.match(start, /Нет доступных типов обхода/)
assert.match(start, /Нет доступных локаций/)
assert.match(start, /Что будет проверено/)
assert.match(start, /mobilePath\(location\.pathname, `\/inspection\/\$\{run\.id\}`\)/)
assert.doesNotMatch(start, /ServiceContract|SELECTED_LOCATIONS|ALL_LOCATIONS|locationMode/)

assert.match(backend, /assertInspectionLocationAccess/)
assert.match(backend, /assertActorCanUseLocation/)
assert.match(backend, /where: \{ id: dto\.templateId, companyId: user\.companyId, isActive: true \}/)

console.log('verify-mobile-round-self-start: PASS')
