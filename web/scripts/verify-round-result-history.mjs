/**
 * SMA-ROUND-RESULT-HISTORY-116F
 *
 * Инварианты результата и истории обхода на фронте: снимок вместо живой связи
 * с шаблоном, русскоязычные подписи вместо сырых enum, доступность итога
 * на мобильном и отсутствие дозапросов на каждую карточку истории.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(resolve(root, rel), 'utf8')

const runsPage = read('src/views/InspectionRunsPage.tsx')
const runPage = read('src/views/InspectionRunPage.tsx')
const reportPage = read('src/views/InspectionRunReportPage.tsx')
const mobileList = read('src/mobile/MobileInspectionList.tsx')
const mobileRun = read('src/mobile/MobileInspectionRunPage.tsx')
const apiLayer = read('src/lib/api.ts')

const checks = []
const check = (name, fn) => { fn(); checks.push(name) }

// ── снимок вместо живой связи ─────────────────────────────────────────

check('история и итог не читают живое имя шаблона', () => {
  for (const [name, source] of [
    ['InspectionRunsPage', runsPage],
    ['InspectionRunPage', runPage],
    ['InspectionRunReportPage', reportPage],
    ['MobileInspectionList', mobileList],
    ['MobileInspectionRunPage', mobileRun],
  ]) {
    assert.doesNotMatch(
      source,
      /\{\s*(report\.)?run\.template\??\.name\s*\}/,
      `${name}: историческая запись не должна показывать template.name — шаблон редактируемый`,
    )
  }
})

check('итог обхода подписан снимком названия', () => {
  assert.match(reportPage, /\{report\.run\.title\}/)
  assert.match(mobileRun, /\{run\.title\}/)
  assert.match(runPage, /Обход: \{run\.title\}/)
})

check('api описывает title как снимок', () => {
  assert.match(apiLayer, /Снимок названия обхода на момент запуска/)
  assert.match(apiLayer, /export type InspectionRunListSummary/)
})

// ── русскоязычные подписи ─────────────────────────────────────────────

check('статусы в истории переведены, сырой enum не рендерится', () => {
  assert.doesNotMatch(runsPage, /\{run\.status\}/, 'сырой enum статуса в разметке')
  assert.doesNotMatch(runsPage, /\{run\.reportStatus\}/, 'сырой enum статуса акта в разметке')
  assert.match(runsPage, /function runStatusLabel/)
  assert.match(runsPage, /function reportStatusLabel/)
  for (const ru of ['В процессе', 'Завершён', 'Черновик', 'На проверке', 'Утверждён', 'Возвращён']) {
    assert.ok(runsPage.includes(ru), `нет подписи «${ru}»`)
  }
})

check('видимый текст истории только на русском', () => {
  // Латиница допустима в коде и в className, но не в подписях фильтров.
  for (const label of ['Объект', 'Исполнитель', 'Статус обхода', 'Статус акта', 'Начат с', 'Начат по']) {
    assert.ok(runsPage.includes(label), `нет фильтра «${label}»`)
  }
  assert.ok(runsPage.includes('Итог обхода'))
})

// ── фильтры по существующим измерениям ────────────────────────────────

check('фильтры истории идут на сервер', () => {
  assert.match(apiLayer, /export type InspectionRunsFilter/)
  assert.match(apiLayer, /export async function getInspectionRuns\(filter: InspectionRunsFilter = \{\}\)/)
  assert.match(runsPage, /api\.getInspectionRuns\(filter\)/)
  assert.match(runsPage, /queryKey: \['inspection-runs', filter\]/)
})

check('фильтры не заводят новых доменных полей', () => {
  const allowed = ['from', 'to', 'locationId', 'performedByUserId', 'templateId', 'status', 'reportStatus', 'limit']
  const block = apiLayer.slice(apiLayer.indexOf('export type InspectionRunsFilter'))
  const body = block.slice(0, block.indexOf('}'))
  const fields = [...body.matchAll(/^\s*(\w+)\?:/gm)].map((m) => m[1])
  assert.deepEqual(fields.sort(), [...allowed].sort())
})

// ── итог обхода ───────────────────────────────────────────────────────

check('история показывает итог, исполнителя и длительность', () => {
  assert.match(runsPage, /function durationLabel/)
  for (const label of ['Пунктов:', 'Норма:', 'Проблема:', 'Критично:', 'Заявок создано:', 'Длительность']) {
    assert.ok(runsPage.includes(label), `в карточке истории нет «${label}»`)
  }
  assert.match(runsPage, /personLabel\(run\.performedBy\)/)
})

check('длительность считается только по завершённому обходу', () => {
  for (const [name, source] of [['desktop', runsPage], ['mobile', mobileRun]]) {
    const at = source.indexOf('function durationLabel')
    const body = source.slice(at, source.indexOf('\n}', at))
    assert.match(body, /if \(!startedAt \|\| !completedAt\)/, `${name}: незавершённый обход не имеет длительности`)
    assert.match(body, /to <= from/, `${name}: неверный порядок отметок должен давать прочерк`)
  }
})

// ── мобильный итог ────────────────────────────────────────────────────

check('исполнитель видит итог проверки акта на телефоне', () => {
  assert.match(mobileRun, /Статус акта/)
  assert.match(mobileRun, /function reviewStatusLabel/)
  assert.match(mobileRun, /run\.reportReviewedBy/)
  assert.match(mobileRun, /run\.reportReviewComment/)
})

check('мобильный итог остаётся чтением, без управляющих действий', () => {
  const at = mobileRun.indexOf('Статус акта')
  const block = mobileRun.slice(at - 900, at + 1800)
  for (const f of ['submitInspectionRunReport', 'reviewInspectionRunReport']) {
    assert.ok(!block.includes(f), `мобильный итог не должен вызывать ${f}`)
  }
})

check('мобильная история объекта не дозапрашивает каждую карточку', () => {
  assert.ok(!mobileList.includes('useQueries'), 'дозапрос на каждый обход — это N+1 на клиенте')
  assert.match(mobileList, /run\.summary\.issueCount \+ run\.summary\.criticalCount/)
  assert.match(mobileList, /run\.summary\.createdTicketsCount/)
  assert.match(mobileList, /locationId: objectLocationId/)
})

console.log(`verify-round-result-history: ${checks.length} проверок пройдено`)
for (const name of checks) console.log(`  ok  ${name}`)
