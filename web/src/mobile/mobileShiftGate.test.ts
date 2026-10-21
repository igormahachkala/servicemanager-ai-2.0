import { describe, expect, it } from 'vitest'
import {
  ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE,
  isActiveShiftRequiredError,
  reduceShiftGatePrompt,
  shiftGateDismissalKey,
  shouldFetchShiftGateState,
  shouldShowShiftGatePrompt,
} from './mobileShiftGate'

function user(role: string) {
  return { id: `${role.toLowerCase()}-1`, role, companyId: 'provider-1' }
}

function state({
  companyType = 'PROVIDER',
  policy = true,
  shiftStatus = null,
}: {
  companyType?: 'PROVIDER' | 'CLIENT'
  policy?: boolean
  shiftStatus?: string | null
} = {}) {
  return {
    company: {
      id: companyType === 'PROVIDER' ? 'provider-1' : 'client-1',
      type: companyType,
      requireActiveShiftForWork: policy,
    },
    shift: shiftStatus ? { status: shiftStatus } : null,
  }
}

describe('mobile shift gate', () => {
  it('fetches state only for technician and master', () => {
    expect(shouldFetchShiftGateState(user('TECHNICIAN'))).toBe(true)
    expect(shouldFetchShiftGateState(user('MASTER'))).toBe(true)
    expect(shouldFetchShiftGateState(user('ADMIN'))).toBe(false)
    expect(shouldFetchShiftGateState(user('DISPATCHER'))).toBe(false)
    expect(shouldFetchShiftGateState(user('CLIENT'))).toBe(false)
  })

  it('shows the prompt only for a provider with the policy and no open shift', () => {
    expect(shouldShowShiftGatePrompt(user('TECHNICIAN'), state({ policy: false }))).toBe(false)
    expect(shouldShowShiftGatePrompt(user('TECHNICIAN'), state({ policy: true }))).toBe(true)
    expect(shouldShowShiftGatePrompt(user('TECHNICIAN'), state({ policy: true, shiftStatus: 'OPEN' }))).toBe(false)
    expect(shouldShowShiftGatePrompt(user('MASTER'), state({ policy: true }))).toBe(true)
    expect(shouldShowShiftGatePrompt(user('ADMIN'), state({ policy: true }))).toBe(false)
    expect(shouldShowShiftGatePrompt(user('DISPATCHER'), state({ policy: true }))).toBe(false)
    expect(shouldShowShiftGatePrompt(user('TECHNICIAN'), state({ companyType: 'CLIENT', policy: true }))).toBe(false)
  })

  it('reduces prompt stages', () => {
    expect(reduceShiftGatePrompt('closed', 'show')).toEqual({ stage: 'initial', dismiss: false, openShift: false })
    expect(reduceShiftGatePrompt('initial', 'not_now')).toEqual({ stage: 'closed', dismiss: true, openShift: false })
    expect(reduceShiftGatePrompt('initial', 'yes')).toEqual({ stage: 'confirm', dismiss: false, openShift: false })
    expect(reduceShiftGatePrompt('confirm', 'cancel')).toEqual({ stage: 'closed', dismiss: true, openShift: false })
    expect(reduceShiftGatePrompt('confirm', 'confirm_open')).toEqual({ stage: 'closed', dismiss: false, openShift: true })
  })

  it('keys dismissal by user, company and day', () => {
    expect(shiftGateDismissalKey({ userId: 'u1', companyId: 'c1', dayKey: '2026-09-02' })).toBe(
      'sma.mobileShiftGate.dismissed:u1:c1:2026-09-02',
    )
    expect(shiftGateDismissalKey({ userId: 'u1', companyId: 'c1', dayKey: '2026-09-02' })).not.toBe(
      shiftGateDismissalKey({ userId: 'u1', companyId: 'c1', dayKey: '2026-09-03' }),
    )
  })

  it('recognizes 409 active-shift errors by code or message', () => {
    expect(isActiveShiftRequiredError({ status: 409, message: ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE })).toBe(true)
    expect(isActiveShiftRequiredError({ status: 409, message: 'ACTIVE_SHIFT_REQUIRED' })).toBe(true)
    expect(isActiveShiftRequiredError({ status: 409, message: 'Another conflict' })).toBe(false)
    expect(isActiveShiftRequiredError({ status: 403, message: ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE })).toBe(false)
  })
})
