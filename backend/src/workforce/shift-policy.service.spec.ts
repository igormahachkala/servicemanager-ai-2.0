import { CompanyType, UserRole, WorkShiftStatus } from '@prisma/client'

import {
  ACTIVE_SHIFT_REQUIRED,
  ACTIVE_SHIFT_REQUIRED_MESSAGE,
  ActiveShiftRequiredException,
  ShiftPolicyService,
} from './shift-policy.service'

/**
 * SMA-PROVIDER-SHIFT-POLICY-FOUNDATION-078.
 *
 * The policy is opt-in and its default is the whole safety story: with the flag off,
 * nothing in Production may change. These tests state that first, then pin the narrow
 * conditions under which the policy does apply.
 */

function makePrisma(options: {
  company?: { type: CompanyType; requireActiveShiftForWork: boolean } | null
  openShift?: boolean
} = {}) {
  const company =
    options.company === undefined
      ? { type: CompanyType.PROVIDER, requireActiveShiftForWork: true }
      : options.company
  return {
    company: { findUnique: jest.fn(async () => company) },
    workShift: { findFirst: jest.fn(async () => (options.openShift ? { id: 'shift-1' } : null)) },
  } as any
}

const technician = { id: 'user-1', companyId: 'company-1', role: UserRole.TECHNICIAN }
const master = { ...technician, role: UserRole.MASTER }
const admin = { ...technician, role: UserRole.ADMIN }
const dispatcher = { ...technician, role: UserRole.DISPATCHER }

describe('ShiftPolicyService — applicability', () => {
  it('does not apply when the policy is disabled (the Production default)', async () => {
    const prisma = makePrisma({
      company: { type: CompanyType.PROVIDER, requireActiveShiftForWork: false },
    })
    const decision = await new ShiftPolicyService(prisma).isShiftRequiredForActor(technician)
    expect(decision).toEqual({ required: false, reason: 'policy_disabled' })
  })

  it('does not apply to a CLIENT company even if the flag were somehow true', async () => {
    const prisma = makePrisma({
      company: { type: CompanyType.CLIENT, requireActiveShiftForWork: true },
    })
    const decision = await new ShiftPolicyService(prisma).isShiftRequiredForActor(technician)
    expect(decision).toEqual({ required: false, reason: 'company_not_provider' })
  })

  it('applies to TECHNICIAN in a provider with the policy on', async () => {
    const decision = await new ShiftPolicyService(makePrisma()).isShiftRequiredForActor(technician)
    expect(decision).toEqual({ required: true, reason: 'required' })
  })

  it('applies to MASTER in a provider with the policy on', async () => {
    const decision = await new ShiftPolicyService(makePrisma()).isShiftRequiredForActor(master)
    expect(decision).toEqual({ required: true, reason: 'required' })
  })

  it('never applies to ADMIN', async () => {
    const decision = await new ShiftPolicyService(makePrisma()).isShiftRequiredForActor(admin)
    expect(decision).toEqual({ required: false, reason: 'role_not_subject' })
  })

  it('never applies to DISPATCHER', async () => {
    const decision = await new ShiftPolicyService(makePrisma()).isShiftRequiredForActor(dispatcher)
    expect(decision).toEqual({ required: false, reason: 'role_not_subject' })
  })

  it('does not even read the company for a non-subject role', async () => {
    const prisma = makePrisma()
    await new ShiftPolicyService(prisma).isShiftRequiredForActor(admin)
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
  })

  it('fails closed when the company cannot be read', async () => {
    const prisma = makePrisma({ company: null })
    const decision = await new ShiftPolicyService(prisma).isShiftRequiredForActor(technician)
    expect(decision).toEqual({ required: true, reason: 'company_not_found' })
  })
})

describe('ShiftPolicyService — assertion', () => {
  it('passes when an active shift exists', async () => {
    const prisma = makePrisma({ openShift: true })
    await expect(
      new ShiftPolicyService(prisma).assertActiveShiftForOperationalWork(technician),
    ).resolves.toBeUndefined()
  })

  it('throws the canonical error when the policy applies and no shift is open', async () => {
    const prisma = makePrisma({ openShift: false })
    await expect(
      new ShiftPolicyService(prisma).assertActiveShiftForOperationalWork(technician),
    ).rejects.toBeInstanceOf(ActiveShiftRequiredException)
  })

  it('exposes ACTIVE_SHIFT_REQUIRED as 409 with the canonical RU message', async () => {
    const error = new ActiveShiftRequiredException()
    expect(error.getStatus()).toBe(409)
    expect(error.getResponse()).toEqual({
      code: ACTIVE_SHIFT_REQUIRED,
      message: ACTIVE_SHIFT_REQUIRED_MESSAGE,
    })
    expect(ACTIVE_SHIFT_REQUIRED).toBe('ACTIVE_SHIFT_REQUIRED')
    expect(ACTIVE_SHIFT_REQUIRED_MESSAGE).toBe(
      'Откройте рабочую смену, чтобы выполнить это действие.',
    )
  })

  it('policy OFF preserves behaviour — passes with no shift and never queries shifts', async () => {
    const prisma = makePrisma({
      company: { type: CompanyType.PROVIDER, requireActiveShiftForWork: false },
      openShift: false,
    })
    await expect(
      new ShiftPolicyService(prisma).assertActiveShiftForOperationalWork(technician),
    ).resolves.toBeUndefined()
    expect(prisma.workShift.findFirst).not.toHaveBeenCalled()
  })

  it('management is unaffected even with the policy on and no shift open', async () => {
    const prisma = makePrisma({ openShift: false })
    const service = new ShiftPolicyService(prisma)
    await expect(service.assertActiveShiftForOperationalWork(admin)).resolves.toBeUndefined()
    await expect(service.assertActiveShiftForOperationalWork(dispatcher)).resolves.toBeUndefined()
  })

  it('reads the existing WorkShift table with the existing OPEN status', async () => {
    const prisma = makePrisma({ openShift: true })
    await new ShiftPolicyService(prisma).hasActiveShift(technician)
    expect(prisma.workShift.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: technician.companyId,
          userId: technician.id,
          status: WorkShiftStatus.OPEN,
        },
      }),
    )
  })
})

describe('ShiftPolicyService.canCompanyUseShiftPolicy', () => {
  it('is true only for PROVIDER', () => {
    expect(ShiftPolicyService.canCompanyUseShiftPolicy(CompanyType.PROVIDER)).toBe(true)
    expect(ShiftPolicyService.canCompanyUseShiftPolicy(CompanyType.CLIENT)).toBe(false)
  })
})
