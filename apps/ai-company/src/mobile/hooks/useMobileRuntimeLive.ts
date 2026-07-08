import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMaxWorkerLoop } from '../../hooks/useMaxWorkerLoop'
import {
  buildMobileRuntimeLiveView,
  resolveMobileRuntimeLoop,
  type MobileRuntimeLiveView,
} from '../runtime/mobileRuntimeLiveViewModel'

export function useMobileRuntimeLive(): { view: MobileRuntimeLiveView | null } {
  const { runId } = useParams<{ runId?: string }>()
  const [searchParams] = useSearchParams()
  const loopId = searchParams.get('loop')

  const { loop: polledLoop, latestForMax } = useMaxWorkerLoop({
    loopId: loopId ?? undefined,
    runtimeRunId: runId ?? undefined,
  })

  const resolvedLoop = useMemo(() => {
    if (polledLoop) return polledLoop
    return resolveMobileRuntimeLoop(loopId, runId ?? null)
  }, [loopId, polledLoop, runId])

  const view = useMemo(() => {
    const loop = resolvedLoop ?? latestForMax
    if (!loop) return null
    return buildMobileRuntimeLiveView(loop)
  }, [latestForMax, resolvedLoop])

  return { view }
}
