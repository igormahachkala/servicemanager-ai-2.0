import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
}

describe('Materials V0 integrated surfaces', () => {
  const router = source('../router.tsx')
  const api = source('../lib/api.ts')
  const management = source('./MaterialsPage.tsx')
  const mobile = source('../mobile/MobileMaterialsPage.tsx')
  const mobileSettings = source('../mobile/MobileSettingsPage.tsx')
  const ticketDesktop = source('./TicketPage.tsx')
  const ticketMobile = source('../mobile/MobileTicketPage.tsx')
  const ticketPanel = source('../components/tickets/TicketMaterialsPanel.tsx')
  const employees = source('./EmployeesPage.tsx')

  it('has one desktop route and the mobile technician route', () => {
    expect(router.match(/path="materials"/g)).toHaveLength(2)
    expect(router).toContain("import('./views/MaterialsPage')")
    expect(router).toContain("import('./mobile/MobileMaterialsPage')")
  })

  it('keeps one canonical direct-array API seam', () => {
    expect(api.match(/export const MATERIALS_API =/g)).toHaveLength(1)
    expect(api).toContain('request<Material[]>')
    expect(api).toContain('request<MaterialBalance[]>')
    expect(api).toContain('request<MaterialMovement[]>')
    expect(api).not.toContain('MATERIALS_API_PATHS')
    expect(api).not.toContain('MATERIALS_API_ENDPOINTS')
  })

  it('supports catalog create/edit/active and a minimal stock receipt', () => {
    expect(management).toContain('api.createMaterial')
    expect(management).toContain('api.updateMaterial')
    expect(management).toContain('active: !material.active')
    expect(management).toContain('api.recordCompanyStockReceipt')
    expect(management).not.toContain('materialCompanyStock')
  })

  it('keeps mobile self-purchase without receipt photo UI', () => {
    expect(mobile).toContain('api.recordMaterialSelfPurchase')
    expect(mobile).toContain('api.myMaterialBalances')
    expect(mobile).toContain('api.myMaterialMovements')
    expect(mobile).not.toContain('type="file"')
  })

  it('provides /m-only navigation entries (primary Home card + secondary Settings) via one shared visibility helper', () => {
    const home = source('../mobile/home/MobileHome.tsx')
    const visibility = source('../mobile/materialsEntryVisibility.ts')
    // Единый источник видимости — та же логика в обоих входах.
    expect(visibility).toContain('export function canSeeMobileMaterialsEntry')
    expect(visibility).toContain("params.canAccessManagementSurface === true && params.role !== 'PLATFORM_ADMIN'")
    expect(visibility).toContain("params.routeRoot !== '/m'")
    // Заметный первичный вход на Главной — карточка в стиле быстрых карт.
    expect(home).toContain('canSeeMobileMaterialsEntry')
    expect(home).toContain('HomeMaterialsCard')
    expect(home).toContain("mobilePath(location.pathname, '/materials')")
    // Вторичный вход в Настройках сохранён и переиспользует тот же helper.
    expect(mobileSettings).toContain('canSeeMobileMaterialsEntry')
    expect(mobileSettings).toContain("to: scoped('/m/materials')")
    expect(mobileSettings).not.toContain('/max/materials')
    expect(home).not.toContain('/max/materials')
  })

  it('supports the mobile management workflow through canonical APIs', () => {
    expect(mobile).toContain('api.createMaterial')
    expect(mobile).toContain('api.updateMaterial')
    expect(mobile).toContain('api.recordCompanyStockReceipt')
    expect(mobile).toContain('api.technicianMaterialBalances')
    expect(mobile).toContain('api.technicianMaterialMovements')
    expect(mobile).toContain('api.issueMaterialToTechnician')
    expect(mobile).toContain("canAccessManagementSurface === true && meQ.data.role !== 'PLATFORM_ADMIN'")
    expect(mobile).not.toContain('materialCompanyStock')
    expect(mobile).not.toContain('setMaterialStatus')
  })

  it('uses the exact backend paths and direct array contracts', () => {
    expect(api).toContain("myBalances: '/materials/me/balances'")
    expect(api).toContain("myMovements: '/materials/me/movements'")
    expect(api).toContain("purchases: '/materials/me/purchases'")
    expect(api).toContain("issues: '/materials/issues'")
    expect(api).toContain("stockReceipts: '/materials/stock/receipts'")
    expect(api).toContain('request<Material[]>')
    expect(api).toContain('request<MaterialBalance[]>')
    expect(api).toContain('request<MaterialMovement[]>')
  })

  it('reuses one ticket materials panel on desktop and mobile', () => {
    expect(ticketDesktop).toContain("components/tickets/TicketMaterialsPanel")
    expect(ticketMobile).toContain("components/tickets/TicketMaterialsPanel")
    expect(ticketPanel).toContain('api.ticketMaterialConsumptions')
    expect(ticketPanel).toContain('api.consumeTicketMaterial')
  })

  it('adds management technician balances/history/issue through the canonical component', () => {
    expect(employees).toContain('TechnicianMaterials')
    expect(employees).not.toContain('EmployeeTechnicianMaterialsSection')
  })
})
