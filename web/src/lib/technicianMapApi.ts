import { request } from './api'
import type { TechnicianMapPersonRow, TechnicianMapTicketRow } from '../components/technician-map/technicianMapSelection'

export type TechnicianMapResponse = {
  people: TechnicianMapPersonRow[]
  tickets: TechnicianMapTicketRow[]
}

export function getTechnicianMap(includeClosed: boolean): Promise<TechnicianMapResponse> {
  const query = includeClosed ? '?includeClosed=1' : ''
  return request<TechnicianMapResponse>(`/workforce/technician-map${query}`)
}
