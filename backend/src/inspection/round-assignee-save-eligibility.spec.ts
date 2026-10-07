import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { InspectionScheduleService } from './inspection-schedule.service';

const providerId = 'provider-1';
const clientId = 'client-1';
const technicianId = 'tech-1';
const admin = { id: 'admin-1', companyId: providerId, role: UserRole.ADMIN } as any;
const locationA = { id: 'location-a', clientCompanyId: clientId };
const locationB = { id: 'location-b', clientCompanyId: clientId };

function makeSuite(options: {
  existingCompanyId?: string;
  eligibleByLocation?: Record<string, string[]>;
  assignedToUserId?: string | null;
} = {}) {
  const prisma = {
    user: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.id === technicianId && where.companyId === (options.existingCompanyId ?? providerId)
          ? { id: technicianId }
          : null,
      ),
    },
    inspectionTemplate: {
      findFirst: jest.fn(async () => ({ id: 'template-1', name: 'Обход' })),
    },
    location: {
      findFirst: jest.fn(async ({ where }: any) =>
        [locationA, locationB].find((location) => location.id === where.id) ?? null,
      ),
    },
    equipment: { findFirst: jest.fn(async () => null) },
    inspectionSchedule: {
      findFirst: jest.fn(async () => ({
        id: 'schedule-1',
        frequency: 'ONCE',
        intervalDays: null,
        lastGeneratedAt: null,
        assignedToUserId: options.assignedToUserId ?? null,
        location: locationA,
        _count: { runs: 0 },
      })),
      create: jest.fn(async ({ data }: any) => ({ id: 'schedule-1', ...data, runs: [] })),
      update: jest.fn(async ({ data }: any) => ({ id: 'schedule-1', ...data, runs: [] })),
    },
  } as any;
  const contracts = {
    getLinkedClientAccess: jest.fn(async () => ({ locationMode: 'ALL_LOCATIONS', locations: [] })),
  } as any;
  const assignment = {
    listLocationAssignableExecutors: jest.fn(async ({ locationId }: any) =>
      (options.eligibleByLocation?.[locationId] ?? [technicianId]).map((id) => ({
        id,
        email: `${id}@example.test`,
        firstName: null,
        lastName: null,
        role: UserRole.TECHNICIAN,
        activeLoad: 0,
      })),
    ),
  };
  const service: any = new InspectionScheduleService(prisma, contracts, assignment as any);
  service.requireAccessibleLocation = async (_user: any, locationId: string) =>
    [locationA, locationB].find((location) => location.id === locationId) ?? null;
  return { service, prisma, assignment };
}

function createDto(assignedToUserId?: string) {
  return {
    templateId: 'template-1',
    locationId: locationA.id,
    frequency: 'ONCE',
    startDate: '2026-10-06T09:00:00.000Z',
    assignedToUserId,
  } as any;
}

describe('round schedule assignee scope', () => {
  it('rejects an own-company executor outside the selected location scope before write', async () => {
    const { service, prisma } = makeSuite({ eligibleByLocation: { [locationA.id]: [] } });

    await expect(service.create(admin, createDto(technicianId))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inspectionSchedule.create).not.toHaveBeenCalled();
  });

  it('rejects a foreign-company assignee before consulting eligibility', async () => {
    const { service, assignment } = makeSuite({ existingCompanyId: 'provider-2' });

    await expect(service.create(admin, createDto(technicianId))).rejects.toBeInstanceOf(NotFoundException);
    expect(assignment.listLocationAssignableExecutors).not.toHaveBeenCalled();
  });

  it('accepts an eligible executor on create', async () => {
    const { service, prisma } = makeSuite();

    await service.create(admin, createDto(technicianId));
    expect(prisma.inspectionSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToUserId: technicianId }) }),
    );
  });

  it('validates an explicit assignee against the new location', async () => {
    const { service, prisma, assignment } = makeSuite({
      eligibleByLocation: { [locationA.id]: [technicianId], [locationB.id]: [] },
    });

    await expect(
      service.update(admin, 'schedule-1', { locationId: locationB.id, assignedToUserId: technicianId } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(assignment.listLocationAssignableExecutors).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: locationB.id, scopeCompanyId: clientId }),
    );
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled();
  });

  it('revalidates the retained assignee when only location changes', async () => {
    const { service } = makeSuite({
      assignedToUserId: technicianId,
      eligibleByLocation: { [locationB.id]: [] },
    });

    await expect(
      service.update(admin, 'schedule-1', { locationId: locationB.id } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps explicit unassignment available without an eligibility lookup', async () => {
    const { service, assignment, prisma } = makeSuite({ assignedToUserId: technicianId });

    await service.update(admin, 'schedule-1', { assignedToUserId: null } as any);
    expect(assignment.listLocationAssignableExecutors).not.toHaveBeenCalled();
    expect(prisma.inspectionSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedTo: { disconnect: true } }) }),
    );
  });

  it('delegates eligibility instead of duplicating contract or location rules', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, 'inspection-schedule.service.ts'),
      'utf8',
    ) as string;
    const block = source.slice(source.indexOf('private async resolveAssigneeId'), source.indexOf('private parseStartDate'));

    expect(block).toContain('this.assignmentEligibility.listLocationAssignableExecutors');
    expect(block).not.toContain('serviceContract');
    expect(block).not.toContain('userLocationBinding');
    expect(block).not.toContain('technicianSpecialization');
  });
});
