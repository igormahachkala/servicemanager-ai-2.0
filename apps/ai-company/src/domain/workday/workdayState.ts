import type { PresenceStatus } from '../presence/presence'
import type { WorkdayPhase } from './workdayPhase'

export const WORKDAY_STATES = [
  'starting',
  'planning',
  'working',
  'waiting',
  'reviewing',
  'completed',
  'finished',
] as const

export type WorkdayState = (typeof WORKDAY_STATES)[number]

export function stateForPhase(phase: WorkdayPhase): WorkdayState {
  switch (phase) {
    case 'day_start':
      return 'starting'
    case 'agenda':
      return 'planning'
    case 'check_notifications':
    case 'check_approvals':
      return 'waiting'
    case 'read_knowledge':
    case 'execute_tasks':
    case 'create_reports':
      return 'working'
    case 'review':
      return 'reviewing'
    case 'finish_day':
      return 'finished'
    default:
      return 'working'
  }
}

export function phaseForPresence(status: PresenceStatus): WorkdayPhase {
  switch (status) {
    case 'waiting_approval':
      return 'check_approvals'
    case 'reviewing':
      return 'review'
    case 'learning':
      return 'read_knowledge'
    case 'in_discussion':
      return 'check_notifications'
    case 'working':
    case 'busy':
      return 'execute_tasks'
    case 'break':
      return 'check_notifications'
    case 'available':
      return 'agenda'
    case 'offline':
    default:
      return 'day_start'
  }
}

export function isWorkdayActive(state: WorkdayState): boolean {
  return state !== 'starting' && state !== 'finished'
}

export function isWorkdayIdle(state: WorkdayState, blockedReason: string | null): boolean {
  return state === 'waiting' && !blockedReason
}

export function isWorkdayBlocked(blockedReason: string | null): boolean {
  return blockedReason !== null && blockedReason.trim().length > 0
}
