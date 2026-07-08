import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMaxWorkerLoop } from '../../hooks/useMaxWorkerLoop'
import { isMobileGoldenPathActive } from '../goldenPath/mobileGoldenPathStorage'
import {
  buildMobileRuntimeLiveView,
  findActiveMaxWorkerLoop,
  resolveMobileRuntimeLoop,
  type MobileRuntimeLiveView,
} from '../runtime/mobileRuntimeLiveViewModel'

export function useMobileRuntimeLive(): { view: MobileRuntimeLiveView | null } {
  const { runId } = useParams<{ runId?: string }>()
  const [searchParams] = useSearchParams()
  const loopId = searchParams.get('loop')
  const goldenPathActive = isMobileGoldenPathActive()

  const { loop: polledLoop, latestForMax } = useMaxWorkerLoop({
    loopId: loopId ?? undefined,
    runtimeRunId: runId ?? undefined,
  })

  const resolvedLoop = useMemo(() => {
    if (polledLoop) return polledLoop
    if (loopId || runId) {
      return resolveMobileRuntimeLoop(loopId, runId ?? null)
    }
    if (goldenPathActive) {
      return findActiveMaxWorkerLoop()
    }
    return resolveMobileRuntimeLoop(null, null)
  }, [goldenPathActive, loopId, polledLoop, runId])

  const view = useMemo(() => {
    const loop = resolvedLoop ?? (goldenPathActive ? null : latestForMax)
    if (!loop) return null
    return buildMobileRuntimeLiveView(loop)
  }, [goldenPathActive, latestForMax, resolvedLoop])

  return { view }
}
