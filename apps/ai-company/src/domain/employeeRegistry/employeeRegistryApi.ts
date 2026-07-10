/**
 * Employee Registry V2 — public API (AI-COMPANY-112A).
 */

import { loadEmployeeWorkItems } from '../employeeWorkQueue/employeeWorkQueueStorage'
import { loadMaxWorkerLoopRecords } from '../maxWorkerLoop/maxWorkerLoopStorage'
import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import { getPresenceByEmployeeId } from '../presence'
import type { EmployeeCapability, EmployeeProfile, EmployeeStatus } from './employeeRegistryTypes'
import {
  listSeedEmployeeProfiles,
  persistEmployeeStatusOverride,
  resolveRegistryProfile,
} from './employeeRegistryStorage'

function clampWorkload(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function computeLiveWorkload(employeeId: string, fallback: number): number {
  const items = loadEmployeeWorkItems().filter((item) => item.employeeId === employeeId)
  const activeCount = items.filter(
    (item) =>
      item.status === 'pending' ||
      item.status === 'scheduled' ||
      item.status === 'in_progress' ||
      item.status === 'blocked',
  ).length
  const inProgress = items.some((item) => item.status === 'in_progress')

  let workload = fallback
  if (activeCount > 0) {
    workload = Math.min(100, 20 + activeCount * 12 + (inProgress ? 25 : 0))
  }

  if (employeeId === MAX_WORKER_EMPLOYEE_ID) {
    const runningLoop = loadMaxWorkerLoopRecords().some(
      (loop) =>
        loop.status === 'running' ||
        loop.status === 'queued' ||
        loop.status === 'waiting_approval',
    )
    if (runningLoop) workload = Math.max(workload, 75)
  }

  const presence = getPresenceByEmployeeId(employeeId)
  if (presence?.status === 'busy' || presence?.status === 'working') {
    workload = Math.max(workload, 60)
  }

  return clampWorkload(workload)
}

function enrichProfile(profile: EmployeeProfile): EmployeeProfile {
  if (profile.availability !== 'active') return profile
  return {
    ...profile,
    currentWorkload: computeLiveWorkload(profile.employeeId, profile.currentWorkload),
  }
}

export function listEmployees(): EmployeeProfile[] {
  return listSeedEmployeeProfiles()
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map(enrichProfile)
}

export function getEmployee(employeeId: string): EmployeeProfile | null {
  const profile = resolveRegistryProfile(employeeId)
  if (!profile) return null
  return enrichProfile(profile)
}

export function updateEmployeeStatus(
  employeeId: string,
  status: EmployeeStatus,
): EmployeeProfile | null {
  const updated = persistEmployeeStatusOverride(employeeId, status)
  if (!updated) return null
  return enrichProfile(updated)
}

export function listEmployeeCapabilities(employeeId?: string): EmployeeCapability[] {
  if (employeeId) {
    return getEmployee(employeeId)?.capabilities ?? []
  }

  const map = new Map<string, EmployeeCapability>()
  for (const employee of listEmployees()) {
    for (const capability of employee.capabilities) {
      if (!map.has(capability.id)) {
        map.set(capability.id, capability)
        continue
      }
      const existing = map.get(capability.id)
      if (existing && capability.enabled && !existing.enabled) {
        map.set(capability.id, capability)
      }
    }
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function listRegistryRosterEmployees(): EmployeeProfile[] {
  return listEmployees().filter((item) => item.rosterSlotId !== null)
}

export function getRegistryEmployeeBySlot(
  slotId: NonNullable<EmployeeProfile['rosterSlotId']>,
): EmployeeProfile | null {
  return listEmployees().find((item) => item.rosterSlotId === slotId) ?? null
}

export function isRegistryEmployeeActive(profile: EmployeeProfile): boolean {
  return profile.availability === 'active'
}

export { MAX_WORKER_EMPLOYEE_ID }
