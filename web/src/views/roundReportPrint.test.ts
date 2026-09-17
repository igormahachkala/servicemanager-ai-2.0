import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

function blockFrom(source: string, startIndex: number) {
  const open = source.indexOf('{', startIndex)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(startIndex, i + 1)
    }
  }
  throw new Error('Unclosed CSS block')
}

describe('round report print source contract', () => {
  const css = () => read('src/app.css')
  const page = () => read('src/views/InspectionRunReportPage.tsx')
  const printStart = () => css().indexOf('@media print {')
  const printBlock = () => blockFrom(css(), printStart())

  it('keeps A4 print layout after responsive breakpoints', () => {
    expect(printStart()).toBeGreaterThan(-1)
    const pageAt = css().indexOf('@page')
    expect(pageAt).toBeGreaterThan(-1)
    expect(blockFrom(css(), pageAt)).toMatch(/size:\s*A4 portrait/)
    expect(blockFrom(css(), pageAt)).toMatch(/margin:/)
    expect(printStart()).toBeGreaterThan(css().lastIndexOf('@media (max-width'))
  })

  it('prevents clipping and preserves printable table layout', () => {
    expect(printBlock()).toMatch(/\.workActTableWrap[^}]*\}/s)
    expect(printBlock().slice(printBlock().indexOf('.workActTableWrap'), printBlock().indexOf('.workActTableWrap') + 220)).toMatch(
      /overflow:\s*visible\s*!important/,
    )

    const panelRule = printBlock().slice(printBlock().indexOf('.workActTablePanel'), printBlock().indexOf('.workActTablePanel') + 260)
    expect(panelRule).toMatch(/break-inside:\s*auto\s*!important/)
    expect(panelRule).not.toMatch(/break-inside:\s*avoid/)
    expect(printBlock()).toMatch(/\.workActTable thead\s*\{[^}]*display:\s*table-header-group/s)
    expect(printBlock()).toMatch(/\.workActTable\s*\{[^}]*table-layout:\s*fixed/s)

    for (let n = 1; n <= 6; n += 1) {
      expect(printBlock()).toMatch(new RegExp(`td:nth-child\\(${n}\\)\\s*\\{\\s*width:`))
    }

    const cellRule = printBlock().slice(printBlock().indexOf('.workActTable th,'), printBlock().indexOf('.workActTable th,') + 300)
    expect(cellRule).toMatch(/overflow-wrap:\s*anywhere/)
    expect(cellRule).toMatch(/word-break:\s*break-word/)
  })

  it('keeps document grids, images and status readable in print', () => {
    for (const selector of [
      '.workActPartyGrid',
      '.workActMetaGrid',
      '.workActSummaryGrid',
      '.workActApprovalGrid',
      '.workActSignatureGrid',
    ]) {
      const at = printBlock().indexOf(selector)
      expect(at, `missing print rule for ${selector}`).toBeGreaterThan(-1)
      expect(printBlock().slice(at, at + 200)).toMatch(/grid-template-columns:\s*repeat\([^;]*\)\s*!important;/)
    }

    expect(printBlock()).toMatch(
      /\.contentArea,\s*\n\s*\.contentMain \{[^}]*height:\s*auto\s*!important[^}]*max-height:\s*none\s*!important/s,
    )
    expect(printBlock()).toMatch(/\.appLayout\s*\{[^}]*overflow:\s*visible\s*!important/s)
    expect(printBlock()).toMatch(/\.workActAttachmentImage\s*\{[^}]*width:\s*16mm/s)
    expect(printBlock()).toMatch(/\.inspectionReportPage img\s*\{[^}]*max-width:\s*100%/s)
    expect(printBlock()).toMatch(/\.no-print,[^}]*display:\s*none\s*!important/s)
    expect(printBlock()).toMatch(/\.workActItemStatus\s*\{[^}]*font-weight:\s*700/s)
    expect(printBlock()).toMatch(/\.workActItemStatus\.is-critical::after\s*\{[^}]*content/s)
    expect(
      printBlock().slice(printBlock().indexOf('.workActItemStatus {'), printBlock().indexOf('.workActItemStatus {') + 200),
    ).not.toMatch(/white-space:\s*nowrap/)
    expect(printBlock()).toMatch(/\.workActSignaturePanel\s*\{[^}]*break-after:\s*avoid/s)
  })

  it('prints historical report content, ticket number and approval details', () => {
    expect(page()).toMatch(/function ticketRefLabel/)
    expect(page()).toMatch(/Заявка №\$\{ticket\.ticketNumber\}/)
    expect(page()).not.toMatch(/Ticket #\{item\.ticket\.id\}/)

    const at = page().indexOf('workActApprovalPanel')
    expect(at).toBeGreaterThan(-1)
    const section = page().slice(page().lastIndexOf('<section', at), at + 1600)
    expect(section.slice(0, 120)).not.toMatch(/no-print/)
    expect(section).toMatch(/Итоговый статус акта/)
    expect(section).toMatch(/Обход завершен/)

    for (const marker of ['Сервис Менеджер', 'Локация', 'Исполнитель обхода', 'Шаблон', 'Пункты обхода', 'Связанные заявки', 'Подписи']) {
      expect(page()).toContain(marker)
    }
    expect(page()).toMatch(/window\.print\(\)/)
    const row = page().slice(page().indexOf('<div className="row no-print">'), page().indexOf('window.print()'))
    expect(row.length).toBeGreaterThan(0)
  })
})
