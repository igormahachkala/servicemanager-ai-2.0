import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'

export function useMapLocations(selectedLocationId: string | null) {
  const locationsQ = useQuery({
    queryKey: ['map-locations'],
    queryFn: api.mapLocations,
  })

  const selectedLocationQ = useQuery({
    queryKey: ['map-location', selectedLocationId],
    queryFn: () => api.mapLocation(selectedLocationId as string),
    enabled: !!selectedLocationId,
  })

  const summary = useMemo(() => {
    const rows = locationsQ.data || []

    return rows.reduce(
      (acc, row) => {
        acc.totalLocations += 1
        acc.ticketsToday += row.ticketsToday
        acc.newCount += row.newCount
        acc.inProgressCount += row.inProgressCount
        acc.doneCount += row.doneCount
        return acc
      },
      {
        totalLocations: 0,
        ticketsToday: 0,
        newCount: 0,
        inProgressCount: 0,
        doneCount: 0,
      },
    )
  }, [locationsQ.data])

  return {
    locationsQ,
    selectedLocationQ,
    summary,
  }
}