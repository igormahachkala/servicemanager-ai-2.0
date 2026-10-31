import { RequestMethod } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { ManagementSurfaceGuard } from '../common/management-surface-access'
import { PERMISSIONS } from '../common/permissions.constants'
import { PERMISSIONS_KEY } from '../common/permissions.decorator'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { ROLES_KEY } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { EditNotStartedScheduleDto } from './dto/edit-not-started-schedule.dto'
import { InspectionController } from './inspection.controller'

const action = InspectionController.prototype.editNotStartedSchedule

describe('guarded schedule editor route', () => {
  it('has a separate PATCH path; legacy PATCH stays separate', () => {
    expect(Reflect.getMetadata(PATH_METADATA, action)).toBe('schedules/:id/not-started')
    expect(Reflect.getMetadata(METHOD_METADATA, action)).toBe(RequestMethod.PATCH)
    expect(Reflect.getMetadata(PATH_METADATA, InspectionController.prototype.updateSchedule)).toBe('schedules/:id')
  })

  it('uses the existing authenticated management-surface and permission gates', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, InspectionController)).toEqual([
      JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard,
    ])
    expect(Reflect.getMetadata(GUARDS_METADATA, action)).toContain(ManagementSurfaceGuard)
    expect(Reflect.getMetadata(PERMISSIONS_KEY, action)).toEqual([PERMISSIONS.LOCATIONS_MANAGE])
    expect(Reflect.getMetadata(ROLES_KEY, action)).toEqual(
      Reflect.getMetadata(ROLES_KEY, InspectionController.prototype.updateSchedule),
    )
    expect(Reflect.getMetadata(ROLES_KEY, action)).not.toContain(UserRole.TECHNICIAN)
  })

  it('uses the editor DTO and dispatches only to the safe action', async () => {
    const schedules = { editNotStarted: jest.fn().mockResolvedValue({ id: 'schedule-1' }), update: jest.fn() }
    const controller = new InspectionController({} as never, schedules as never)
    const user = { id: 'admin-1', companyId: 'company-1', role: UserRole.ADMIN }
    const dto = new EditNotStartedScheduleDto()
    await expect(controller.editNotStartedSchedule({ user }, 'schedule-1', dto)).resolves.toEqual({ id: 'schedule-1' })
    expect(schedules.editNotStarted).toHaveBeenCalledWith(user, 'schedule-1', dto)
    expect(schedules.update).not.toHaveBeenCalled()
    expect(Reflect.getMetadata('design:paramtypes', InspectionController.prototype, 'editNotStartedSchedule'))
      .toContain(EditNotStartedScheduleDto)
  })
})
