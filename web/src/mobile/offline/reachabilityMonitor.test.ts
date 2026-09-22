import { describe, expect, it, vi } from 'vitest'

import { createReachabilityMonitor } from './reachabilityMonitor'

describe('iOS PWA API reachability monitor', () => {
  it('reports offline when navigator remains online but the API probe fails', async () => {
    const onResult = vi.fn()
    const monitor = createReachabilityMonitor({
      probe: vi.fn().mockResolvedValue(false),
      interfaceOnline: () => true,
      onResult,
      setIntervalFn: vi.fn(() => 1 as never),
      clearIntervalFn: vi.fn(),
    })

    monitor.start()
    await monitor.probeNow()

    expect(onResult).toHaveBeenLastCalledWith(false)
  })

  it('does not hit the API when the browser already reports offline', async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const onResult = vi.fn()
    const monitor = createReachabilityMonitor({
      probe,
      interfaceOnline: () => false,
      onResult,
      setIntervalFn: vi.fn(() => 1 as never),
      clearIntervalFn: vi.fn(),
    })

    await monitor.probeNow()

    expect(probe).not.toHaveBeenCalled()
    expect(onResult).toHaveBeenCalledWith(false)
  })

  it('serializes probes so one page has one effective reachability processor', async () => {
    let release!: (value: boolean) => void
    const pending = new Promise<boolean>((resolve) => { release = resolve })
    const probe = vi.fn(() => pending)
    const monitor = createReachabilityMonitor({
      probe,
      interfaceOnline: () => true,
      onResult: vi.fn(),
    })

    const first = monitor.probeNow()
    const second = monitor.probeNow()
    expect(probe).toHaveBeenCalledOnce()
    release(true)
    await Promise.all([first, second])
  })
})
