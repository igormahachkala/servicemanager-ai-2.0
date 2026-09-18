/**
 * SMA-ROUND-REPORT-PRINT-116D
 *
 * Печатная версия акта обхода проверяется по исходникам, без браузера:
 * правила каскада в app.css и разметка InspectionRunReportPage.tsx.
 * Браузерная проверка (Chrome print preview / Save as PDF) описана
 * в отчёте задачи и выполняется отдельно — здесь фиксируются инварианты,
 * поломка которых уже приводила к обрезанной печати.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(resolve(root, 'src/app.css'), 'utf8')
const page = readFileSync(resolve(root, 'src/views/InspectionRunReportPage.tsx'), 'utf8')

const printStart = css.indexOf('@media print {')
assert.ok(printStart > -1, 'в app.css должен быть блок @media print')

function blockFrom(source, startIndex) {
  const open = source.indexOf('{', startIndex)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(startIndex, i + 1)
    }
  }
  throw new Error('незакрытый блок')
}

const printBlock = blockFrom(css, printStart)
const checks = []
const check = (name, fn) => { fn(); checks.push(name) }

// 1. A4 portrait как основной печатный формат.
check('@page задаёт A4 portrait', () => {
  const at = css.indexOf('@page')
  assert.ok(at > -1, 'нет правила @page')
  const rule = blockFrom(css, at)
  assert.match(rule, /size:\s*A4 portrait/)
  assert.match(rule, /margin:/)
})

// 2. Блок печати идёт последним: адаптивные брейкпоинты не должны его перебивать.
check('@media print объявлен после адаптивных брейкпоинтов', () => {
  const lastResponsive = css.lastIndexOf('@media (max-width')
  assert.ok(lastResponsive > -1, 'нет адаптивных брейкпоинтов')
  assert.ok(printStart > lastResponsive, '@media print должен идти после @media (max-width: ...)')
})

// 3. Никакой прокрутки в печати: overflow обрезает, а не переносит.
check('печать не оставляет прокручиваемых контейнеров', () => {
  assert.match(printBlock, /\.workActTableWrap[^}]*\}/s)
  const wrapRule = printBlock.slice(printBlock.indexOf('.workActTableWrap'))
  assert.match(wrapRule.slice(0, 220), /overflow:\s*visible\s*!important/)
})

// 4. Таблица пунктов обязана разрываться между страницами.
check('таблица пунктов разрывается между страницами', () => {
  const at = printBlock.indexOf('.workActTablePanel')
  assert.ok(at > -1)
  const rule = printBlock.slice(at, at + 260)
  assert.match(rule, /break-inside:\s*auto\s*!important/)
  assert.doesNotMatch(rule, /break-inside:\s*avoid/)
})

// 5. Шапка таблицы повторяется на каждой странице.
check('шапка таблицы повторяется на каждой странице', () => {
  assert.match(printBlock, /\.workActTable thead\s*\{[^}]*display:\s*table-header-group/s)
})

// 6. Фиксированная раскладка и заданные ширины колонок: длинный комментарий
//    иначе растягивает таблицу за границу листа.
check('фиксированная раскладка таблицы и шесть заданных колонок', () => {
  assert.match(printBlock, /\.workActTable\s*\{[^}]*table-layout:\s*fixed/s)
  for (let n = 1; n <= 6; n += 1) {
    assert.match(printBlock, new RegExp(`td:nth-child\\(${n}\\)\\s*\\{\\s*width:`), `нет ширины для колонки ${n}`)
  }
})

// 7. Длинные комментарии переносятся, а не выходят за ячейку.
check('длинные значения переносятся внутри ячейки', () => {
  const at = printBlock.indexOf('.workActTable th,')
  assert.ok(at > -1)
  const rule = printBlock.slice(at, at + 300)
  assert.match(rule, /overflow-wrap:\s*anywhere/)
  assert.match(rule, /word-break:\s*break-word/)
})

// 8. Сетки документа не схлопываются в одну колонку: мобильный брейкпоинт
//    задаёт их через !important, поэтому печать обязана перебивать так же.
check('сетки документа переживают мобильный !important', () => {
  for (const sel of [
    '.workActPartyGrid',
    '.workActMetaGrid',
    '.workActSummaryGrid',
    '.workActApprovalGrid',
    '.workActSignatureGrid',
  ]) {
    const at = printBlock.indexOf(sel)
    assert.ok(at > -1, `нет печатного правила для ${sel}`)
    assert.match(
      printBlock.slice(at, at + 200),
      /grid-template-columns:\s*repeat\([^;]*\)\s*!important;/,
      `${sel} должен перебивать мобильный !important`,
    )
  }
})

// 9. Оболочка приложения не обрезает документ по высоте экрана.
check('оболочка приложения не обрезает документ по высоте', () => {
  assert.match(
    printBlock,
    /\.contentArea,\s*\n\s*\.contentMain \{[^}]*height:\s*auto\s*!important[^}]*max-height:\s*none\s*!important/s,
    'оболочка контента должна снимать ограничение по высоте',
  )
  assert.match(printBlock, /\.appLayout\s*\{[^}]*overflow:\s*visible\s*!important/s)
})

// 10. Изображения ограничены по размеру.
check('изображения ограничены по размеру', () => {
  assert.match(printBlock, /\.workActAttachmentImage\s*\{[^}]*width:\s*16mm/s)
  assert.match(printBlock, /\.inspectionReportPage img\s*\{[^}]*max-width:\s*100%/s)
})

// 11. Навигация и кнопки в печать не попадают.
check('навигация и кнопки скрыты в печати', () => {
  const at = printBlock.indexOf('.no-print,')
  assert.ok(at > -1)
  assert.match(printBlock.slice(at, at + 200), /display:\s*none\s*!important/)
})

// 12. Статус пункта читается и без цвета.
check('статус пункта читается без цвета', () => {
  assert.match(printBlock, /\.workActItemStatus\s*\{[^}]*font-weight:\s*700/s)
  assert.match(printBlock, /\.workActItemStatus\.is-critical::after\s*\{[^}]*content/s)
  assert.doesNotMatch(
    printBlock.slice(printBlock.indexOf('.workActItemStatus {'), printBlock.indexOf('.workActItemStatus {') + 200),
    /white-space:\s*nowrap/,
    'nowrap выталкивает статус в соседнюю колонку',
  )
})

// 13. Последний блок не порождает пустую страницу.
check('последний блок не порождает пустую страницу', () => {
  assert.match(printBlock, /\.workActSignaturePanel\s*\{[^}]*break-after:\s*avoid/s)
})

// ── разметка ──────────────────────────────────────────────────────────

// 14. Заявка печатается номером, а не UUID.
check('связанная заявка печатается номером', () => {
  assert.match(page, /function ticketRefLabel/)
  assert.match(page, /Заявка №\$\{ticket\.ticketNumber\}/)
  assert.doesNotMatch(page, /Ticket #\{item\.ticket\.id\}/, 'UUID в печати недопустим')
})

// 15. Информация о подтверждении печатается, а не живёт только в no-print панели.
check('информация о подтверждении попадает в печать', () => {
  const at = page.indexOf('workActApprovalPanel')
  assert.ok(at > -1, 'нет печатного блока подтверждения')
  const section = page.slice(page.lastIndexOf('<section', at), at + 1600)
  assert.doesNotMatch(section.slice(0, 120), /no-print/, 'блок подтверждения не должен быть no-print')
  assert.match(section, /Итоговый статус акта/)
  assert.match(section, /Обход завершен/)
})

// 16. Обязательные разделы печатной формы присутствуют.
check('печатная форма содержит обязательные разделы', () => {
  for (const marker of [
    'Сервис Менеджер',
    'Локация',
    'Исполнитель обхода',
    'Шаблон',
    'Пункты обхода',
    'Связанные заявки',
    'Подписи',
  ]) {
    assert.ok(page.includes(marker), `в акте нет раздела «${marker}»`)
  }
})

// 17. Кнопка печати остаётся, но сама в печать не попадает.
check('кнопка печати не попадает в печать', () => {
  assert.match(page, /window\.print\(\)/)
  const row = page.slice(page.indexOf('<div className="row no-print">'), page.indexOf('window.print()'))
  assert.ok(row.length > 0, 'кнопка печати должна лежать внутри no-print строки')
})

console.log(`verify-round-report-print: ${checks.length} проверок пройдено`)
for (const name of checks) console.log(`  ok  ${name}`)
