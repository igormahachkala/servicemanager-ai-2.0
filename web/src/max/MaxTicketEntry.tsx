import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MaxWebApp } from './maxBridge'

type Props = {
  ticketId: string
  webApp: MaxWebApp | null
}

export function MaxTicketEntry({ ticketId, webApp }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    const bb = webApp?.BackButton
    if (!bb) return
    const goRoot = () => navigate('/max', { replace: true })
    bb.show()
    bb.onClick(goRoot)
    return () => {
      bb.offClick(goRoot)
    }
  }, [webApp, navigate])

  useEffect(() => {
    navigate(`/m/tickets/${encodeURIComponent(ticketId)}`, { replace: true })
  }, [ticketId, navigate])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: 16 }}>Открываем заявку…</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>{ticketId}</div>
      </div>
    </div>
  )
}
