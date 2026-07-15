/**
 * Employee Connections Center — observability (AI-COMPANY-115).
 */

import type {
  EmployeeConnectionAuditEvent,
  EmployeeConnectionAuditEventType,
} from './employeeConnectionsTypes'

function nowIso(): string {
  return new Date().toISOString()
}

export function createEmployeeConnectionAuditEvent(
  type: EmployeeConnectionAuditEventType,
  input: Omit<EmployeeConnectionAuditEvent, 'id' | 'at' | 'type'>,
): EmployeeConnectionAuditEvent {
  return {
    id: `eca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: nowIso(),
    type,
    ...input,
  }
}

export function formatEmployeeConnectionAuditEvent(event: EmployeeConnectionAuditEvent): string {
  return `[employee-connections:${event.type}] connection=${event.connectionId ?? 'none'} employee=${event.employeeId ?? 'none'}`
}
