import type { EventSourceType } from './eventSource'
import type { EventType } from './eventType'

export const EVENT_SEVERITIES = ['info', 'success', 'warn', 'error'] as const

export type EventSeverity = (typeof EVENT_SEVERITIES)[number]

export type EventMetadata = Record<string, string | number | boolean | null>

export type CompanyEvent = {
  id: string
  type: EventType
  sourceType: EventSourceType
  sourceId: string
  employeeId: string | null
  workspaceId: string | null
  reportId: string | null
  metadata: EventMetadata
  severity: EventSeverity
  createdAt: string
}

export type EventScope = 'company' | 'workspace' | 'employee'

export type EventFilter = {
  dateFrom?: string
  dateTo?: string
  employeeId?: string | 'all'
  workspaceId?: string | 'all'
  severity?: EventSeverity | 'all'
  type?: EventType | 'all'
}

export type EventDateGroup = {
  dateKey: string
  dateLabel: string
  events: CompanyEvent[]
}
