import * as api from '../../lib/api'

type TicketClaimBlockProps = {
  role?: api.Role | null
  canClaim: boolean
  ticket?: api.TicketGetOne
  meUserId?: string
}

export function TicketClaimBlock(props: TicketClaimBlockProps) {
  const { role, canClaim, ticket, meUserId } = props

  return (
    <>
      {role === 'TECHNICIAN' ? (
        <div className="muted small" style={{ marginTop: 8 }}>
          {canClaim
            ? 'Эту заявку можно взять в работу (claim).'
            : ticket
              ? ticket.assignedTechnicianId === meUserId
                ? 'Заявка уже назначена на вас.'
                : ticket.assignedTechnician
                  ? `Заявка назначена на: ${ticket.assignedTechnician.email}.`
                  : ticket.meta?.claimAvailabilityReason || 'Claim доступен только для новых неназначенных заявок.'
              : 'Claim доступен только для новых неназначенных заявок.'}
        </div>
      ) : null}
    </>
  )
}
