import { ServiceContractStatus } from '@prisma/client'

import { activeServiceContractWhere, isServiceContractEffective } from './service-contract-window'

describe('service contract effective window', () => {
  const now = new Date('2026-08-05T10:00:00.000Z')

  it('keeps both exact date boundaries inclusive', () => {
    expect(
      isServiceContractEffective(
        { status: ServiceContractStatus.ACTIVE, startsAt: now, endsAt: now },
        now,
      ),
    ).toBe(true)
  })

  it('rejects contracts outside the effective date window', () => {
    expect(
      isServiceContractEffective(
        { status: ServiceContractStatus.ACTIVE, startsAt: new Date(now.getTime() + 1), endsAt: null },
        now,
      ),
    ).toBe(false)
    expect(
      isServiceContractEffective(
        { status: ServiceContractStatus.ACTIVE, startsAt: null, endsAt: new Date(now.getTime() - 1) },
        now,
      ),
    ).toBe(false)
  })

  it('builds the canonical database filter with the same inclusive boundaries', () => {
    expect(activeServiceContractWhere(now)).toEqual({
      status: ServiceContractStatus.ACTIVE,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    })
  })
})
