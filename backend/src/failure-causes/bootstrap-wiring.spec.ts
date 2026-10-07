import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const here = __dirname
const companyService = readFileSync(resolve(here, '../company/company.service.ts'), 'utf8')
const authService = readFileSync(resolve(here, '../auth/auth.service.ts'), 'utf8')

describe('failure-cause default dictionary — company bootstrap wiring', () => {
  it('platform company creation seeds defaults gated on CompanyType.CLIENT', () => {
    expect(companyService).toContain(
      "import { ensureDefaultFailureCauses } from '../failure-causes/standard-failure-causes'",
    )
    expect(companyService).toContain('if (company.type === CompanyType.CLIENT) {')
    expect(companyService).toContain('await ensureDefaultFailureCauses(this.prisma, company.id)')
  })

  it('self-registration (always CLIENT) seeds defaults exactly once', () => {
    expect(authService).toContain(
      "import { ensureDefaultFailureCauses } from '../failure-causes/standard-failure-causes'",
    )
    const calls = authService.match(/ensureDefaultFailureCauses\(this\.prisma, company\.id\)/g) ?? []
    expect(calls).toHaveLength(1)
  })

  it('does not attach the dictionary to the PROVIDER demo-bootstrap company', () => {
    const callIdx = authService.indexOf('ensureDefaultFailureCauses(this.prisma, company.id)')
    const providerDemoIdx = authService.indexOf('type: CompanyType.PROVIDER')
    expect(callIdx).toBeGreaterThan(-1)
    expect(providerDemoIdx).toBeGreaterThan(-1)
    // Единственный вызов стоит в CLIENT-регистрации, ДО PROVIDER demo-bootstrap.
    expect(callIdx).toBeLessThan(providerDemoIdx)
  })
})
