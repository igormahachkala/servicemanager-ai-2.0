import type { CookieOptions } from 'express'
import type { JwtSignOptions } from '@nestjs/jwt'

export const REFRESH_COOKIE_NAME = 'sma_refresh_token'
export const DEFAULT_ACCESS_TOKEN_TTL = '15m'
export const DEFAULT_REFRESH_SESSION_TTL_DAYS = 30

export type RefreshSessionRequestContext = {
  userAgent?: string | null
}

export function getAccessTokenTtl(): string {
  return (process.env.AUTH_ACCESS_TOKEN_TTL || process.env.JWT_ACCESS_TOKEN_TTL || DEFAULT_ACCESS_TOKEN_TTL).trim() || DEFAULT_ACCESS_TOKEN_TTL
}

export function accessTokenSignOptions(): JwtSignOptions {
  return { expiresIn: getAccessTokenTtl() as JwtSignOptions['expiresIn'] }
}

export function getRefreshSessionTtlMs(): number {
  const explicitMs = Number(process.env.AUTH_REFRESH_SESSION_TTL_MS)
  if (Number.isFinite(explicitMs) && explicitMs > 0) return Math.trunc(explicitMs)

  const days = Number(process.env.AUTH_REFRESH_SESSION_TTL_DAYS)
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_REFRESH_SESSION_TTL_DAYS
  return Math.trunc(safeDays * 24 * 60 * 60 * 1000)
}

export function refreshSessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + getRefreshSessionTtlMs())
}

export function normalizeUserAgent(value: unknown): string | null {
  const raw = Array.isArray(value) ? value.find((item) => typeof item === 'string' && item.trim()) : value
  const normalized = typeof raw === 'string' ? raw.trim() : ''
  if (!normalized) return null
  return normalized.slice(0, 512)
}

function isProductionLike(): boolean {
  return process.env.NODE_ENV === 'production'
}

function cookieSameSite(): CookieOptions['sameSite'] {
  const raw = (process.env.AUTH_REFRESH_COOKIE_SAMESITE || 'lax').trim().toLowerCase()
  if (raw === 'strict') return 'strict'
  if (raw === 'none') return 'none'
  return 'lax'
}

function cookieSecure(): boolean {
  const raw = (process.env.AUTH_REFRESH_COOKIE_SECURE || '').trim().toLowerCase()
  if (raw === 'true') return true
  if (raw === 'false') return false
  const sameSite = cookieSameSite()
  return isProductionLike() || sameSite === 'none'
}

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: cookieSameSite(),
    path: '/auth',
    maxAge: getRefreshSessionTtlMs(),
  }
}

export function clearRefreshCookieOptions(): CookieOptions {
  const options = refreshCookieOptions()
  return {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
    maxAge: 0,
  }
}

export function readCookieValue(cookieHeader: unknown, name: string): string {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join(';') : typeof cookieHeader === 'string' ? cookieHeader : ''
  if (!raw) return ''

  for (const part of raw.split(';')) {
    const [key, ...valueParts] = part.trim().split('=')
    if (key !== name) continue
    const value = valueParts.join('=')
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return ''
}
