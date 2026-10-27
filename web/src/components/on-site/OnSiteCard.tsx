import { Link } from 'react-router-dom'

import type { OnSiteCard as OnSiteCardData } from '../../lib/api'
import { OnSiteCorrectionPanel } from './OnSiteCorrectionPanel'
import { onSiteTicketHref, onSiteTicketNumberLabel } from './onSiteDisplay'

type Props = {
  card: OnSiteCardData
  surface: 'desktop' | 'mobile'
  pathname: string
}

export function OnSiteCard({ card, surface, pathname }: Props) {
  const shellClass = surface === 'mobile' ? 'mobileCard' : 'panel'
  return (
    <div className={shellClass} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ fontWeight: 800 }}>{card.name}</div>
        <div className="muted small">{card.shiftOpen ? 'Смена открыта' : 'Смена закрыта'}</div>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {card.lines.map((row) => (
          <div key={row.ticketId} style={{ display: 'grid', gap: 4 }}>
            <div>
              <Link to={onSiteTicketHref(row, surface, pathname)}>{onSiteTicketNumberLabel(row.ticketNumber)}</Link>
              <span> · {row.locationName || 'Точка без имени'}</span>
            </div>
            <div>{row.label}</div>
            {row.notes.map((note) => (
              <div key={note} className="muted small">{note}</div>
            ))}
            <OnSiteCorrectionPanel ticketId={row.ticketId} />
          </div>
        ))}
      </div>
    </div>
  )
}
