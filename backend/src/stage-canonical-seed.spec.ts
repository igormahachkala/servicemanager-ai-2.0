import { ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import {
  CANONICAL_STAGE_SEED,
  validateCanonicalStageSeedPlan,
} from '../scripts/seed-stage-qa'

describe('canonical Stage acceptance seed plan', () => {
  it('is internally consistent and covers required ticket states', () => {
    expect(() => validateCanonicalStageSeedPlan()).not.toThrow()

    const statuses = Array.from(new Set(CANONICAL_STAGE_SEED.tickets.map((ticket) => ticket.status)))
    expect(statuses).toEqual(
      expect.arrayContaining([
        TicketStatus.NEW,
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_ACCEPTANCE,
        TicketStatus.DONE,
      ]),
    )
  })

  it('defines the canonical Stage account matrix', () => {
    expect(CANONICAL_STAGE_SEED.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'stage.client.admin@stage.local', role: UserRole.ADMIN }),
        expect.objectContaining({ email: 'stage.network.director@stage.local', role: UserRole.NETWORK_DIRECTOR }),
        expect.objectContaining({ email: 'stage.territorial.manager@stage.local', role: UserRole.TERRITORIAL_MANAGER }),
        expect.objectContaining({ email: 'stage.primary.admin@stage.local', role: UserRole.ADMIN }),
        expect.objectContaining({ email: 'stage.primary.dispatcher@stage.local', role: UserRole.DISPATCHER }),
        expect.objectContaining({ email: 'stage.primary.master@stage.local', role: UserRole.MASTER }),
        expect.objectContaining({ email: 'stage.primary.tech@stage.local', role: UserRole.TECHNICIAN, isExecutor: true }),
        expect.objectContaining({ email: 'stage.secondary.admin@stage.local', role: UserRole.ADMIN }),
        expect.objectContaining({ email: 'stage.secondary.dispatcher@stage.local', role: UserRole.DISPATCHER }),
        expect.objectContaining({ email: 'stage.secondary.master@stage.local', role: UserRole.MASTER }),
        expect.objectContaining({ email: 'stage.secondary.tech@stage.local', role: UserRole.TECHNICIAN, isExecutor: true }),
        expect.objectContaining({ email: 'stage.mobile.tech@stage.local', role: UserRole.TECHNICIAN, isExecutor: true }),
      ]),
    )
  })

  it('defines explicit PRIMARY and SECONDARY contract context fixtures', () => {
    expect(CANONICAL_STAGE_SEED.contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerCompanyKey: 'primaryProvider',
          role: ServiceContractRole.PRIMARY,
          locationKeys: expect.arrayContaining(['primary', 'secondary']),
          specializationKeys: expect.arrayContaining(['hvac', 'electrical']),
        }),
        expect.objectContaining({
          providerCompanyKey: 'secondaryProvider',
          role: ServiceContractRole.SECONDARY,
          locationKeys: ['secondary'],
          specializationKeys: ['electrical'],
        }),
      ]),
    )
  })

  it('keeps acceptance fixtures A-I deterministic and identifiable', () => {
    for (const key of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
      expect(CANONICAL_STAGE_SEED.tickets).toContainEqual(
        expect.objectContaining({
          key,
          title: expect.stringContaining(`${key} `),
        }),
      )
    }
  })
})
