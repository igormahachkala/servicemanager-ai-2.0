import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { hasOpenWorkShift, shouldFetchShiftGateState } from './mobileShiftGate'
import {
  shouldInvalidateRoutes,
  startOpenShiftGeolocation,
  type ShiftGeoPoint,
} from './shiftGeolocation'

type Props = {
  user?: api.Me | null
}

export function MobileShiftGeolocation({ user }: Props) {
  const queryClient = useQueryClient()
  const lastRouteOriginRef = useRef<ShiftGeoPoint | null>(null)
  const enabled = shouldFetchShiftGateState(user)
  const stateQ = useQuery({
    queryKey: ['workforce-me'],
    queryFn: api.workforceMyState,
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  })

  const openShiftId = enabled && hasOpenWorkShift(stateQ.data) ? stateQ.data?.shift?.id ?? null : null

  useEffect(() => {
    lastRouteOriginRef.current = null
  }, [openShiftId])

  useEffect(() => {
    if (!openShiftId) return
    return startOpenShiftGeolocation((point) => {
      if (!shouldInvalidateRoutes(lastRouteOriginRef.current, point)) return
      lastRouteOriginRef.current = point
      void queryClient.invalidateQueries({ queryKey: ['ticket-routes'] })
    })
  }, [openShiftId, queryClient])

  return null
}
