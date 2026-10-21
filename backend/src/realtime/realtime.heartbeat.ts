export const REALTIME_HEARTBEAT_MS = 30_000

export const AUTH_INVALID_PAYLOAD = {
  type: 'AUTH_INVALID',
  code: 'AUTH_INVALID',
  message: 'Authentication token is invalid',
} as const

export function heartbeatTimedOut(
  lastPongAt: number,
  now: number,
  intervalMs = REALTIME_HEARTBEAT_MS,
) {
  return now - lastPongAt > intervalMs * 2
}

export type AuthSweepUser = {
  id: string
  companyId: string
}

export type HeartbeatClientView = {
  closed: boolean
  lastPongAt: number
  user: AuthSweepUser | null
  tokenExpiresAt: number | null
}

export type HeartbeatAction = 'skip' | 'timeout' | 'rejectAuth' | 'checkUser' | 'ping'

export function tokenExpiresAtMs(exp: unknown): number | null {
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null
  return exp * 1000
}

export function jwtExpired(tokenExpiresAt: number | null, now: number): boolean {
  if (tokenExpiresAt === null) return true
  return now >= tokenExpiresAt
}

export function heartbeatDecision(client: HeartbeatClientView, now: number): HeartbeatAction {
  if (client.closed) return 'skip'
  if (heartbeatTimedOut(client.lastPongAt, now)) return 'timeout'
  if (!client.user) return 'ping'
  if (jwtExpired(client.tokenExpiresAt, now)) return 'rejectAuth'
  return 'checkUser'
}

export function uniqueUserIds(clients: readonly { user: AuthSweepUser | null }[]): string[] {
  return [...new Set(clients.flatMap((client) => (client.user ? [client.user.id] : [])))]
}

export function indexActiveUsers(rows: readonly AuthSweepUser[]): Set<string> {
  return new Set(rows.map((row) => `${row.id}\0${row.companyId}`))
}

export function userSessionStillValid(
  user: AuthSweepUser | null,
  activeUsers: ReadonlySet<string>,
): boolean {
  if (!user) return false
  return activeUsers.has(`${user.id}\0${user.companyId}`)
}

export async function applyHeartbeatSweep<T extends HeartbeatClientView>(params: {
  clients: Iterable<T>
  now: number
  findActiveUsers: (ids: string[]) => Promise<readonly AuthSweepUser[]>
  onTimeout: (client: T) => void
  onRejectAuth: (client: T) => void
  onPing: (client: T) => void
}) {
  const pending: T[] = []
  for (const client of params.clients) {
    const decision = heartbeatDecision(client, params.now)
    if (decision === 'timeout') params.onTimeout(client)
    else if (decision === 'rejectAuth') params.onRejectAuth(client)
    else if (decision === 'checkUser') pending.push(client)
    else if (decision === 'ping') params.onPing(client)
  }
  if (pending.length === 0) return

  const active = indexActiveUsers(await params.findActiveUsers(uniqueUserIds(pending)))
  for (const client of pending) {
    if (client.closed) continue
    if (!userSessionStillValid(client.user, active)) params.onRejectAuth(client)
    else params.onPing(client)
  }
}
