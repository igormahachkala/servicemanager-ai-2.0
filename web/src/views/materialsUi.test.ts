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

  it('provides one /m-only navigation entry for technicians and management', () => {
    expect(mobileSettings).toContain("getMobileRouteRoot(location.pathname) === '/m'")
    expect(mobileSettings).toContain("to: scoped('/m/materials')")
    expect(mobileSettings).not.toContain('/max/materials')
  })

  it('Settings materials visibility uses the shared canUseManagementMaterials predicate (CLIENT_ADMIN excluded)', () => {
    // Settings — тот же canonical-предикат, что Home/«Ещё»/страница.
    expect(mobileSettings).toContain('canUseManagementMaterials(meQ.data)')
    // Регрессионный барьер: возврат старого loose-механизма ловится здесь.
    // (canAccessManagementSurface === true → true для CLIENT_ADMIN → мёртвый вход).
    expect(mobileSettings).not.toMatch(/canAccessManagementSurface === true && role !== 'PLATFORM_ADMIN'/)
    expect(mobileSettings).not.toMatch(/canAccessManagementSurface === true && meQ\.data[.?]*role !== 'PLATFORM_ADMIN'/)
    // техник сохраняет «Мои материалы»
    expect(mobileSettings).toContain("role === 'TECHNICIAN' ? 'Мои материалы' : 'Материалы'")
  })

  it('supports the mobile management workflow through canonical APIs', () => {
    expect(mobile).toContain('api.createMaterial')
    expect(mobile).toContain('api.updateMaterial')
    expect(mobile).toContain('api.recordCompanyStockReceipt')
    expect(mobile).toContain('api.technicianMaterialBalances')
    expect(mobile).toContain('api.technicianMaterialMovements')
    expect(mobile).toContain('api.issueMaterialToTechnician')
    /*
     * Управленческий признак теперь один на вход и на страницу
     * (canUseManagementMaterials): прежняя широкая проверка пускала в
     * разделы CLIENT_ADMIN, которому бэкенд отказывает на каждой ручке.
     */
    expect(mobile).toContain('canUseManagementMaterials(meQ.data)')
    expect(mobile).not.toContain("canAccessManagementSurface === true && meQ.data.role !== 'PLATFORM_ADMIN'")
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
