import { Link, useLocation } from 'react-router-dom'

import { TechnicianMapBoard } from '../components/technician-map/TechnicianMapBoard'
import { mobilePath } from './mobileRoute'

export function MobileTechnicianMapPage() {
  const location = useLocation()
  return (
    <>
      <div className="mobileTicketDetailsToolbar">
        <Link to={mobilePath(location.pathname, '/settings')} className="mobileDetailsBackLink">Настройки</Link>
      </div>
      <div className="mobileSection">
        <div className="mobileSectionTitle">Карта техников</div>
        <TechnicianMapBoard surface="mobile" />
      </div>
    </>
  )
}
