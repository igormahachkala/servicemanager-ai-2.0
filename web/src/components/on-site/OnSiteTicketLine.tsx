import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { OnSiteCorrectionPanel } from './OnSiteCorrectionPanel'
import { onSiteErrorText } from './onSiteDisplay'
import { useCanSeeOnSite } from './useCanSeeOnSite'

type Props = {
  ticketId: string
}

export function OnSiteTicketLine({ ticketId }: Props) {
  const canSee = useCanSeeOnSite()
  const lineQ = useQuery({
    queryKey: ['on-site-ticket', ticketId],
    queryFn: () => api.getOnSiteTicket(ticketId),
    enabled: canSee && !!ticketId,
  })

  if (!canSee) return null

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 6 }}>На точке</h3>
      {lineQ.isLoading ? <div className="muted small">Загрузка…</div> : null}
      {lineQ.isError ? <div className="alert">{onSiteErrorText(lineQ.error)}</div> : null}
      {lineQ.data ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div>{lineQ.data.line.label}</div>
          {lineQ.data.line.notes.map((note) => (
            <div key={note} className="muted small">{note}</div>
          ))}
          <OnSiteCorrectionPanel ticketId={ticketId} expanded />
        </div>
      ) : null}
    </div>
  )
}
