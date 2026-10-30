import { request } from './api'
import type { TechnicianMapPersonRow, TechnicianMapTicketRow } from '../components/technician-map/technicianMapSelection'

export type TechnicianMapResponse = {
  people: TechnicianMapPersonRow[]
  tickets: TechnicianMapTicketRow[]
}

export function getTechnicianMap(): Promise<TechnicianMapResponse> {
  return request<TechnicianMapResponse>('/workforce/technician-map')
}
