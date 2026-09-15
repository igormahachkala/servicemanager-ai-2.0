export const REALTIME_HEARTBEAT_MS = 30_000

export function heartbeatTimedOut(
  lastPongAt: number,
  now: number,
  intervalMs = REALTIME_HEARTBEAT_MS,
) {
  return now - lastPongAt > intervalMs * 2
}
