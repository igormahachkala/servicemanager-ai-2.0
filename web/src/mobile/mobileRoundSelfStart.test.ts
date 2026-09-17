import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('mobile round self-start source contract', () => {
  const list = () => read('src/mobile/MobileInspectionList.tsx')
  const start = () => read('src/mobile/MobileInspectionStartPage.tsx')
  const router = () => read('src/router.tsx')
  const backend = () => read('../backend/src/inspection/inspection.service.ts')

  it('exposes the mobile start route and keeps the flow online-only', () => {
    expect(list()).toMatch(/Начать обход/)
    expect(list()).toMatch(/inspection\/start/)
    expect((router().match(/path="inspection\/start"/g) || []).length).toBe(2)

    expect(start()).toMatch(/api\.getInspectionTemplates/)
    expect(start()).toMatch(/api\.getTechnicianBoundContexts/)
    expect(start()).toMatch(/api\.getLinkedClients/)
    expect(start()).toMatch(/api\.locations\(clientCompanyId \|\| undefined\)/)
    expect(start()).toMatch(/api\.startInspectionRun/)
    expect(start()).toMatch(/useOfflineStatus/)
    expect(start()).toMatch(/!offline\.online/)
    expect(start()).toMatch(/Начать новый обход можно только онлайн/)
  })

  it('keeps the guided type-client-location-preview path without frontend scope rules', () => {
    expect(start()).toMatch(/templates\.length === 1/)
    expect(start()).toMatch(/activeLocations\.length === 1/)
    expect(start()).toMatch(/clientOptions\.length > 1/)
    expect(start()).toMatch(/clientOptions\.length === 1/)
    expect(start()).toMatch(/Нет доступных типов обхода/)
    expect(start()).toMatch(/Нет доступных локаций/)
    expect(start()).toMatch(/Что будет проверено/)
    expect(start()).toMatch(/mobilePath\(location\.pathname, `\/inspection\/\$\{run\.id\}`\)/)
    expect(start()).not.toMatch(/ServiceContract|SELECTED_LOCATIONS|ALL_LOCATIONS|locationMode/)
  })

  it('keeps backend access as the source of truth for self-start', () => {
    expect(backend()).toMatch(/assertInspectionLocationAccess/)
    expect(backend()).toMatch(/assertActorCanUseLocation/)
    expect(backend()).toMatch(/where: \{ id: dto\.templateId, companyId: user\.companyId, isActive: true \}/)
  })
})
