import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const list = read('src/mobile/MobileInspectionList.tsx')
const start = read('src/mobile/MobileInspectionStartPage.tsx')
const run = read('src/mobile/MobileInspectionRunPage.tsx')
const router = read('src/router.tsx')
const inspectionService = read('../backend/src/inspection/inspection.service.ts')

// Entry and route exist on both Mobile and MAX surfaces.
assert.match(list, /Начать обход/)
assert.match(list, /inspection\/start/)
assert.match(list, /const runHref = `\$\{mobilePath\(location\.pathname, `\/inspection\/\$\{run\.id\}`\)\}\$\{location\.search\}`/)
assert.doesNotMatch(list, /String\(runsQ\.error\)|runsQ\.error as any\)\?\.message/)
assert.equal((router.match(/path="inspection\/start"/g) || []).length, 2)

// The mobile start page reuses the canonical Desktop APIs and delegates filtering to backend.
assert.match(start, /api\.getInspectionTemplates/)
assert.match(start, /api\.getLinkedClients/)
assert.match(start, /api\.locations\(scopeCompanyId \|\| undefined\)/)
assert.match(start, /filter\(\(item\) => item\.isActive !== false\)/)
assert.match(start, /api\.startInspectionRun/)
assert.match(start, /mobilePath\(location\.pathname, `\/inspection\/\$\{run\.id\}`\)/)
assert.doesNotMatch(start, /SELECTED_LOCATIONS|ALL_LOCATIONS|locationMode|ServiceContract/)

// Selection stays explicit and the page has bounded loading, empty and sanitized error states.
assert.match(start, /Выберите тип обхода/)
assert.match(start, /Выберите клиента/)
assert.match(start, /Выберите локацию/)
assert.match(start, /Нет доступных типов обхода/)
assert.match(start, /Нет доступных локаций/)
assert.match(start, /Не удалось начать обход/)
assert.doesNotMatch(start, /String\(.*error|error\.message/)

// All canonical checkpoint states are selectable with Russian presentation.
for (const label of ['Норма', 'Проблема', 'Критично']) assert.match(run, new RegExp(label))
assert.match(run, /setProblemStatus\('ISSUE'\)/)
assert.match(run, /setProblemStatus\('CRITICAL'\)/)
assert.match(run, /payload: \{ status: problemStatus, requiresRepair: true/)
assert.doesNotMatch(run, />\s*OK\s*</)
assert.doesNotMatch(run, />\s*ISSUE\s*</)
assert.doesNotMatch(run, />\s*CRITICAL\s*</)

// Ticket urgency is owned by the existing backend fallback, not duplicated in mobile UI.
const createTicketBlock = run.slice(run.indexOf('async function createTicket'), run.indexOf('async function completeRun'))
assert.doesNotMatch(createTicketBlock, /urgency:/)
assert.match(
  inspectionService,
  /item\.status === InspectionRunItemStatus\.CRITICAL \?\s*TicketUrgency\.URGENT : TicketUrgency\.NOT_URGENT/,
)

// Existing linked-ticket persistence and navigation remain wired.
assert.match(run, /item\.ticket\?\.ticketNumber/)
assert.match(run, /linkedTicketHref\(createdTicketId\)/)
assert.match(run, /Открыть заявку #\$\{createdTicketNumber\}/)
assert.match(run, /const backHref = `\$\{mobilePath\(location\.pathname, '\/inspection'\)\}\$\{location\.search\}`/)

console.log('verify-mobile-rounds-full-cycle: PASS')
