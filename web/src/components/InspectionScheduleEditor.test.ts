import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { InspectionSchedule } from '../lib/api'
import { InspectionScheduleEditAction, InspectionScheduleEditor } from './InspectionScheduleEditor'

const schedule: InspectionSchedule = {
  id: 'schedule-1', companyId: 'provider-1', name: 'Плановый обход', frequency: 'ONCE',
  startDate: '2026-11-03T10:15:00Z', nextDueAt: '2026-11-03T10:15:00Z',
  leadTimeDays: 0, graceDays: 0, isActive: true, createdAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-29T09:00:00Z', lastGeneratedAt: null, lastRunId: null, lastRun: null,
  template: { id: 'template-1', name: 'Осмотр' },
  location: { id: 'location-1', clientCompanyId: 'client-1', name: 'Объект' },
  equipment: null, assignedTo: null, _count: { runs: 0 },
}
function renderEditor(value?: InspectionSchedule, seedOptions = true, equipmentFailure = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } })
  if (value) client.setQueryData(['inspection-schedule-edit', value.id], value)
  if (seedOptions) {
    client.setQueryData(['inspection-templates'], [{ id: 'template-1', name: 'Осмотр', isActive: true }])
    client.setQueryData(['linked-clients'], [{ id: 'contract-1', clientCompany: { id: 'client-1', name: 'Клиент' } }])
    client.setQueryData(['locations', 'client-1'], [schedule.location])
    client.setQueryData(['round-assignable-technicians', 'location-1'], [])
    client.setQueryData(['inspection-schedule-edit-equipment', 'location-1', 'client-1'], [])
  }
  if (equipmentFailure) {
    client.getQueryCache().find({ queryKey: ['inspection-schedule-edit-equipment', 'location-1', 'client-1'] })
      ?.setState({ status: 'error', error: new Error('Equipment unavailable') })
  }
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(InspectionScheduleEditor, { scheduleId: schedule.id, onCancel: () => {}, onSaved: () => {} })))
  client.clear()
  return html
}

describe('schedule editor rendered states (SSR, not browser interaction)', () => {
  it('renders a prefilled form with bounded scope and genuinely optional equipment', () => {
    const html = renderEditor(schedule)
    for (const label of ['Изменить план до первого обхода', 'ещё не начинали ни одного обхода', 'Название плана',
      'Оборудование (необязательно)', 'Без оборудования', 'Без назначения', 'Сохранить изменения', 'Отмена']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('value="Плановый обход"')
    expect(html).toContain('На этой точке нет оборудования')
    expect(html).not.toContain('Не удалось загрузить')
    expect(html).not.toContain('Перенести текущий обход')
  })
  it('shows loading and cancel before canonical schedule data is known', () => {
    const html = renderEditor(undefined)
    expect(html).toContain('Загружаем план для изменения')
    expect(html).toContain('Отмена')
    expect(html).not.toContain('<form')
  })
  it('does not render a form when a run started after the card loaded', () => {
    const html = renderEditor({ ...schedule, _count: { runs: 1 }, lastRunId: 'run-1' })
    expect(html).toContain('Этот план больше нельзя изменить до начала')
    expect(html).toContain('Закрыть и обновить план')
    expect(html).not.toContain('<form')
  })
  it('disables save while lookups are unknown, not successful empty equipment', () => {
    const html = renderEditor(schedule, false)
    expect(html).toContain('Загружаем доступные значения')
    expect(html).not.toContain('На этой точке нет оборудования')
    expect(html).toMatch(/<button type="submit" disabled="">Сохранить изменения/)
  })
  it('keeps a selected item visible on lookup failure and blocks save without claiming equipment is empty', () => {
    const html = renderEditor({ ...schedule, equipment: { id: 'equipment-1', name: 'Насос' } }, true, true)
    expect(html).toContain('Не удалось загрузить доступные значения')
    expect(html).toContain('Выбор сохранён')
    expect(html).toContain('Насос')
    expect(html).not.toContain('На этой точке нет оборудования')
    expect(html).toMatch(/<button type="submit" disabled="">Сохранить изменения/)
  })
  it('offers no edit trigger for history-bearing or retired schedules', () => {
    const client = new QueryClient()
    for (const value of [{ ...schedule, isActive: false }, { ...schedule, _count: { runs: 2 } }]) {
      expect(renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(InspectionScheduleEditAction, { schedule: value })))).toBe('')
    }
    client.clear()
  })
})

describe('schedule editor integration safety', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/InspectionScheduleEditor.tsx'), 'utf8')
  const page = readFileSync(resolve(process.cwd(), 'src/views/InspectionSchedulesPage.tsx'), 'utf8')
  it('guards immediate duplicate submits, cancellation in flight, and write retries', () => {
    expect(source).toContain('if (saving.current || conflict')
    expect(source).toContain('saving.current = true')
    expect(source).toContain('retry: false')
    expect(source).toContain('disabled={saveM.isPending} onClick={onCancel}')
    expect(source).not.toContain('updateInspectionSchedule(')
  })
  it('uses a stable snapshot, explicit 409 recovery, and route-key remount after navigation', () => {
    expect(source).toContain('useState(() => scheduleEditDraft(schedule))')
    expect(source).toContain('if (!open && !canEditNotStartedSchedule(schedule)) return null')
    expect(source).toContain('failure.status === 409')
    expect(source).toContain('setConflict(true)')
    expect(source).toContain("qc.removeQueries({ queryKey: ['inspection-schedule-edit', schedule.id], exact: true })")
    expect(source).toContain('Изменения не сохранены')
    expect(source).not.toContain('setDraft(scheduleEditDraft(schedule))')
    expect(page).toContain('key={`${routerLocation.key}-${s.id}`}')
    expect(page).toContain('id={`schedule-${s.id}`}')
  })
  it('refreshes existing schedule consumers after success', () => {
    for (const key of ['inspection-schedules', 'location-card-schedules', 'mobile-inspection-today', 'work-calendar']) {
      expect(source).toContain(`'${key}'`)
    }
  })
})
