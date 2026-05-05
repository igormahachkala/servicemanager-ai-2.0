import { Link } from 'react-router-dom'
import * as api from '../../lib/api'

type Props = {
  me: Awaited<ReturnType<typeof api.me>> | undefined
  pageScope: api.TicketScopeParams
}

export function HomeFAB({ me, pageScope }: Props) {
  return (
    <Link to={api.appendScopeToPath('/m/create', pageScope, me)} className="mobileBtn mobileCreateTicketLink">
      Создать заявку
    </Link>
  )
}
