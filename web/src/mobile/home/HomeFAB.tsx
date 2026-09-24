import { Link } from 'react-router-dom'
import * as api from '../../lib/api'
import { mobilePath } from '../mobileRoute'

type Props = {
  me: Awaited<ReturnType<typeof api.me>> | undefined
  pageScope: api.TicketScopeParams
}

export function HomeFAB({ me, pageScope }: Props) {
  const basePath = typeof window !== 'undefined' ? mobilePath(window.location.pathname, '/create') : '/m/create'
  return (
    <Link to={api.appendScopeToPath(basePath, pageScope, me)} className="mobileBtn mobileCreateTicketLink">
      Создать заявку
    </Link>
  )
}
