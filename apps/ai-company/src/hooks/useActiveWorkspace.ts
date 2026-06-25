import { useCallback, useEffect, useState } from 'react'
import { useWorkspaces } from './useWorkspaces'

const STORAGE_KEY = 'ai-company-active-workspace'
const CHANGE_EVENT = 'ai-company-active-workspace-change'

export function getActiveWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export function setActiveWorkspaceId(id: string | null): void {
  if (typeof window === 'undefined') return
  if (id) {
    localStorage.setItem(STORAGE_KEY, id)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useActiveWorkspace() {
  const { workspaces } = useWorkspaces()
  const [activeId, setActiveId] = useState<string | null>(() => getActiveWorkspaceId())

  const refresh = useCallback(() => {
    setActiveId(getActiveWorkspaceId())
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
    setActiveWorkspaceId(id)
    setActiveId(id)
  }, [])

  const activeWorkspace =
    activeId !== null ? (workspaces.find((item) => item.id === activeId) ?? null) : null

  return { activeId, activeWorkspace, setActive, workspaces }
}
