type TicketActionErrorsProps = {
  claimError?: string | null
  statusError?: string | null
}

export function TicketActionErrors(props: TicketActionErrorsProps) {
  const { claimError, statusError } = props
  if (!claimError && !statusError) return null
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
      {claimError ? <div className="alert">{claimError}</div> : null}
      {statusError ? <div className="alert">{statusError}</div> : null}
    </div>
  )
}
