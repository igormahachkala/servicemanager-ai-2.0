import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CompanyType, TicketStatus, UserRole, WorkShiftStatus } from '@prisma/client'

import { ROLES_KEY } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { WorkforceController } from './workforce.controller'
import {
  WorkforceTechnicianMapService,
  formatTechnicianMapSyncLabel,
} from './workforce-technician-map.service'

const AT = new Date('2026-10-30T01:05:00.000Z')

function prismaFor(input: {
  companyType?: CompanyType | null
  shifts?: unknown[]
  tickets?: unknown[]
}) {
  return {
    company: {
      findUnique: jest.fn(async () => (
        input.companyType == null ? null : { type: input.companyType, timezone: 'UTC' }
      )),
    },
    workShift: {
      findMany: jest.fn(async () => input.shifts ?? []),
    },
    ticket: {
      findMany: jest.fn(async () => input.tickets ?? []),
    },
  }
}

describe('formatTechnicianMapSyncLabel', () => {
  it('пишет месяц, день, часы и минуты без других слов', () => {
    expect(formatTechnicianMapSyncLabel(AT, 'UTC')).toBe('10.30 01:05')
    expect(formatTechnicianMapSyncLabel(AT, 'UTC')).not.toMatch(/синхрон|назад|UTC/i)
  })
})

describe('WorkforceTechnicianMapService', () => {
  const openTech = {
    userId: 'tech-open',
    lastLatitude: 55.75,
    lastLongitude: 37.61,
    lastGeoAt: AT,
    user: { id: 'tech-open', firstName: 'Иван', lastName: 'Петров', role: UserRole.TECHNICIAN },
  }
  const openWithoutPoint = {
    userId: 'tech-bare',
    lastLatitude: null,
    lastLongitude: null,
    lastGeoAt: null,
    user: { id: 'tech-bare', firstName: 'Олег', lastName: 'Безточки', role: UserRole.TECHNICIAN },
  }

  it('пускает мастера, диспетчера и админа провайдера', async () => {
    for (const role of [UserRole.MASTER, UserRole.DISPATCHER, UserRole.ADMIN]) {
      const prisma = prismaFor({ companyType: CompanyType.PROVIDER, shifts: [] })
      const service = new WorkforceTechnicianMapService(prisma as never)
      await expect(service.list({ id: 'actor', companyId: 'provider-1', role })).resolves.toEqual({
        people: [],
        tickets: [],
      })
    }
  })

  it('отказывает технику, администратору платформы и админу клиентской компании', async () => {
    for (const role of [UserRole.TECHNICIAN, UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN]) {
      const prisma = prismaFor({ companyType: CompanyType.PROVIDER })
      const service = new WorkforceTechnicianMapService(prisma as never)
      await expect(service.list({ id: 'actor', companyId: 'provider-1', role })).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.workShift.findMany).not.toHaveBeenCalled()
    }

    const clientAdmin = prismaFor({ companyType: CompanyType.CLIENT })
    const service = new WorkforceTechnicianMapService(clientAdmin as never)
    await expect(service.list({
      id: 'actor',
      companyId: 'client-1',
      role: UserRole.ADMIN,
    })).rejects.toBeInstanceOf(ForbiddenException)
    expect(clientAdmin.workShift.findMany).not.toHaveBeenCalled()
  })

  it('берёт техника с открытой сменой без заявки и не берёт закрытую смену и чужую компанию', async () => {
    const prisma = prismaFor({
      companyType: CompanyType.PROVIDER,
      shifts: [openTech, openWithoutPoint],
      tickets: [],
    })
    const service = new WorkforceTechnicianMapService(prisma as never)
    const result = await service.list({ id: 'master', companyId: 'provider-1', role: UserRole.MASTER })

    expect(prisma.workShift.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        companyId: 'provider-1',
        status: WorkShiftStatus.OPEN,
        user: { role: UserRole.TECHNICIAN },
      },
    }))
    expect(result.people).toEqual([
      {
        id: 'tech-bare',
        firstName: 'Олег',
        lastName: 'Безточки',
        latitude: null,
        longitude: null,
        syncedAtLabel: '',
      },
      {
        id: 'tech-open',
        firstName: 'Иван',
        lastName: 'Петров',
        latitude: 55.75,
        longitude: 37.61,
        syncedAtLabel: '10.30 01:05',
      },
    ])
    expect(result.tickets).toEqual([])
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        assignedTechnicianId: { in: ['tech-bare', 'tech-open'] },
        status: { in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
      },
    }))
  })

  it('кладёт в заявку номер, текст проблемы и исполнителя из ответа', async () => {
    const prisma = prismaFor({
      companyType: CompanyType.PROVIDER,
      shifts: [openTech],
      tickets: [{
        id: 'ticket-1',
        ticketNumber: 1043,
        problemText: 'Течёт кран',
        assignedTechnicianId: 'tech-open',
      }],
    })
    const service = new WorkforceTechnicianMapService(prisma as never)
    const result = await service.list({ id: 'master', companyId: 'provider-1', role: UserRole.MASTER })
    expect(result.tickets).toEqual([{
      id: 'ticket-1',
      ticketNumber: 1043,
      title: 'Течёт кран',
      technicianId: 'tech-open',
    }])
  })
})

describe('GET /workforce/technician-map roles', () => {
  const reflector = new Reflector()
  const guard = new RolesGuard(reflector)
  const handler = Object.getOwnPropertyDescriptor(WorkforceController.prototype, 'technicianMapList')?.value

  it('разрешает только ADMIN, MASTER и DISPATCHER', () => {
    expect(reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [handler, WorkforceController])).toEqual([
      UserRole.ADMIN,
      UserRole.MASTER,
      UserRole.DISPATCHER,
    ])
    const allow = new Set([UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER])
    for (const role of Object.values(UserRole)) {
      const context = {
        getHandler: () => handler,
        getClass: () => WorkforceController,
        switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', role, companyId: 'c' } }) }),
      }
      expect(guard.canActivate(context as never)).toBe(allow.has(role))
    }
  })
})
