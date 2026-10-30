import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getTechnicianMap } from '../../lib/technicianMapApi'
import { SHIFT_GEO_INTERVAL_MS } from '../../mobile/shiftGeolocation'
import { TechnicianMapCanvas } from './TechnicianMapCanvas'
import { TechnicianMapFilters } from './TechnicianMapFilters'
import {
  initialTechnicianMapSelection,
  markerPeople,
  switchTechnicianMapMode,
  type IdSelection,
  type TechnicianMapMode,
} from './technicianMapSelection'

type Props = {
  surface: 'desktop' | 'mobile'
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Не удалось загрузить карту техников'
}

export function TechnicianMapBoard({ surface }: Props) {
  const [selection, setSelection] = useState(initialTechnicianMapSelection)
  const [query, setQuery] = useState('')
  const listQ = useQuery({
    queryKey: ['technician-map'],
    queryFn: getTechnicianMap,
    refetchInterval: SHIFT_GEO_INTERVAL_MS,
  })
  const people = listQ.data?.people ?? []
  const tickets = listQ.data?.tickets ?? []
  const markers = markerPeople(selection, people, tickets)

  const onMode = (mode: TechnicianMapMode) => {
    setSelection((current) => switchTechnicianMapMode(current, mode))
    setQuery('')
  }

  return (
    <div>
      <TechnicianMapFilters
        surface={surface}
        mode={selection.mode}
        query={query}
        technicianIds={selection.technicianIds}
        ticketIds={selection.ticketIds}
        people={people}
        tickets={tickets}
        onMode={onMode}
        onQuery={setQuery}
        onTechnicianIds={(technicianIds: IdSelection) => setSelection((current) => ({ ...current, technicianIds }))}
        onTicketIds={(ticketIds: IdSelection) => setSelection((current) => ({ ...current, ticketIds }))}
      />
      {listQ.isError ? <div className="alert">{errorText(listQ.error)}</div> : null}
      <TechnicianMapCanvas people={markers} />
    </div>
  )
}
