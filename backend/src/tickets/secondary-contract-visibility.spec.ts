import { ServiceContractRole, UserRole } from '@prisma/client'

import {
  buildSecondaryOperationalTicketWhere,
  secondaryOperationalScopeAppliesTo,
} from './ticket-access.utils'

/**
 * SMA-SECONDARY-CONTRACT-VISIBILITY-004C.
 *
 * Операционный охват SECONDARY-подрядчика (назначение на исполнителя компании либо
 * привязка её пользователей к локации) — ограничение уровня исполнителя.
 * Управленческие роли ограничены контекстом договора и не должны зависеть от
 * операционных привязок.
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
      user: { findMany: jest.fn().mockResolvedValue([]) },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      userAccessScope: { findUnique: jest.fn().mockResolvedValue(null) },
      serviceContract: { findUnique: jest.fn().mockResolvedValue(null) },
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
    it('от операционного охвата освобождены только ADMIN, MASTER и DISPATCHER', () => {
      expect(secondaryOperationalScopeAppliesTo(UserRole.ADMIN)).toBe(false)
      expect(secondaryOperationalScopeAppliesTo(UserRole.MASTER)).toBe(false)
      expect(secondaryOperationalScopeAppliesTo(UserRole.DISPATCHER)).toBe(false)

      expect(secondaryOperationalScopeAppliesTo(UserRole.TECHNICIAN)).toBe(true)
    })

    it('обзорные роли подрядчика остаются под охватом — закрытая утечка не открывается', () => {
      // ticket-access.utils.spec: «SECONDARY management path … (leak closed)».
      expect(secondaryOperationalScopeAppliesTo(UserRole.NETWORK_DIRECTOR)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.TERRITORIAL_MANAGER)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.CLIENT)).toBe(true)
      expect(secondaryOperationalScopeAppliesTo(UserRole.STAFF)).toBe(true)
    })
  })

  describe('управленческие роли', () => {
    it.each([UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER])(
      '%s не ограничивается операционным охватом при пустых привязках',
      async (role) => {
        const where = await build(role)
        expect(where).toEqual({})
      },
    )

    it('управленческой роли не требуется читать исполнителей и привязки', async () => {
      const prisma = makeEmptyScopePrismaMock()
      await build(UserRole.ADMIN, prisma)
      expect(prisma.user.findMany).not.toHaveBeenCalled()
      expect(prisma.userLocationBinding.findMany).not.toHaveBeenCalled()
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
