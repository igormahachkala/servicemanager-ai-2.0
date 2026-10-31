import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { ManagementSurfaceGuard } from '../common/management-surface-access';
import { PERMISSIONS } from '../common/permissions.constants';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import { ROLES_KEY } from '../common/roles.decorator';
import { InspectionController } from './inspection.controller';
import { RescheduleNextOccurrenceDto } from './dto/reschedule-next-occurrence.dto';

const action = InspectionController.prototype.rescheduleNextOccurrence;

describe('bounded next-occurrence route', () => {
  it('uses its own PATCH with the existing authenticated controller/management gates', () => {
    expect(Reflect.getMetadata(PATH_METADATA, action)).toBe(
      'schedules/:id/next-occurrence',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, action)).toBe(
      RequestMethod.PATCH,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, action)).toContain(
      ManagementSurfaceGuard,
    );
    expect(Reflect.getMetadata(PERMISSIONS_KEY, action)).toEqual([
      PERMISSIONS.LOCATIONS_MANAGE,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, action)).toEqual(
      Reflect.getMetadata(
        ROLES_KEY,
        InspectionController.prototype.editNotStartedSchedule,
      ),
    );
    expect(Reflect.getMetadata(ROLES_KEY, action)).not.toContain(
      UserRole.TECHNICIAN,
    );
  });
  it('dispatches only to the safe action with its narrow DTO, not the old editor/legacy PATCH', async () => {
    const schedules = {
      rescheduleNextOccurrence: jest
        .fn()
        .mockResolvedValue({ id: 'schedule-1' }),
      update: jest.fn(),
      editNotStarted: jest.fn(),
    };
    const controller = new InspectionController(
      {} as never,
      schedules as never,
    );
    const user = {
      id: 'manager-1',
      companyId: 'company-1',
      role: UserRole.ADMIN,
    };
    const dto = new RescheduleNextOccurrenceDto();
    await expect(
      controller.rescheduleNextOccurrence({ user }, 'schedule-1', dto),
    ).resolves.toEqual({ id: 'schedule-1' });
    expect(schedules.rescheduleNextOccurrence).toHaveBeenCalledWith(
      user,
      'schedule-1',
      dto,
    );
    expect(schedules.update).not.toHaveBeenCalled();
    expect(schedules.editNotStarted).not.toHaveBeenCalled();
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        InspectionController.prototype,
        'rescheduleNextOccurrence',
      ),
    ).toContain(RescheduleNextOccurrenceDto);
  });
});
