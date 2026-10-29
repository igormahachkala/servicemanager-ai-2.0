import { Link, useLocation } from 'react-router-dom'

import { OnSiteBoard } from '../components/on-site/OnSiteBoard'
import { mobilePath } from './mobileRoute'

export function MobileOnSitePage() {
  const location = useLocation()
  return (
    <>
      <div className="mobileTicketDetailsToolbar">
        <Link to={mobilePath(location.pathname, '/settings')} className="mobileDetailsBackLink">Настройки</Link>
      </div>
      <div className="mobileSection">
        <div className="mobileSectionTitle">На точках</div>
        <OnSiteBoard surface="mobile" />
      </div>
    </>
  )
}
