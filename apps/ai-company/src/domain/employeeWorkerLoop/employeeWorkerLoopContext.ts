/**
 * Generic Employee Worker Loop — execution context (AI-COMPANY-112G).
 */

import { listEmployeeDailyJournalEntries } from '../employeeDailyJournal'
import { buildDefaultEmployeeBrainProfile } from '../employeeBrain/employeeBrainCatalog'
import type { EmployeeBrainProfile } from '../employeeBrain/employeeBrainProfile'
import { buildEmployeeConversationContext } from '../conversationMemory'
import type { EmployeeConversationContext } from '../conversationMemory/conversationMemoryTypes'
import { getEmployeeOperatingDaySnapshot } from '../employeeOperatingDay'
import type { EmployeeOperatingDaySnapshot } from '../employeeOperatingDay/employeeOperatingDay'
import { getEmployee } from '../employeeRegistry'
import type { EmployeeProfile } from '../employeeRegistry/employeeRegistryTypes'
import { loadReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { getOrCreateRuntimeProfile, getRuntimeProfileByEmployeeId } from '../runtime/runtimeStorage'
import type { RuntimeProfile } from '../runtime/runtimeProfile'
import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { resolveEmployee } from '../../mission-control/data/conversation'

export type EmployeeWorkerLoopFeatures = {
  peerConsultation: boolean
  cursorAutomation: boolean
  autonomousDemo: boolean
  toolDispatcher: boolean
}

export type EmployeeWorkerLoopContext = {
  employeeId: string
  registryProfile: EmployeeProfile | null
  brainProfile: EmployeeBrainProfile
  runtimeProfile: RuntimeProfile
  conversationContext: EmployeeConversationContext
  operatingDay: EmployeeOperatingDaySnapshot
  recentJournalCount: number
  recentReports: Report[]
  employeeCodename: string
  features: EmployeeWorkerLoopFeatures
}

export function resolveEmployeeWorkerLoopFeatures(employeeId: string): EmployeeWorkerLoopFeatures {
  const isMax = employeeId === MAX_WORKER_EMPLOYEE_ID
  return {
    peerConsultation: isMax,
    cursorAutomation: isMax,
    autonomousDemo: isMax,
    toolDispatcher: false,
  }
}

export function buildEmployeeWorkerLoopContext(employeeId: string): EmployeeWorkerLoopContext {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const registryProfile = getEmployee(canonical)
  const brainProfile = buildDefaultEmployeeBrainProfile(canonical)
  const runtimeProfile = getOrCreateRuntimeProfile(canonical)
  const conversationContext = buildEmployeeConversationContext(canonical)
  const operatingDay = getEmployeeOperatingDaySnapshot(canonical)
  const recentJournalCount = listEmployeeDailyJournalEntries({
    employeeId: canonical,
    limit: 5,
  }).length
  const recentReports = loadReports()
    .filter((item) => item.employeeId === canonical)
    .slice(0, 5)
  const employeeCodename =
    registryProfile?.displayName ??
    resolveEmployee(canonical)?.codename ??
    canonical

  return {
    employeeId: canonical,
    registryProfile,
    brainProfile,
    runtimeProfile: runtimeProfile ?? getRuntimeProfileByEmployeeId(canonical)!,
    conversationContext,
    operatingDay,
    recentJournalCount,
    recentReports,
    employeeCodename,
    features: resolveEmployeeWorkerLoopFeatures(canonical),
  }
}

export function defaultEmployeeWorkerLoopConstraints(
  employeeId: string,
  context: EmployeeWorkerLoopContext,
): string {
  void employeeId
  const base =
    context.brainProfile.constraints.join(' ') ||
    'V1 Employee Worker Loop: reasoning через Local Ollama; без shell, git, docker и внешних API.'

  if (!context.features.cursorAutomation) {
    return `${base} Без Cursor Automation и Tool Dispatcher.`
  }

  return base
}
