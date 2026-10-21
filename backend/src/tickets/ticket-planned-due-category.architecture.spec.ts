import { readFileSync } from 'fs'
import { resolve } from 'path'

import { UserRole } from '@prisma/client'

import { ROLE_GRANTS } from '../common/permissions-matrix'
import { PERMISSIONS } from '../common/permissions.constants'

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

  /*
   * SMA-OVERNIGHT-TICKET-UX-RECONCILIATION-122B, пробел приёмки 2.
   *
   * У роли CLIENT код TICKETS_EDIT в матрице прав есть и был до этой задачи —
   * от правки её удерживает не право, а список ролей канонического маршрута
   * (SMA-ACCEPTANCE-ROLE-GAP-001). Поэтому проверять здесь надо именно список,
   * а не матрицу: срок выполнения принимает тот же PATCH, и стоит добавить
   * туда CLIENT «чтобы заявитель мог поправить срок» — как обычный заявитель
   * получит право менять все поля заявки после создания.
   */
  it('does not add CLIENT to the canonical ticket edit route', () => {
    const updateRoute = controller.slice(
      controller.indexOf("@Patch(':id')"),
      controller.indexOf('update(', controller.indexOf("@Patch(':id')")),
    )
    expect(updateRoute).not.toContain('UserRole.CLIENT')
    expect(updateRoute).toContain('PERMISSIONS.TICKETS_EDIT')
  })

  it('keeps exactly one route accepting the planned deadline for edit', () => {
    // Второй маршрут с тем же DTO означал бы второй набор ролей — и обход
    // ограничения выше. Проверяется и то, что найденный маршрут — тот самый.
    const bindings = controller.match(/@Body\(\) dto: UpdateTicketDto/g) || []
    expect(bindings).toHaveLength(1)
    expect(updateDto).toContain('plannedDueAt?: string | null')
    const bindingAt = controller.indexOf('@Body() dto: UpdateTicketDto')
    const patchAt = controller.indexOf("@Patch(':id')")
    expect(patchAt).toBeGreaterThan(-1)
    expect(bindingAt).toBeGreaterThan(patchAt)
    expect(controller.indexOf("@Patch(':id')", patchAt + 1)).toBe(-1)
  })

  it('does not widen the CLIENT permission set for this feature', () => {
    // Матрица не меняется: правка снимается ролями маршрута, а не правами.
    // Если бы у CLIENT появилось новое право на заявки, это был бы второй
    // способ решать тот же вопрос — ровно то, чего задача не допускает.
    const clientGrant = ROLE_GRANTS.find((grant) => grant.role === UserRole.CLIENT)
    expect(clientGrant).toBeDefined()
    expect(clientGrant!.codes).toEqual([
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_EDIT,
      PERMISSIONS.LOCATIONS_VIEW,
    ])
  })

  it('does not add TECHNICIAN to the canonical ticket edit route', () => {
    const updateRoute = controller.slice(controller.indexOf("@Patch(':id')"), controller.indexOf('update(', controller.indexOf("@Patch(':id')")))
    expect(updateRoute).toContain('PERMISSIONS.TICKETS_EDIT')
    expect(updateRoute).toContain('UserRole.MASTER')
    expect(updateRoute).toContain('UserRole.DISPATCHER')
    expect(updateRoute).not.toContain('UserRole.TECHNICIAN')
  })
})
