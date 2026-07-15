import type { CSSProperties } from 'react'
import { explainClaimUnavailable } from '../../lib/claimAvailabilityHints'
import * as api from '../../lib/api'

type TicketClaimBlockProps = {
  role?: api.Role | null
  canClaim: boolean
  ticket?: api.TicketGetOne
  meUserId?: string
}

const hintBoxSx: CSSProperties = {
  marginTop: 8,
  borderRadius: 12,
  padding: '10px 12px',
  border: '1px solid #fcd34d',
  background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
  color: '#78350f',
  fontSize: '0.88rem',
  lineHeight: 1.45,
}

export function TicketClaimBlock(props: TicketClaimBlockProps) {
  const { role, canClaim, ticket, meUserId } = props

  return (
    <>
      {role === 'TECHNICIAN' ? (
        <div className="muted small" style={{ marginTop: 8 }}>
          {canClaim ? (
            'Эту заявку можно взять в работу (claim).'
          ) : ticket ? (
            ticket.assignedTechnicianId === meUserId ? (
              'Заявка уже назначена на вас.'
            ) : ticket.assignedTechnician ? (
              `Заявка назначена на: ${ticket.assignedTechnician.email}.`
            ) : (
              (() => {
                const { title, detail } = explainClaimUnavailable(ticket.meta?.claimAvailabilityReason)
                return (
                  <div style={hintBoxSx}>
                    <div style={{ fontWeight: 800, color: '#92400e' }}>{title}</div>
                    {detail ? <div style={{ marginTop: 4, fontSize: '0.85rem', opacity: 0.95 }}>{detail}</div> : null}
                  </div>
                )
              })()
            )
          ) : (
            'Claim доступен только для новых неназначенных заявок.'
          )}
        </div>
      ) : null}
    </>
  )
}
