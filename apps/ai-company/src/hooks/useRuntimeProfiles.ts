import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ensureSeedRuntimeProfiles,
  getAllProviders,
  getOrCreateRuntimeProfile,
  getRuntimeProfileByEmployeeId,
  loadRuntimeProfiles,
  upsertRuntimeProfile,
  type RuntimeProfile,
} from '../domain/runtime/runtimeStorage'

export function useRuntimeProfiles() {
  const [profiles, setProfiles] = useState<RuntimeProfile[]>([])
  const providers = useMemo(() => getAllProviders(), [])

  const refresh = useCallback(() => {
    ensureSeedRuntimeProfiles()
    setProfiles(loadRuntimeProfiles())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-runtime-profiles') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const stats = useMemo(
    () => ({
      total: profiles.length,
      active: profiles.filter((item) => item.status === 'active').length,
      paused: profiles.filter((item) => item.status === 'paused').length,
      draft: profiles.filter((item) => item.status === 'draft').length,
    }),
    [profiles],
  )

  const saveProfile = useCallback((profile: RuntimeProfile) => {
    const saved = upsertRuntimeProfile({
      ...profile,
      updatedAt: new Date().toISOString(),
    })
    setProfiles(loadRuntimeProfiles())
    return saved
  }, [])

  const getProfile = useCallback(
    (employeeId: string, primaryModelLabel?: string) =>
      getRuntimeProfileByEmployeeId(employeeId) ??
      getOrCreateRuntimeProfile(employeeId, primaryModelLabel),
    [],
  )

  return { profiles, providers, stats, refresh, saveProfile, getProfile }
}
