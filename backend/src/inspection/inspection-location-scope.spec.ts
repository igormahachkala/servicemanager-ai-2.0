import { NotFoundException } from '@nestjs/common'
import {
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
} from '@prisma/client'

import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import {
  assertInspectionLocationAccess,
  resolveInspectionLocationAccess,
} from './inspection-location-scope'

/**
 * SMA-ROUNDS-V1-PROVIDER-LOCATION-SCOPE-097 — security matrix for the provider/client
 * location scope used by Rounds.
 *
 * These tests drive the REAL ServiceContractsService rather than a stubbed access object.
 * A stub would only prove that the Inspection glue passes values around; the thing worth
 * proving is that Rounds inherit the canonical contract semantics — status, date window,
 * PRIMARY/SECONDARY role and every locationMode — without restating any of them.
 */

const PROVIDER_ID = 'provider-1'
const OTHER_PROVIDER_ID = 'provider-2'
const CLIENT_A = 'client-a'
const CLIENT_B = 'client-b'

const LOC_A1 = { id: 'loc-a1', clientCompanyId: CLIENT_A }
const LOC_A2 = { id: 'loc-a2', clientCompanyId: CLIENT_A }
const LOC_B1 = { id: 'loc-b1', clientCompanyId: CLIENT_B }

function makeContract(overrides: any = {}) {
  return {
    id: 'sc-1',
    status: ServiceContractStatus.ACTIVE,
    role: ServiceContractRole.PRIMARY,
    locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
    clientCompanyId: CLIENT_A,
    providerCompanyId: PROVIDER_ID,
    startsAt: null,
    endsAt: null,
    locations: [],
    ...overrides,
  }
}

/**
 * Contracts are keyed by clientCompanyId_providerCompanyId, exactly as the real unique index
 * is, so a lookup for the wrong pair misses instead of silently returning the only fixture.
 */
