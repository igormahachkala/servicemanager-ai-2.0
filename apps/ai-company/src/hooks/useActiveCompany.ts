import { useCallback, useEffect, useState } from 'react'
import { getCompanyById } from '../domain/company/companyStorage'
import type { Company } from '../domain/company/company'

const STORAGE_KEY = 'ai-company-active-company'
const CHANGE_EVENT = 'ai-company-active-company-change'

export function getActiveCompanyId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export function setActiveCompanyId(id: string | null): void {
  if (typeof window === 'undefined') return
  if (id) {
    localStorage.setItem(STORAGE_KEY, id)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useActiveCompany() {
  const [activeId, setActiveId] = useState<string | null>(() => getActiveCompanyId())

  const refresh = useCallback(() => {
    setActiveId(getActiveCompanyId())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, refresh)
    }
  }, [refresh])

  const setActive = useCallback((id: string | null) => {
    setActiveCompanyId(id)
    setActiveId(id)
  }, [])

  const activeCompany: Company | null =
    activeId !== null ? getCompanyById(activeId) : null

  return { activeId, activeCompany, setActive }
}
