import { request } from './api'

export type PlannerScoreReason = {
  label: string
  weight: number
}

export type PlannerNextWork = {
  kind: 'TICKET' | 'INSPECTION'
  id: string
  ticketId?: string
  scheduleId?: string
  title: string | null
  summary: string | null
  suggestedFirst: boolean
  dispatcherAssigned: boolean
  reasons: PlannerScoreReason[]
  total: number
}

export type PlannerNextObject = {
  locationId: string
  locationName: string
  address: string | null
  clientName: string | null
  reasons: PlannerScoreReason[]
  works: PlannerNextWork[]
}

export type PlannerNextResponse =
  | { shiftOpen: false }
  | {
      shiftOpen: true
      currentLocationId: string | null
      first: PlannerNextObject | null
      next: PlannerNextObject[]
    }

export function getPlannerMeNext(): Promise<PlannerNextResponse> {
  return request<PlannerNextResponse>('/planner/me/next')
}
