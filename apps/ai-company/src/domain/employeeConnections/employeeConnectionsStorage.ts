/**
 * Employee Connections Center — localStorage persistence (AI-COMPANY-115).
 * Non-secret data only — secrets live in trusted bridge.
 */

import type {
  CompanyConnection,
  EmployeeConnectionAuditEvent,
  EmployeeConnectionGrant,
  EmployeeConnectionsStore,
} from './employeeConnectionsTypes'
import { EMPLOYEE_CONNECTIONS_STORE_VERSION } from './employeeConnectionsTypes'

export const EMPLOYEE_CONNECTIONS_STORAGE_KEY = 'ai-company-employee-connections'
export const EMPLOYEE_CONNECTIONS_SYNC_EVENT = 'ai-company-employee-connections-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EMPLOYEE_CONNECTIONS_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStore(value: unknown): EmployeeConnectionsStore | null {
  if (!isRecord(value) || value.version !== EMPLOYEE_CONNECTIONS_STORE_VERSION) return null
  return {
    version: EMPLOYEE_CONNECTIONS_STORE_VERSION,
    connections: Array.isArray(value.connections) ? (value.connections as CompanyConnection[]) : [],
    grants: Array.isArray(value.grants) ? (value.grants as EmployeeConnectionGrant[]) : [],
    auditEvents: Array.isArray(value.auditEvents)
      ? (value.auditEvents as EmployeeConnectionAuditEvent[])
      : [],
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso(),
  }
}

export function emptyEmployeeConnectionsStore(): EmployeeConnectionsStore {
  return {
    version: EMPLOYEE_CONNECTIONS_STORE_VERSION,
    connections: [],
    grants: [],
    auditEvents: [],
    updatedAt: nowIso(),
  }
}

export function loadEmployeeConnectionsStore(): EmployeeConnectionsStore {
  if (typeof window === 'undefined') return emptyEmployeeConnectionsStore()
  try {
    const raw = localStorage.getItem(EMPLOYEE_CONNECTIONS_STORAGE_KEY)
    if (!raw) return emptyEmployeeConnectionsStore()
    return parseStore(JSON.parse(raw) as unknown) ?? emptyEmployeeConnectionsStore()
  } catch {
    return emptyEmployeeConnectionsStore()
  }
}

export function saveEmployeeConnectionsStore(store: EmployeeConnectionsStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      EMPLOYEE_CONNECTIONS_STORAGE_KEY,
      JSON.stringify({ ...store, updatedAt: nowIso() }),
    )
    emitSync()
  } catch {
    /* noop */
  }
}

export function appendAuditEvent(
  store: EmployeeConnectionsStore,
  event: Omit<EmployeeConnectionAuditEvent, 'id' | 'at'> & { at?: string },
): EmployeeConnectionsStore {
  const auditEvent: EmployeeConnectionAuditEvent = {
    id: `eca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: event.at ?? nowIso(),
    type: event.type,
    actorId: event.actorId,
    employeeId: event.employeeId,
    connectionId: event.connectionId,
    providerId: event.providerId,
    capabilityIds: event.capabilityIds,
    environment: event.environment,
    reasonCode: event.reasonCode,
    metadata: event.metadata,
  }
  return {
    ...store,
    auditEvents: [auditEvent, ...store.auditEvents].slice(0, 500),
    updatedAt: nowIso(),
  }
}

export function listCompanyConnections(store = loadEmployeeConnectionsStore()): CompanyConnection[] {
  return store.connections
}

export function getCompanyConnection(
  connectionId: string,
  store = loadEmployeeConnectionsStore(),
): CompanyConnection | null {
  return store.connections.find((connection) => connection.id === connectionId) ?? null
}

export function listEmployeeGrants(
  employeeId: string,
  store = loadEmployeeConnectionsStore(),
): EmployeeConnectionGrant[] {
  return store.grants.filter((grant) => grant.employeeId === employeeId)
}

export function getEmployeeGrant(
  grantId: string,
  store = loadEmployeeConnectionsStore(),
): EmployeeConnectionGrant | null {
  return store.grants.find((grant) => grant.id === grantId) ?? null
}

export function findGrantForEmployeeConnection(
  employeeId: string,
  connectionId: string,
  store = loadEmployeeConnectionsStore(),
): EmployeeConnectionGrant | null {
  return (
    store.grants.find(
      (grant) => grant.employeeId === employeeId && grant.connectionId === connectionId && grant.enabled,
    ) ?? null
  )
}

export function upsertCompanyConnection(
  connection: CompanyConnection,
  store = loadEmployeeConnectionsStore(),
): EmployeeConnectionsStore {
  const exists = store.connections.some((item) => item.id === connection.id)
  const connections = exists
    ? store.connections.map((item) => (item.id === connection.id ? connection : item))
    : [...store.connections, connection]
  return { ...store, connections, updatedAt: nowIso() }
}

export function upsertEmployeeGrant(
  grant: EmployeeConnectionGrant,
  store = loadEmployeeConnectionsStore(),
): EmployeeConnectionsStore {
  const exists = store.grants.some((item) => item.id === grant.id)
  const grants = exists
    ? store.grants.map((item) => (item.id === grant.id ? grant : item))
    : [...store.grants, grant]
  return { ...store, grants, updatedAt: nowIso() }
}

export function removeCompanyConnection(
  connectionId: string,
  store = loadEmployeeConnectionsStore(),
): EmployeeConnectionsStore {
  return {
    ...store,
    connections: store.connections.filter((connection) => connection.id !== connectionId),
    grants: store.grants.filter((grant) => grant.connectionId !== connectionId),
    updatedAt: nowIso(),
  }
}

export function removeEmployeeGrant(
  grantId: string,
  store = loadEmployeeConnectionsStore(),
): EmployeeConnectionsStore {
  return {
    ...store,
    grants: store.grants.filter((grant) => grant.id !== grantId),
    updatedAt: nowIso(),
  }
}
