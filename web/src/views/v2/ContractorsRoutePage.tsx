import { useQuery } from '@tanstack/react-query'
import * as api from '../../lib/api'
import { V2RoutePlaceholder } from '../../components/v2/V2RoutePlaceholder'
import { getV2StubPageMeta } from '../../lib/managementConsoleV2Pages'
import { ServiceContractsPage } from '../ServiceContractsPage'

export function ContractorsRoutePage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const meta = getV2StubPageMeta('/contractors')

  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }

  if (meQ.data?.role === 'PLATFORM_ADMIN') {
    return <ServiceContractsPage />
  }

  if (!meta) {
    return null
  }

  return <V2RoutePlaceholder {...meta} />
}
