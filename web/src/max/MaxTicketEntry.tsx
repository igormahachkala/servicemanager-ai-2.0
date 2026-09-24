import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { MaxWebApp } from './maxBridge'

type Props = {
  ticketId: string
  webApp: MaxWebApp | null
}

export function MaxTicketEntry({ ticketId, webApp }: Props) {
  const navigate = useNavigate()
  const target = `/max/tickets/${encodeURIComponent(ticketId)}`

  useEffect(() => {
    const bb = webApp?.BackButton
    if (!bb) return
    const goRoot = () => navigate('/max', { replace: true })
    bb.show()
    bb.onClick(goRoot)
    return () => {
      bb.offClick(goRoot)
      bb.hide()
    }
  }, [webApp, navigate])

  return <Navigate to={target} replace />
}