function makeContracts(contracts: any[]) {
  const prisma = {
    serviceContract: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.clientCompanyId_providerCompanyId
        return (
          contracts.find(
            (c) =>
              c.clientCompanyId === key.clientCompanyId &&
              c.providerCompanyId === key.providerCompanyId,
          ) ?? null
        )
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any

  return new ServiceContractsService(prisma)
}

function resolve(serviceContracts: ServiceContractsService, actorCompanyId: string, location: any) {
  return resolveInspectionLocationAccess({
    serviceContracts: serviceContracts as any,
    actorCompanyId,
    location,
  })
}

describe('097 provider/client location scope for Rounds', () => {
  // ── 1 / 2 / 3: active ALL_LOCATIONS contract covers every client location ────
  it('ALLOWS a provider at a client location under an active ALL_LOCATIONS contract', async () => {
    const contracts = makeContracts([makeContract()])

    const context = await resolve(contracts, PROVIDER_ID, LOC_A1)

    expect(context).toEqual({
      locationId: LOC_A1.id,
      clientCompanyId: CLIENT_A,
      isOwnCompanyLocation: false,
      contractRole: ServiceContractRole.PRIMARY,
    })
  })

  it('is role-agnostic: the same contract authorises the location for every provider actor', async () => {
    const contracts = makeContracts([makeContract()])

    // Role gating stays in InspectionPolicy. The location scope must not encode a second,
    // divergent opinion about which roles may act — otherwise Rounds would drift away from
    // the canonical model the moment a role is added.
    const first = await resolve(contracts, PROVIDER_ID, LOC_A1)
    const second = await resolve(contracts, PROVIDER_ID, LOC_A2)

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
  })

  // ── 4: no contract at all ───────────────────────────────────────────────────
  it('DENIES a provider with no contract for the location owner', async () => {
    const contracts = makeContracts([])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.toBeNull()
  })

  // ── 5: contract for client A, location owned by client B ────────────────────
  it('DENIES a location owned by a different client than the one under contract', async () => {
    const contracts = makeContracts([makeContract({ clientCompanyId: CLIENT_A })])

    await expect(resolve(contracts, PROVIDER_ID, LOC_B1)).resolves.toBeNull()
  })

  // ── 6 / 7: SELECTED_LOCATIONS ───────────────────────────────────────────────
  it('ALLOWS a listed location under a SELECTED_LOCATIONS contract', async () => {
    const contracts = makeContracts([
      makeContract({
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [{ locationId: LOC_A1.id }],
      }),
    ])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.not.toBeNull()
  })

  it('DENIES a non-listed location under the same SELECTED_LOCATIONS contract', async () => {
    const contracts = makeContracts([
      makeContract({
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [{ locationId: LOC_A1.id }],
      }),
    ])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A2)).resolves.toBeNull()
  })

  it('DENIES every location when a SELECTED_LOCATIONS contract lists none', async () => {
    const contracts = makeContracts([
      makeContract({
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [],
      }),
    ])

    // restricted_empty must fail closed, not fall back to tenant-wide.
    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.toBeNull()
  })

  // ── 8: status and date window ───────────────────────────────────────────────
  it.each([
    ['DRAFT', { status: ServiceContractStatus.DRAFT }],
    ['SUSPENDED', { status: ServiceContractStatus.SUSPENDED }],
    ['TERMINATED', { status: ServiceContractStatus.TERMINATED }],
  ])('DENIES a %s contract', async (_label, overrides) => {
    const contracts = makeContracts([makeContract(overrides)])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.toBeNull()
  })

  it('DENIES a contract whose endsAt is in the past', async () => {
    const contracts = makeContracts([
      makeContract({ endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) }),
    ])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.toBeNull()
  })

  it('DENIES a contract whose startsAt is in the future', async () => {
    const contracts = makeContracts([
      makeContract({ startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }),
    ])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.toBeNull()
  })

  it('ALLOWS a contract inside its date window', async () => {
    const contracts = makeContracts([
      makeContract({
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.not.toBeNull()
  })

  // ── 9: one provider template, two separately authorised clients ─────────────
  it('ALLOWS two separately contracted clients for the same provider', async () => {
    const contracts = makeContracts([
      makeContract({ id: 'sc-a', clientCompanyId: CLIENT_A }),
      makeContract({ id: 'sc-b', clientCompanyId: CLIENT_B }),
    ])

    // The template itself is never consulted here — that is the point. Reuse across clients
    // is a property of the scope check being per-location, so no per-client template copy
    // can ever become necessary.
    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.not.toBeNull()
    await expect(resolve(contracts, PROVIDER_ID, LOC_B1)).resolves.not.toBeNull()
  })

  // ── 10: another provider ────────────────────────────────────────────────────
  it("DENIES a second provider at the first provider's contracted location", async () => {
    const contracts = makeContracts([makeContract({ providerCompanyId: PROVIDER_ID })])

    await expect(resolve(contracts, OTHER_PROVIDER_ID, LOC_A1)).resolves.toBeNull()
  })

  // ── 11: client own-company behaviour is untouched ───────────────────────────
  it('ALLOWS a client at its own location with no contract row at all', async () => {
    const contracts = makeContracts([])

    const context = await resolve(contracts, CLIENT_A, LOC_A1)

    expect(context).toEqual({
      locationId: LOC_A1.id,
      clientCompanyId: CLIENT_A,
      isOwnCompanyLocation: true,
      contractRole: ServiceContractRole.PRIMARY,
    })
  })

  it('DENIES a client at another client’s location', async () => {
    const contracts = makeContracts([])

    await expect(resolve(contracts, CLIENT_A, LOC_B1)).resolves.toBeNull()
  })

  // ── 12 / 13: secondary provider ─────────────────────────────────────────────
  it('ALLOWS a SECONDARY provider within its contract scope and reports the role', async () => {
    const contracts = makeContracts([
      makeContract({
        role: ServiceContractRole.SECONDARY,
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [{ locationId: LOC_A1.id }],
      }),
    ])

    const context = await resolve(contracts, PROVIDER_ID, LOC_A1)

    expect(context?.contractRole).toBe(ServiceContractRole.SECONDARY)
  })

  it('DENIES a SECONDARY provider outside its contract scope', async () => {
    const contracts = makeContracts([
      makeContract({
        role: ServiceContractRole.SECONDARY,
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [{ locationId: LOC_A1.id }],
      }),
    ])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A2)).resolves.toBeNull()
  })

  it('DENIES an inactive SECONDARY contract even for a listed location', async () => {
    const contracts = makeContracts([
      makeContract({
        role: ServiceContractRole.SECONDARY,
        status: ServiceContractStatus.TERMINATED,
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [{ locationId: LOC_A1.id }],
      }),
    ])

    await expect(resolve(contracts, PROVIDER_ID, LOC_A1)).resolves.toBeNull()
  })

  // ── malformed input fails closed ────────────────────────────────────────────
  it.each([
    ['missing location', null],
    ['blank location id', { id: '   ', clientCompanyId: CLIENT_A }],
    ['blank owner', { id: LOC_A1.id, clientCompanyId: '  ' }],
  ])('DENIES on %s', async (_label, location) => {
    const contracts = makeContracts([makeContract()])

    await expect(resolve(contracts, PROVIDER_ID, location as any)).resolves.toBeNull()
  })

  it('DENIES a blank actor company', async () => {
    const contracts = makeContracts([makeContract()])

    await expect(resolve(contracts, '   ', LOC_A1)).resolves.toBeNull()
  })
})

describe('097 assertInspectionLocationAccess', () => {
  it('throws the caller-supplied message so a denial is indistinguishable from absence', async () => {
    const contracts = makeContracts([])

    await expect(
      assertInspectionLocationAccess({
        serviceContracts: contracts as any,
        actorCompanyId: PROVIDER_ID,
        location: LOC_A1,
        notFoundMessage: 'Inspection run not found',
      }),
    ).rejects.toThrow(new NotFoundException('Inspection run not found'))
  })

  it('returns the resolved context when access is permitted', async () => {
    const contracts = makeContracts([makeContract()])

    await expect(
      assertInspectionLocationAccess({
        serviceContracts: contracts as any,
        actorCompanyId: PROVIDER_ID,
        location: LOC_A1,
        notFoundMessage: 'Location not found',
      }),
    ).resolves.toMatchObject({ clientCompanyId: CLIENT_A })
  })
})
