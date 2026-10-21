import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('round result and history source contract', () => {
  const runsPage = () => read('src/views/InspectionRunsPage.tsx')
  const runPage = () => read('src/views/InspectionRunPage.tsx')
  const reportPage = () => read('src/views/InspectionRunReportPage.tsx')
  const mobileList = () => read('src/mobile/MobileInspectionList.tsx')
  const mobileRun = () => read('src/mobile/MobileInspectionRunPage.tsx')
  const apiLayer = () => read('src/lib/api.ts')

  it('uses the run title snapshot instead of mutable template names', () => {
    for (const [name, source] of [
      ['InspectionRunsPage', runsPage()],
      ['InspectionRunPage', runPage()],
      ['InspectionRunReportPage', reportPage()],
      ['MobileInspectionList', mobileList()],
      ['MobileInspectionRunPage', mobileRun()],
    ] as const) {
      expect(source, `${name}: history must not render mutable template.name`).not.toMatch(
        /\{\s*(report\.)?run\.template\??\.name\s*\}/,
      )
    }

    expect(reportPage()).toMatch(/\{report\.run\.title\}/)
    expect(mobileRun()).toMatch(/\{run\.title\}/)
    expect(runPage()).toMatch(/Обход: \{run\.title\}/)
    expect(apiLayer()).toMatch(/Снимок названия обхода на момент запуска/)
    expect(apiLayer()).toMatch(/export type InspectionRunListSummary/)
  })

  it('keeps Russian status labels and server-side history filters', () => {
    expect(runsPage()).not.toMatch(/\{run\.status\}/)
    expect(runsPage()).not.toMatch(/\{run\.reportStatus\}/)
    expect(runsPage()).toMatch(/function runStatusLabel/)
    expect(runsPage()).toMatch(/function reportStatusLabel/)
    for (const label of ['В процессе', 'Завершён', 'Черновик', 'На проверке', 'Утверждён', 'Возвращён']) {
      expect(runsPage()).toContain(label)
    }
    for (const label of ['Объект', 'Исполнитель', 'Статус обхода', 'Статус акта', 'Начат с', 'Начат по']) {
      expect(runsPage()).toContain(label)
    }

    expect(apiLayer()).toMatch(/export type InspectionRunsFilter/)
    expect(apiLayer()).toMatch(/export async function getInspectionRuns\(filter: InspectionRunsFilter = \{\}\)/)
    expect(runsPage()).toMatch(/api\.getInspectionRuns\(filter\)/)
    expect(runsPage()).toMatch(/queryKey: \['inspection-runs', filter\]/)

    const block = apiLayer().slice(apiLayer().indexOf('export type InspectionRunsFilter'))
    const body = block.slice(0, block.indexOf('}'))
    const fields = [...body.matchAll(/^\s*(\w+)\?:/gm)].map((match) => match[1]).sort()
    expect(fields).toEqual(['from', 'limit', 'locationId', 'performedByUserId', 'reportStatus', 'status', 'templateId', 'to'])
  })

  it('keeps summary, duration and mobile review information without N+1 history calls', () => {
    expect(runsPage()).toMatch(/function durationLabel/)
    for (const label of ['Пунктов:', 'Норма:', 'Проблема:', 'Критично:', 'Заявок создано:', 'Длительность']) {
      expect(runsPage()).toContain(label)
    }
    expect(runsPage()).toMatch(/personLabel\(run\.performedBy\)/)

    for (const [name, source] of [
      ['desktop', runsPage()],
      ['mobile', mobileRun()],
    ] as const) {
      const at = source.indexOf('function durationLabel')
      const body = source.slice(at, source.indexOf('\n}', at))
      expect(body, `${name}: incomplete run must not have duration`).toMatch(/if \(!startedAt \|\| !completedAt\)/)
      expect(body, `${name}: invalid timestamp order must render dash`).toMatch(/to <= from/)
    }

    expect(mobileRun()).toMatch(/Статус акта/)
    expect(mobileRun()).toMatch(/function reviewStatusLabel/)
    expect(mobileRun()).toMatch(/run\.reportReviewedBy/)
    expect(mobileRun()).toMatch(/run\.reportReviewComment/)

    const reviewAt = mobileRun().indexOf('Статус акта')
    const reviewBlock = mobileRun().slice(reviewAt - 900, reviewAt + 1800)
    expect(reviewBlock).not.toContain('submitInspectionRunReport')
    expect(reviewBlock).not.toContain('reviewInspectionRunReport')

    expect(mobileList()).not.toContain('useQueries')
    expect(mobileList()).toMatch(/run\.summary\.issueCount \+ run\.summary\.criticalCount/)
    expect(mobileList()).toMatch(/run\.summary\.createdTicketsCount/)
    expect(mobileList()).toMatch(/locationId: objectLocationId/)
  })
})
