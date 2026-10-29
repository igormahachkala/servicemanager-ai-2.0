import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { canSeeOnSiteNav } from '../../lib/navigation'

/** MASTER, DISPATCHER и ADMIN компании провайдера. Неизвестный тип прячет пункт. */
export function useCanSeeOnSite(): boolean {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const role = meQ.data?.role
  const roleMaybe = role === 'MASTER' || role === 'DISPATCHER' || role === 'ADMIN' || role === 'ADMIN_PROVIDER'
  const companyQ = useQuery({
    queryKey: ['company-own-context'],
    queryFn: () => api.company(),
    enabled: roleMaybe,
  })
  return canSeeOnSiteNav(role, companyQ.data?.type ?? null)
}
