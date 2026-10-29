import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { InspectionSchedule } from '../lib/api'
import { formatOccurrenceDate } from '../lib/inspectionScheduleRescheduling'
import { InspectionScheduleRescheduleAction, InspectionScheduleRescheduler, NextOccurrenceConfirmation } from './InspectionScheduleRescheduler'

const schedule: InspectionSchedule = {
  id: 'schedule-1', companyId: 'provider-1', name: 'Обход', frequency: 'WEEKLY',
  startDate: '2099-10-20T10:15:00Z', nextDueAt: '2099-11-03T10:15:00Z',
  leadTimeDays: 0, graceDays: 0, isActive: true, createdAt: '2099-10-01T09:00:00Z',
  updatedAt: '2099-10-29T09:00:00Z', lastGeneratedAt: '2099-10-27T09:00:00Z', lastRunId: 'run-1',
  lastRun: { id: 'run-1', status: 'COMPLETED', dueAt: '2099-10-27T10:15:00Z', completedAt: '2099-10-27T10:20:00Z' },
  template: { id: 'template-1', name: 'Осмотр' }, location: { id: 'location-1', name: 'Объект' },
  equipment: null, assignedTo: null, _count: { runs: 1 },
}
function renderEditor(value?: InspectionSchedule, error?: Error) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } })
  if (value) client.setQueryData(['inspection-schedule-reschedule', value.id], value)
  if (error) client.getQueryCache().find({ queryKey: ['inspection-schedule-reschedule', schedule.id] })
    ?.setState({ status: 'error', error })
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(InspectionScheduleRescheduler, { scheduleId: schedule.id, onCancel: () => {}, onSaved: () => {} })))
  client.clear()
  return html
}

describe('next-occurrence rendered states (SSR, not browser interaction)', () => {
  it('renders next date/time, current date and recurrence/history scope only', () => {
    const html = renderEditor(schedule)
    for (const label of ['Перенести следующий срок', 'Текущий срок:', 'Новая дата', 'Новое время',
      'часовом поясе вашего устройства', 'льготные дни и история выполненных обходов не меняются',
      'по прежнему расписанию от начала плана', 'Пропущенные прошлые обходы не создаются',
      'Перейти к подтверждению', 'Отмена']) expect(html).toContain(label)
    expect(html).toContain(formatOccurrenceDate(schedule.nextDueAt))
    expect(html).not.toContain('Название плана')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('Подтвердить перенос')
  })
  it('renders both exact instants in the separate confirmation step', () => {
    const input = { expectedNextDueAt: schedule.nextDueAt, expectedUpdatedAt: schedule.updatedAt,
      nextDueAt: '2099-11-05T14:30:00Z' }
    const html = renderToStaticMarkup(createElement(NextOccurrenceConfirmation, { input }))
    for (const label of ['Подтвердите перенос следующего срока', 'Было', 'Станет',
      formatOccurrenceDate(input.expectedNextDueAt), formatOccurrenceDate(input.nextDueAt)]) expect(html).toContain(label)
  })
  it('shows loading and retry/cancel rather than editing stale card data', () => {
    expect(renderEditor()).toContain('Загружаем план для переноса')
    expect(renderEditor()).toContain('Отмена')
    expect(renderEditor()).not.toContain('<form')
    const failed = renderEditor(schedule, new Error('Plan unavailable'))
    expect(failed).toContain('Plan unavailable')
    expect(failed).toContain('Повторить загрузку')
    expect(failed).not.toContain('<form')
  })
  it('hides and blocks retired, one-off, never-started and already-started schedules', () => {
    for (const value of [{ ...schedule, isActive: false }, { ...schedule, frequency: 'ONCE' as const },
      { ...schedule, _count: { runs: 0 }, lastRun: null },
      { ...schedule, lastRun: { id: 'run-2', status: 'IN_PROGRESS' as const } }]) {
      expect(renderEditor(value)).toContain('Перенос недоступен')
      expect(renderEditor(value)).toContain('Закрыть и обновить план')
      expect(renderEditor(value)).not.toContain('<form')
      const client = new QueryClient()
      expect(renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(InspectionScheduleRescheduleAction, { schedule: value })))).toBe('')
      client.clear()
    }
  })
})

describe('next-occurrence integration invariants (source checks, not runtime interaction)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/InspectionScheduleRescheduler.tsx'), 'utf8')
  const page = readFileSync(resolve(process.cwd(), 'src/views/InspectionSchedulesPage.tsx'), 'utf8')
  it('requires confirmation, blocks duplicate writes and dismissal during saving', () => {
    for (const fragment of ['if (!confirmation) {', 'setConfirmation(input)', 'saveM.mutate(confirmation)',
      'if (saving.current || conflict) return', 'saving.current = true',
      'disabled={saveM.isPending} onClick={onCancel}', 'retry: false']) expect(source).toContain(fragment)
    expect(source).not.toContain('updateInspectionSchedule(')
    expect(source).not.toContain('editNotStartedInspectionSchedule(')
  })
  it('retains stale drafts, requires explicit recovery and remounts on navigation', () => {
    for (const fragment of ['useState(() => nextOccurrenceDraft(schedule))',
      'if (!open && !canRescheduleNextOccurrence(schedule)) return null', 'failure.status === 409',
      'setConflict(true)', 'Ваш выбор оставлен ниже',
      "qc.removeQueries({ queryKey: ['inspection-schedule-reschedule', schedule.id], exact: true })"]) expect(source).toContain(fragment)
    expect(source).not.toContain('setDraft(nextOccurrenceDraft(schedule))')
    // A previous write may have committed even when its response was lost.
    expect(source).not.toContain('Перенос не сохранён')
    expect(source).toContain('Проверьте актуальный срок')
    expect(page).toContain('key={`${routerLocation.key}-next-${s.id}`}')
    expect(page).toContain('key={`${routerLocation.key}-${s.id}`}')
  })
  it('invalidates schedule consumers and preserves canonical gates and import order', () => {
    for (const key of ['inspection-schedules', 'location-card-schedules', 'mobile-inspection-today', 'work-calendar']) expect(source).toContain(`'${key}'`)
    expect(page).toMatch(/\{canManage \? \(\s*<>\s*<InspectionScheduleEditAction[\s\S]*?<InspectionScheduleRescheduleAction/)
    const editor = page.indexOf("from '../components/InspectionScheduleEditor'")
    expect(page.indexOf("from 'react-router-dom'")).toBeLessThan(editor)
    expect(editor).toBeLessThan(page.indexOf("from '../lib/api'"))
  })
})
