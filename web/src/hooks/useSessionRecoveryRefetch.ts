import { useEffect } from 'react'

export function useSessionRecoveryRefetch(params: {
  enabled: boolean
  refetch: () => unknown
}) {
  useEffect(() => {
    if (!params.enabled) return

    function retrySessionCheck() {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      params.refetch()
    }

    function onVisibilityChange() {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      retrySessionCheck()
    }

    window.addEventListener('online', retrySessionCheck)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('online', retrySessionCheck)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [params.enabled, params.refetch])
}
