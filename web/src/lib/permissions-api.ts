import { ApiRequestError, getBaseUrl, getToken } from './api'

export type PermissionsScopeSummary = {
  mode: 'tenant_wide' | 'bound_locations'
  linkedClientCount: number
}

export type PermissionsAuditUserRef = {
  userId: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

export type PermissionsAuditItem = {
  id: string
  createdAt: string
  reason: string
  addedPermissionCodes: string[]
  removedPermissionCodes: string[]
  actor: PermissionsAuditUserRef | null
}

export type PermissionsAuditResponse = {
  userId: string
  targetUser: PermissionsAuditUserRef | null
  items: PermissionsAuditItem[]
  meta: {
    total: number
    take: number
    skip: number
    generatedAt?: string
  }
}

export type PermissionsUserRow = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  role: string
  isActive: boolean
  effectiveCodes: string[]
  overrideCodes: string[]
  effectivePermissionsCount?: number
  overridesCount?: number
  scopeSummary?: PermissionsScopeSummary
}

export type PermissionsUsersResponse = {
  company?: {
    id?: string
    name?: string
    type?: string
  }
  meta?: {
    total?: number
    companyId?: string
    companyType?: string
  }
  users: PermissionsUserRow[]
  raw: unknown
}

function extractErrorMessage(data: any, status: number) {
  const message = data?.message
    ? Array.isArray(data.message)
      ? data.message.join(', ')
      : String(data.message)
    : `HTTP ${status}`
  return message
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (init?.body) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${getBaseUrl()}${path}`, { ...init, headers })
  const text = await response.text()
  let data: any = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    throw new ApiRequestError(extractErrorMessage(data, response.status), response.status)
  }

  return data as T
}

function asArray<T = unknown>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value as T[]
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeCodes(value: unknown): string[] {
  return asArray<unknown>(value)
    .map((item) => asString(item).trim())
    .filter(Boolean)
}

function normalizeScopeSummary(input: any): PermissionsScopeSummary | undefined {
  const summary = input?.scopeSummary
  if (!summary || typeof summary !== 'object') return undefined
  const mode = summary.mode === 'bound_locations' ? 'bound_locations' : 'tenant_wide'
  const linkedClientCount = Number(summary.linkedClientCount)
  return {
    mode,
    linkedClientCount: Number.isFinite(linkedClientCount) ? linkedClientCount : 0,
  }
}

function normalizeUserRow(input: any): PermissionsUserRow | null {
  const user = input?.user && typeof input.user === 'object' ? input.user : input
  const id = asString(user?.id || input?.userId).trim()
  if (!id) return null

  const permissions = input?.permissions || {}
  const effectiveCodes = normalizeCodes(
    permissions.effectiveCodes || input?.effectivePermissions || input?.grants?.effectivePermissions,
  )
  const overrideCodes = normalizeCodes(
    permissions.overrideCodes ||
      input?.overrideCodes ||
      asArray<any>(input?.overrides).map((item) => item?.code),
  )

  const effectivePermissionsCount = Number(
    input?.effectivePermissionsCount ?? (effectiveCodes.length > 0 ? effectiveCodes.length : undefined),
  )
  const overridesCount = Number(
    input?.overridesCount ?? (overrideCodes.length > 0 ? overrideCodes.length : undefined),
  )

  return {
    id,
    email: asString(user?.email || input?.email),
    firstName: user?.firstName ?? input?.firstName ?? null,
    lastName: user?.lastName ?? input?.lastName ?? null,
    role: asString(user?.role || input?.role),
    isActive: user?.isActive !== false && input?.isActive !== false,
    effectiveCodes,
    overrideCodes,
    effectivePermissionsCount: Number.isFinite(effectivePermissionsCount) ? effectivePermissionsCount : effectiveCodes.length,
    overridesCount: Number.isFinite(overridesCount) ? overridesCount : overrideCodes.length,
    scopeSummary: normalizeScopeSummary(input),
  }
}

export async function getPermissionsUsers(params?: {
  companyId?: string
  q?: string
  role?: string
  isActive?: boolean
  hasOverrides?: boolean
}): Promise<PermissionsUsersResponse> {
  const search = new URLSearchParams()
  if (params?.companyId) search.set('companyId', params.companyId)
  if (params?.q) search.set('q', params.q)
  if (params?.role) search.set('role', params.role)
  if (typeof params?.isActive === 'boolean') search.set('isActive', params.isActive ? 'true' : 'false')
  if (typeof params?.hasOverrides === 'boolean') search.set('hasOverrides', params.hasOverrides ? 'true' : 'false')
  const suffix = search.toString() ? `?${search.toString()}` : ''
  const payload = await request<any>(`/permissions/users${suffix}`)

  const rowsSource = asArray<any>(payload?.users).length > 0 ? payload.users : asArray<any>(payload?.items)
  const users = rowsSource
    .map((row: any) => normalizeUserRow(row))
    .filter((row: PermissionsUserRow | null): row is PermissionsUserRow => !!row)

  return {
    company: payload?.company,
    meta: payload?.meta,
    users,
    raw: payload,
  }
}

export async function getPermissionsUserEffective(userId: string, companyId?: string) {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<any>(`/permissions/users/${encodeURIComponent(userId)}/effective${suffix}`)
}

export async function getPermissionsUserOverrides(userId: string, companyId?: string) {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<any>(`/permissions/users/${encodeURIComponent(userId)}/overrides${suffix}`)
}

export async function getPermissionsUserScopes(userId: string, companyId?: string) {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<any>(`/permissions/users/${encodeURIComponent(userId)}/scopes${suffix}`)
}

export async function getPermissionsUserAudit(
  userId: string,
  params?: { companyId?: string; take?: number; skip?: number },
): Promise<PermissionsAuditResponse> {
  const search = new URLSearchParams()
  if (params?.companyId) search.set('companyId', params.companyId)
  if (typeof params?.take === 'number') search.set('take', String(params.take))
  if (typeof params?.skip === 'number') search.set('skip', String(params.skip))
  const suffix = search.toString() ? `?${search.toString()}` : ''
  const payload = await request<any>(`/permissions/users/${encodeURIComponent(userId)}/audit${suffix}`)

  const items = asArray<any>(payload?.items).map((row) => ({
    id: asString(row?.id),
    createdAt: asString(row?.createdAt),
    reason: asString(row?.reason),
    addedPermissionCodes: normalizeCodes(row?.addedPermissionCodes),
    removedPermissionCodes: normalizeCodes(row?.removedPermissionCodes),
    actor: normalizeAuditUserRef(row?.actor),
  }))

  return {
    userId: asString(payload?.userId),
    targetUser: normalizeAuditUserRef(payload?.targetUser),
    items,
    meta: {
      total: Number(payload?.meta?.total) || items.length,
      take: Number(payload?.meta?.take) || items.length,
      skip: Number(payload?.meta?.skip) || 0,
      generatedAt: asString(payload?.meta?.generatedAt) || undefined,
    },
  }
}

function normalizeAuditUserRef(input: any): PermissionsAuditUserRef | null {
  if (!input || typeof input !== 'object') return null
  const userId = asString(input.userId || input.id).trim()
  if (!userId) return null
  return {
    userId,
    email: asString(input.email),
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
  }
}

export async function putPermissionsUserOverrides(
  userId: string,
  body: { grantPermissionCodes: string[]; reason: string },
  companyId?: string,
) {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<any>(`/permissions/users/${encodeURIComponent(userId)}/overrides${suffix}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** PUT route exists on backend (not Nest "Cannot PUT ..." 404). Does not mutate data. */
export async function probePermissionsOverridesWriteSupport(companyId?: string): Promise<boolean> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(
    `${getBaseUrl()}/permissions/users/${encodeURIComponent('00000000-0000-4000-8000-000000000099')}/overrides${suffix}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({}),
    },
  )

  if (response.status !== 404) return true

  const text = await response.text()
  return !text.includes('Cannot PUT')
}

/** Audit read route exists on backend. */
export async function probePermissionsAuditReadSupport(companyId?: string): Promise<boolean> {
  const search = new URLSearchParams()
  if (companyId) search.set('companyId', companyId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(
    `${getBaseUrl()}/permissions/users/${encodeURIComponent('00000000-0000-4000-8000-000000000099')}/audit${suffix}`,
    { method: 'GET', headers },
  )

  if (response.status !== 404) return true

  const text = await response.text()
  return !text.includes('Cannot GET')
}

export function extractEffectiveCodes(payload: any): string[] {
  return normalizeCodes(
    payload?.grants?.effectivePermissions ||
      payload?.permissions?.effectiveCodes ||
      payload?.effectiveCodes ||
      payload?.effectivePermissions,
  )
}

export function extractRoleCodes(payload: any): string[] {
  return normalizeCodes(
    payload?.grants?.rolePermissions ||
      payload?.permissions?.roleCodes ||
      payload?.rolePermissions,
  )
}

export function extractOverrideCodes(payload: any): string[] {
  const direct = normalizeCodes(payload?.overrideCodes || payload?.permissions?.overrideCodes)
  if (direct.length > 0) return direct

  const overrides = asArray<any>(payload?.overrides || payload?.details?.userPermissions || payload?.userPermissions)
  return overrides
    .map((row: any) => asString(row?.code).trim())
    .filter(Boolean)
}

export function extractPermissionDetails(payload: any): Array<{ code: string; name?: string; description?: string }> {
  const roleDetails = asArray<any>(payload?.details?.rolePermissions)
  const userDetails = asArray<any>(payload?.details?.userPermissions || payload?.overrides)
  const merged = [...roleDetails, ...userDetails]
  return merged
    .map((row) => ({
      code: asString(row?.code).trim(),
      name: asString(row?.name) || undefined,
      description: asString(row?.description) || undefined,
    }))
    .filter((row) => row.code)
}
