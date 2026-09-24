import { Navigate, useLocation } from 'react-router-dom'
import { V2RoutePlaceholder } from '../../components/v2/V2RoutePlaceholder'
import { getV2StubPageMeta } from '../../lib/managementConsoleV2Pages'

export function ManagementV2StubPage() {
  const { pathname } = useLocation()
  const meta = getV2StubPageMeta(pathname)

  if (!meta) {
    return <Navigate to="/dashboard" replace />
  }

  return <V2RoutePlaceholder {...meta} />
}
