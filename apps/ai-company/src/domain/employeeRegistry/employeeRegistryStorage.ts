/**
 * Employee Registry V2 — localStorage persistence (AI-COMPANY-112A).
 */

import type { EmployeeProfile, EmployeeRegistryStore, EmployeeStatus } from './employeeRegistryTypes'
import { EMPLOYEE_REGISTRY_VERSION, isEmployeeStatus } from './employeeRegistryTypes'
import { EMPLOYEE_REGISTRY_SEED, getSeedEmployeeProfile } from './employeeRegistrySeed'

export const EMPLOYEE_REGISTRY_STORAGE_KEY = 'ai-company-employee-registry'

export const EMPLOYEE_REGISTRY_SYNC_EVENT = 'ai-company-employee-registry-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EMPLOYEE_REGISTRY_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStore(value: unknown): EmployeeRegistryStore | null {
  if (!isRecord(value)) return null
  if (value.version !== EMPLOYEE_REGISTRY_VERSION) return null
  if (!isRecord(value.statusOverrides)) return null

  const statusOverrides: Record<string, EmployeeStatus> = {}
  for (const [key, statusValue] of Object.entries(value.statusOverrides)) {
    if (typeof statusValue === 'string' && isEmployeeStatus(statusValue)) {
      statusOverrides[key] = statusValue
    }
  }

  return {
    version: EMPLOYEE_REGISTRY_VERSION,
    statusOverrides,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso(),
  }
}

export function loadEmployeeRegistryStore(): EmployeeRegistryStore {
  if (typeof window === 'undefined') {
    return { version: EMPLOYEE_REGISTRY_VERSION, statusOverrides: {}, updatedAt: nowIso() }
  }

  try {
    const raw = localStorage.getItem(EMPLOYEE_REGISTRY_STORAGE_KEY)
    if (!raw) {
      return { version: EMPLOYEE_REGISTRY_VERSION, statusOverrides: {}, updatedAt: nowIso() }
    }
    const parsed = parseStore(JSON.parse(raw) as unknown)
    return parsed ?? { version: EMPLOYEE_REGISTRY_VERSION, statusOverrides: {}, updatedAt: nowIso() }
  } catch {
    return { version: EMPLOYEE_REGISTRY_VERSION, statusOverrides: {}, updatedAt: nowIso() }
  }
}

function saveEmployeeRegistryStore(store: EmployeeRegistryStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(EMPLOYEE_REGISTRY_STORAGE_KEY, JSON.stringify(store))
    emitSync()
  } catch {
    /* noop */
  }
}

export function mergeRegistryProfile(
  seed: EmployeeProfile,
  store: EmployeeRegistryStore,
): EmployeeProfile {
  const statusOverride = store.statusOverrides[seed.employeeId]
  if (!statusOverride || statusOverride === seed.status) return seed
  return {
    ...seed,
    status: statusOverride,
    updatedAt: store.updatedAt,
  }
}

export function listSeedEmployeeProfiles(): EmployeeProfile[] {
  const store = loadEmployeeRegistryStore()
  return EMPLOYEE_REGISTRY_SEED.map((seed) => mergeRegistryProfile(seed, store))
}

export function resolveRegistryProfile(employeeId: string): EmployeeProfile | null {
  const seed = getSeedEmployeeProfile(employeeId)
  if (!seed) return null
  return mergeRegistryProfile(seed, loadEmployeeRegistryStore())
}

export function persistEmployeeStatusOverride(employeeId: string, status: EmployeeStatus): EmployeeProfile | null {
  const seed = getSeedEmployeeProfile(employeeId)
  if (!seed) return null

  const store = loadEmployeeRegistryStore()
  const nextStore: EmployeeRegistryStore = {
    ...store,
    statusOverrides: { ...store.statusOverrides, [employeeId]: status },
    updatedAt: nowIso(),
  }
  saveEmployeeRegistryStore(nextStore)
  return mergeRegistryProfile(seed, nextStore)
}
