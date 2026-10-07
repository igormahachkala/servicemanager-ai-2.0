import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('round schedule assignee scope', () => {
  it('loads assignees from the location-scoped backend endpoint', () => {
    const page = read('src/views/InspectionSchedulesPage.tsx')
    const api = read('src/lib/api.ts')

    expect(page).toMatch(/getAssignableRoundTechnicians\(locationId\)/)
    expect(page).toMatch(/enabled:\s*canManage\s*&&\s*!!locationId/)
    expect(page).not.toMatch(/queryKey:\s*\['technicians'\]/)
    expect(api).toMatch(/inspection\/schedules\/assignable-technicians/)
  })

  it('clears a stale assignee when the selected location changes', () => {
    const page = read('src/views/InspectionSchedulesPage.tsx')

    expect(page).toMatch(/setLocationId\(e\.target\.value\);\s*setAssignedToUserId\(''\)/)
    expect(page).toMatch(/executors\.some\(\(candidate\) => candidate\.id === assignedToUserId\)/)
  })

  it('does not render an error as an empty successful candidate list', () => {
    const page = read('src/views/InspectionSchedulesPage.tsx')

    expect(page).toMatch(/candidatesQ\.isError/)
    expect(page).toMatch(/Не удалось получить список исполнителей/)
    expect(page).toMatch(/Для этой точки нет доступных исполнителей/)
  })
})
