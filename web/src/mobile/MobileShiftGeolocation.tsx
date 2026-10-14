import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { hasOpenWorkShift, shouldFetchShiftGateState } from './mobileShiftGate'
import { startOpenShiftGeolocation } from './shiftGeolocation'

type Props = {
  user?: api.Me | null
}

export function MobileShiftGeolocation({ user }: Props) {
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
    if (!openShiftId) return
    return startOpenShiftGeolocation()
  }, [openShiftId])

  return null
}
