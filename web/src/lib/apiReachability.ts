/**
 * Last observed API reachability, shared without coupling the API client to
 * the mobile offline runtime. A received HTTP response means the API is
 * reachable even when its status is 4xx/5xx; a transport failure does not.
 */

export type ApiReachabilityListener = (reachable: boolean) => void

const listeners = new Set<ApiReachabilityListener>()
let lastReachable: boolean | null = null

export function reportApiReachability(reachable: boolean): void {
  if (lastReachable === reachable) return
  lastReachable = reachable
  for (const listener of listeners) listener(reachable)
}

export function subscribeApiReachability(listener: ApiReachabilityListener): () => void {
  listeners.add(listener)
  if (lastReachable !== null) listener(lastReachable)
  return () => listeners.delete(listener)
}
