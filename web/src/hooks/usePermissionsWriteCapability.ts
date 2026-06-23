import { useQuery } from '@tanstack/react-query'

import { probePermissionsOverridesWriteSupport } from '../lib/permissions-api'

export function usePermissionsWriteCapability(scopeCompanyId?: string, enabled = true) {
  return useQuery({
    queryKey: ['permissions-write-capability', scopeCompanyId],
    queryFn: () => probePermissionsOverridesWriteSupport(scopeCompanyId),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}
