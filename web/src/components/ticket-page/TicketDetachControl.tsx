import type { Role } from '../../lib/api'
import { isChildTicket, roleCanDetachChildTicket } from '../../lib/ticketIsChild'
import { TicketActionButton } from './TicketActionButton'

export type TicketDetachControlProps = {
  ticket: { parentId?: string | null }
  role?: Role | null
  pending: boolean
  error?: string | null
  onDetach: () => void
}

export function TicketDetachControl(props: TicketDetachControlProps) {
  const { ticket, role, pending, error, onDetach } = props
  if (!isChildTicket(ticket) || !roleCanDetachChildTicket(role)) return null

  return (
    <div>
      <TicketActionButton variant="ghost" onClick={onDetach} disabled={pending}>
        Отвязать
      </TicketActionButton>
      {error ? <div className="alert">{error}</div> : null}
    </div>
  )
}
