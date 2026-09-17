import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('ticket planned due/category invariants', () => {
  const schema = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf8')
  const controller = readFileSync(resolve(__dirname, 'tickets.controller.ts'), 'utf8')
  const createDto = readFileSync(resolve(__dirname, 'dto/create-ticket.dto.ts'), 'utf8')
  const updateDto = readFileSync(resolve(__dirname, 'dto/update-ticket.dto.ts'), 'utf8')

  it('keeps category required and adds only a nullable planned due field', () => {
    expect(schema).toContain('problemCategoryId String')
    expect(schema).not.toContain('problemCategoryId String?')
    expect(schema).toContain('plannedDueAt  DateTime?')
    expect(schema).toContain('@@index([companyId, plannedDueAt])')
  })

  it('does not expose SLA due date through planned deadline DTOs', () => {
    expect(createDto).toContain('plannedDueAt?: string | null')
    expect(updateDto).toContain('plannedDueAt?: string | null')
    expect(createDto).not.toContain('slaDueAt')
    expect(updateDto).not.toContain('slaDueAt')
  })

  it('does not add TECHNICIAN to the canonical ticket edit route', () => {
    const updateRoute = controller.slice(controller.indexOf("@Patch(':id')"), controller.indexOf('update(', controller.indexOf("@Patch(':id')")))
    expect(updateRoute).toContain('PERMISSIONS.TICKETS_EDIT')
    expect(updateRoute).toContain('UserRole.MASTER')
    expect(updateRoute).toContain('UserRole.DISPATCHER')
    expect(updateRoute).not.toContain('UserRole.TECHNICIAN')
  })
})
