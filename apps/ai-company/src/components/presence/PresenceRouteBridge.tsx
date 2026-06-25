import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { applyRoutePresenceContext, syncPresenceFromPlatform } from '../../domain/presence'
import { dispatchPresenceSync } from '../../hooks/usePresence'

export function PresenceRouteBridge() {
  const location = useLocation()

  useEffect(() => {
    applyRoutePresenceContext(location.pathname)
    syncPresenceFromPlatform()
    dispatchPresenceSync()
  }, [location.pathname])

  return null
}
