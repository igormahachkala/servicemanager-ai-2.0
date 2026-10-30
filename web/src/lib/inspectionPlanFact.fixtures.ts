import type { InspectionRunListItem, InspectionSchedule } from './api'
import type { PlanFactData, PlanFactFilter } from './inspectionPlanFact'
export const FILTER: PlanFactFilter = {
  locationId: '',
  employeeId: '',
  from: '2026-10-01',
  to: '2026-10-31',
}
export const NOW = Date.parse('2026-10-29T12:00:00Z')
export function run(
  overrides: Partial<InspectionRunListItem> = {},
): InspectionRunListItem {
  return {
    id: 'run-1',
    title: 'Историческое название',
    status: 'COMPLETED',
    scheduleId: 'plan-1',
    dueAt: '2026-10-20T09:00:00Z',
    overdueAt: '2026-10-20T09:00:00Z',
    completedAt: '2026-10-21T10:00:00Z',
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-10-21T10:00:00Z',
    template: { id: 'template-1', name: 'Новое название' },
    location: { id: 'loc-1', name: 'Объект 1', clientCompanyId: 'client-1' },
    performedBy: {
      id: 'worker-old',
      firstName: 'Иван',
      lastName: 'Первый',
      email: 'old@example.test',
    },
    summary: {
      totalItems: 2,
      okCount: 0,
      issueCount: 1,
      criticalCount: 1,
      skippedCount: 0,
      pendingCount: 0,
      createdTicketsCount: 1,
    },
    _count: { items: 2 },
    findings: [
      {
        id: 'item-1',
        title: 'Холодильник',
        status: 'ISSUE',
        ticketId: 'ticket-1',
      },
    ],
    ...overrides,
  }
}
export function plan(
  overrides: Partial<InspectionSchedule> = {},
): InspectionSchedule {
  return {
    id: 'plan-1',
    companyId: 'provider-1',
    name: 'Текущий план',
    frequency: 'DAILY',
    startDate: '2026-10-01T09:00:00Z',
    nextDueAt: '2026-10-30T09:00:00Z',
    leadTimeDays: 0,
    graceDays: 0,
    isActive: true,
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-28T09:00:00Z',
    template: { id: 'template-1', name: 'Новое название' },
    location: { id: 'loc-1', name: 'Объект 1', clientCompanyId: 'client-1' },
    assignedTo: {
      id: 'worker-new',
      firstName: 'Пётр',
      lastName: 'Второй',
      email: 'new@example.test',
    },
    overdueAt: '2026-10-30T09:00:00Z',
    lastRun: {
      id: 'run-1',
      dueAt: '2026-10-20T09:00:00Z',
      status: 'COMPLETED',
    },
    ...overrides,
  }
}
export function data(overrides: Partial<PlanFactData> = {}): PlanFactData {
  return {
    schedules: [plan()],
    overdueSchedules: [],
    completed: [run()],
    active: [],
    ...overrides,
  }
}
