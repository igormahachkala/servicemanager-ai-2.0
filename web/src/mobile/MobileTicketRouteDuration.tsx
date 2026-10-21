import { useEffect, useState } from 'react'

import type { TicketScopeParams } from '../lib/api'
import { getTicketRoute } from '../lib/ticketRouteApi'

export function formatTicketRouteLabel(distanceMeters: number): string {
  const distance =
    distanceMeters >= 100
      ? `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} км`
      : `${Math.round(distanceMeters)} м`
  return `До объекта · ${distance}`
}

export function MobileTicketRouteDuration(props: {
  ticketId: string
  scope?: TicketScopeParams
}) {
  const [label, setLabel] = useState<string | null>(null)
  const companyId = props.scope?.companyId
  const linkedClientCompanyId = props.scope?.linkedClientCompanyId

  useEffect(() => {
    let cancelled = false
    void getTicketRoute(props.ticketId, {
      companyId,
      linkedClientCompanyId,
    })
      .then((route) => {
        if (cancelled) return
        if (!route.available || route.distanceMeters == null) {
          setLabel(null)
          return
        }
        setLabel(formatTicketRouteLabel(route.distanceMeters))
      })
      .catch(() => {
        if (!cancelled) setLabel(null)
      })
    return () => {
      cancelled = true
    }
  }, [props.ticketId, companyId, linkedClientCompanyId])

  if (!label) return null
  return <div className="mobileTicketHeaderSub">{label}</div>
}
