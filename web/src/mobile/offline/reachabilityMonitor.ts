export type ReachabilityMonitor = {
  start(): void
  stop(): void
  probeNow(): Promise<void>
}

type ReachabilityMonitorOptions = {
  probe: () => Promise<boolean>
  interfaceOnline: () => boolean
  onResult: (reachable: boolean) => void
  intervalMs?: number
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
}

/**
 * Periodically proves API reachability instead of trusting navigator.onLine.
 * WebKit may keep navigator.onLine=true and omit the offline event after the
 * installed PWA loses radio access. One monitor per page is enough.
 */
export function createReachabilityMonitor(options: ReachabilityMonitorOptions): ReachabilityMonitor {
  const setIntervalFn = options.setIntervalFn ?? setInterval
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval
  const intervalMs = options.intervalMs ?? 5_000
  let timer: ReturnType<typeof setInterval> | null = null
  let inFlight = false

  async function probeNow() {
    if (inFlight) return
    if (!options.interfaceOnline()) {
      options.onResult(false)
      return
    }
    inFlight = true
    try {
      options.onResult(await options.probe())
    } catch {
      options.onResult(false)
    } finally {
      inFlight = false
    }
  }

  return {
    start() {
      if (timer) return
      void probeNow()
      timer = setIntervalFn(() => { void probeNow() }, intervalMs)
    },
    stop() {
      if (!timer) return
      clearIntervalFn(timer)
      timer = null
    },
    probeNow,
  }
}
