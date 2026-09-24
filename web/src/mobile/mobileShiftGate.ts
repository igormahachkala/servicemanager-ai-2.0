export const ACTIVE_SHIFT_REQUIRED_CODE = 'ACTIVE_SHIFT_REQUIRED'
export const ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE =
  'Откройте рабочую смену, чтобы выполнить это действие.'
export const SHIFT_GATE_DISMISSAL_STORAGE_AREA = 'session'
export const SHIFT_GATE_DISMISSAL_PREFIX = 'sma.mobileShiftGate.dismissed'

export type ShiftGateRole =
  | 'ADMIN'
  | 'ADMIN_PROVIDER'
  | 'CLIENT'
  | 'CLIENT_ADMIN'
  | 'DISPATCHER'
  | 'MASTER'
  | 'NETWORK_DIRECTOR'
  | 'PLATFORM_ADMIN'
  | 'STAFF'
  | 'TECHNICIAN'
  | 'TERRITORIAL_MANAGER'
  | string

export type ShiftGateUser = {
  id: string
  role?: ShiftGateRole | null
  companyId?: string | null
}

export type ShiftGateCompanyState = {
  id: string
  type?: 'CLIENT' | 'PROVIDER' | null
  requireActiveShiftForWork?: boolean | null
}

export type ShiftGateWorkforceState = {
  company?: ShiftGateCompanyState | null
  shift?: { status?: string | null } | null
}

export type ShiftGatePromptStage = 'closed' | 'initial' | 'confirm'

export type ShiftGatePromptEvent =
  | 'show'
  | 'not_now'
  | 'yes'
  | 'cancel'
  | 'confirm_open'
  | 'opened'

export type ShiftGatePromptTransition = {
  stage: ShiftGatePromptStage
  dismiss: boolean
  openShift: boolean
}

export function isShiftGateSubjectRole(role?: ShiftGateRole | null): boolean {
  return role === 'TECHNICIAN' || role === 'MASTER'
}

export function shouldFetchShiftGateState(user?: ShiftGateUser | null): boolean {
  return isShiftGateSubjectRole(user?.role)
}

export function hasOpenWorkShift(state?: ShiftGateWorkforceState | null): boolean {
  return state?.shift?.status === 'OPEN'
}

export function shouldShowShiftGatePrompt(
  user?: ShiftGateUser | null,
  state?: ShiftGateWorkforceState | null,
): boolean {
  if (!shouldFetchShiftGateState(user)) return false
  if (!state?.company) return false
  if (state.company.type !== 'PROVIDER') return false
  if (state.company.requireActiveShiftForWork !== true) return false
  return !hasOpenWorkShift(state)
}

export function shiftGateDayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftGateDismissalKey(params: {
  userId: string
  companyId: string
  dayKey: string
}): string {
  return `${SHIFT_GATE_DISMISSAL_PREFIX}:${params.userId}:${params.companyId}:${params.dayKey}`
}

export function reduceShiftGatePrompt(
  stage: ShiftGatePromptStage,
  event: ShiftGatePromptEvent,
): ShiftGatePromptTransition {
  if (event === 'show') {
    return { stage: stage === 'confirm' ? 'confirm' : 'initial', dismiss: false, openShift: false }
  }
  if (event === 'yes' && stage === 'initial') {
    return { stage: 'confirm', dismiss: false, openShift: false }
  }
  if (event === 'confirm_open' && stage === 'confirm') {
    return { stage: 'closed', dismiss: false, openShift: true }
  }
  if (event === 'not_now' || event === 'cancel') {
    return { stage: 'closed', dismiss: true, openShift: false }
  }
  if (event === 'opened') {
    return { stage: 'closed', dismiss: false, openShift: false }
  }
  return { stage, dismiss: false, openShift: false }
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return (error.message || '').trim()
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message || '').trim()
  }
  return String(error ?? '').trim()
}

function httpStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status
  return typeof status === 'number' ? status : undefined
}

export function isActiveShiftRequiredError(error: unknown): boolean {
  if (httpStatus(error) !== 409) return false
  const message = rawMessage(error)
  return (
    message.includes(ACTIVE_SHIFT_REQUIRED_CODE) ||
    message.includes(ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE) ||
    /откройте рабочую смену/i.test(message) ||
    /сначала откройте рабочую смену/i.test(message)
  )
}
