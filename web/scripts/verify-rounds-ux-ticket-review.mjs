import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const review = read('src/components/inspection/InspectionTicketReview.tsx')
const labels = read('src/lib/inspectionPresentation.ts')
const desktopRun = read('src/views/InspectionRunPage.tsx')
const mobileRun = read('src/mobile/MobileInspectionRunPage.tsx')
const quickRun = read('src/views/InspectionQuickPage.tsx')
const templates = read('src/views/InspectionTemplatesPage.tsx')
const mobileList = read('src/mobile/MobileInspectionList.tsx')
const report = read('src/views/InspectionRunReportPage.tsx')
const css = read('src/app.css')

for (const text of ['Пункт обхода', 'Локация', 'Оборудование', 'Категория', 'Описание', 'Фото', 'Создать заявку', 'Отмена']) {
  assert.match(review, new RegExp(text), `review must show ${text}`)
}
assert.match(labels, /CRITICAL[^\n]+Срочная заявка/)
assert.match(labels, /Обычная заявка/)
assert.match(labels, /IN_PROGRESS[^\n]+В процессе/)
assert.match(labels, /OK[^\n]+Норма/)
assert.match(labels, /DRAFT[^\n]+Отчёт: черновик/)

for (const [name, source] of [['desktop', desktopRun], ['mobile', mobileRun], ['quick', quickRun]]) {
  assert.match(source, /InspectionTicketReview/, `${name} must use the shared review`)
  assert.doesNotMatch(codeOnly(source), /categories\[0\]|activeCategories\[0\]/, `${name} must not choose the first category implicitly`)
}
assert.doesNotMatch(desktopRun, /urgency:\s*['"](?:URGENT|NOT_URGENT)['"]/, 'desktop must not override urgency')
assert.doesNotMatch(mobileRun, /urgency:\s*['"](?:URGENT|NOT_URGENT)['"]/, 'mobile must not override urgency')
assert.doesNotMatch(quickRun, /urgency:\s*['"](?:URGENT|NOT_URGENT)['"]/, 'quick mode must not override urgency')
assert.match(desktopRun, /submittingTicketItemIdsRef\.current\.has/)
assert.match(mobileRun, /submittingTicketItemIdsRef\.current\.has/)
assert.match(desktopRun, /Создана заявка №/)
assert.match(mobileRun, /Создана заявка №/)

assert.match(templates, /inspectionTemplateZoneFields/)
assert.match(templates, /inspectionTemplateResponseFields/)
assert.match(templates, /inspectionTemplateWorkspace/)
assert.match(templates, /inspectionTemplateChoice--selected/)
assert.doesNotMatch(templates, /gridTemplateColumns:\s*'1fr 120px 120px'/)
assert.doesNotMatch(templates, /gridTemplateColumns:\s*'1fr 110px 110px 110px'/)
assert.match(css, /@media \(max-width: 1180px\)/)
assert.match(css, /@media \(max-width: 1040px\)/)
assert.match(css, /\.topbar[^}]+flex-wrap:\s*wrap/s)

assert.match(mobileList, /inspectionReportStatusLabel/)
assert.match(report, /inspectionItemStatusLabel/)
assert.doesNotMatch(report, />OK</)
assert.doesNotMatch(report, /Открыть ticket|Ticket #|completed inspection run|Completed run/)

console.log('verify-rounds-ux-ticket-review: PASS')
