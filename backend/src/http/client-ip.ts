export function firstHeaderValue(value: unknown): string {
  if (Array.isArray(value)) {
    const found = value.find((item) => typeof item === 'string' && item.trim().length > 0)
    return typeof found === 'string' ? found : ''
  }
  if (typeof value === 'string') return value
  return ''
}

function stripV4Mapped(raw: string): string {
  return raw.replace(/^::ffff:/i, '').trim()
}

type RequestLike = {
  headers?: Record<string, unknown>
  ip?: string
  socket?: { remoteAddress?: string }
  connection?: { remoteAddress?: string }
}

/** Comma-separated peer addresses allowed to supply X-Qrator-IP-Source. */
export function trustedQratorProxyIps(raw = process.env.QRATOR_TRUSTED_PROXIES): Set<string> {
  return new Set(
    String(raw || '')
      .split(',')
      .map((item) => stripV4Mapped(item).toLowerCase())
      .filter((item) => item.length > 0),
  )
}

function peerAddress(req?: RequestLike | null): string {
  return stripV4Mapped(
    String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''),
  ).toLowerCase()
}

/**
 * Client address for rate limits and antifraud.
 * X-Qrator-IP-Source is used only when the TCP peer is listed in QRATOR_TRUSTED_PROXIES.
 * Otherwise Express req.ip, then the socket address.
 * Does not read X-Forwarded-For or X-Real-IP: the first XFF hop is attacker-controlled.
 */
export function resolveRequestClientIp(req?: RequestLike | null): string {
  const peer = peerAddress(req)
  const qrator = stripV4Mapped(firstHeaderValue(req?.headers?.['x-qrator-ip-source']))
  if (qrator && peer && trustedQratorProxyIps().has(peer)) return qrator

  const fromExpress = stripV4Mapped(String(req?.ip || ''))
  if (fromExpress) return fromExpress

  const fromSocket = stripV4Mapped(
    String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''),
  )
  if (fromSocket) return fromSocket

  return 'unknown'
}

export function requestClientIpOrNull(req?: RequestLike | null): string | null {
  const ip = resolveRequestClientIp(req)
  return ip === 'unknown' ? null : ip
}
