import { ServiceContractRole, UserRole } from '@prisma/client'

import {
  buildSecondaryOperationalTicketWhere,
  secondaryOperationalScopeAppliesTo,
} from './ticket-access.utils'

/**
 * SMA-SECONDARY-CONTRACT-VISIBILITY-004C.
 *
 * Операционный охват SECONDARY-подрядчика (назначение на исполнителя компании либо
 * привязка её пользователей к локации) — часть relationship scope. ALL_LOCATIONS
 * не превращает SECONDARY-договор в полный клиентский board.
 */
describe('SECONDARY provider operational scope by role', () => {
  const PROVIDER = 'secondary-provider'
  const CLIENT = 'client-co'

  function makeContractsMock(role: ServiceContractRole = ServiceContractRole.SECONDARY) {
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue({ role, allowed: true }),
    } as any
  }

  /** Ни одного исполнителя и ни одной привязки — операционный охват пуст. */
  function makeEmptyScopePrismaMock() {
    return {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'actor-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      userAccessScope: { findUnique: jest.fn().mockResolvedValue(null) },
      serviceContract: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'contract-1',
          status: 'ACTIVE',
          role: ServiceContractRole.SECONDARY,
          startsAt: null,
          endsAt: null,
          locationMode: 'ALL_LOCATIONS',
          locations: [],
        }),
      },
    } as any
  }

  function build(role: UserRole, prisma: any = makeEmptyScopePrismaMock()) {
    return buildSecondaryOperationalTicketWhere({
      prisma,
      serviceContractsService: makeContractsMock(),
      providerCompanyId: PROVIDER,
      linkedClientCompanyId: CLIENT,
      actor: { id: 'actor-1', role, companyId: PROVIDER },
    })
  }

  describe('предикат применимости', () => {
    it('операционный relationship scope применяется ко всем SECONDARY ролям', () => {
      expect(secondaryOperationalScopeAppliesTo(UserRole.ADMIN)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.MASTER)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.DISPATCHER)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.TECHNICIAN)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.NETWORK_DIRECTOR)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.TERRITORIAL_MANAGER)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.CLIENT)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.STAFF)).toBe(true)
    })
  })

  describe('управленческие роли', () => {
    it.each([UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER])(
      '%s без исполнителей и привязок получает запрет-заглушку',
      async (role) => {
        const where = await build(role)
        expect(where).not.toEqual({})
        expect(JSON.stringify(where)).toContain('__no_access__')
      },
    )

    it('управленческая роль строит relationship scope по исполнителям и привязкам', async () => {
      const prisma = makeEmptyScopePrismaMock()
      await build(UserRole.ADMIN, prisma)
      expect(prisma.user.findMany).toHaveBeenCalled()
      expect(prisma.userLocationBinding.findMany).toHaveBeenCalled()
    })
  })

  describe('исполнительская роль', () => {
    it('TECHNICIAN без исполнителей и привязок получает запрет-заглушку', async () => {
      const where = await build(UserRole.TECHNICIAN)
      expect(where).not.toEqual({})
    })

    it('TECHNICIAN ограничен назначением и привязанными локациями', async () => {
      const prisma = makeEmptyScopePrismaMock()
      // Действующий договор со всеми локациями — чтобы охват актора не обнулился
      // раньше, чем дойдёт до операционных ограничений.
      prisma.serviceContract.findUnique = jest.fn().mockResolvedValue({
        id: 'contract-1',
        status: 'ACTIVE',
        role: ServiceContractRole.SECONDARY,
        startsAt: null,
        endsAt: null,
        locationMode: 'ALL_LOCATIONS',
        locations: [],
      })
      prisma.user.findMany = jest.fn().mockResolvedValue([{ id: 'tech-1' }])
      prisma.userLocationBinding.findMany = jest
        .fn()
        .mockResolvedValue([{ locationId: 'loc-1' }])

      const where: any = await build(UserRole.TECHNICIAN, prisma)

      // Для исполнителя охват вычисляется: читаются исполнители компании и привязки,
      // и результат ограничивает выборку, а не пропускает её.
      expect(prisma.user.findMany).toHaveBeenCalled()
      expect(prisma.userLocationBinding.findMany).toHaveBeenCalled()
      expect(where).not.toEqual({})
      expect(JSON.stringify(where)).toContain('tech-1')
    })
  })

  describe('изоляция сохраняется', () => {
    it('для не-SECONDARY договора ограничение не строится ни для какой роли', async () => {
      const where = await buildSecondaryOperationalTicketWhere({
        prisma: makeEmptyScopePrismaMock(),
        serviceContractsService: makeContractsMock(ServiceContractRole.PRIMARY),
        providerCompanyId: PROVIDER,
        linkedClientCompanyId: CLIENT,
        actor: { id: 'actor-1', role: UserRole.TECHNICIAN, companyId: PROVIDER },
      })
      expect(where).toBeNull()
    })

    it('без действующего договора ограничение не строится', async () => {
      const contracts = { getLinkedClientAccess: jest.fn().mockResolvedValue(null) } as any
      const where = await buildSecondaryOperationalTicketWhere({
        prisma: makeEmptyScopePrismaMock(),
        serviceContractsService: contracts,
        providerCompanyId: PROVIDER,
        linkedClientCompanyId: CLIENT,
        actor: { id: 'actor-1', role: UserRole.ADMIN, companyId: PROVIDER },
      })
      expect(where).toBeNull()
    })
  })
})
