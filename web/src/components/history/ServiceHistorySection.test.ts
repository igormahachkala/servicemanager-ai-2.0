import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '../../lib/api'
import { ServiceHistorySection } from './ServiceHistorySection'
import { ServiceHistoryLinks } from './ServiceHistoryLinks'
import type { ServiceHistoryRun } from '../../lib/serviceHistory'

let queryState: Record<string, unknown>
let queryOptions: { queryKey: unknown[] }
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: { queryKey: unknown[] }) => { queryOptions = options; return queryState } }))
const row = {
  id: 'run-1', title: 'Snapshot title', status: 'COMPLETED', reportStatus: 'APPROVED',
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
  location: { id: 'location-1', name: 'Object' }, equipment: { id: 'equipment-1', name: 'Unit' },
  summary: { totalItems: 3, okCount: 1, issueCount: 1, criticalCount: 1, createdTicketsCount: 98765 },
} as ServiceHistoryRun
const props = { target: { equipmentId: 'equipment-1' }, scope: { linkedClientCompanyId: 'client-1' } }
function renderSection() {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ServiceHistorySection, props)))
}
function renderLinks() {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ServiceHistoryLinks, { ...props, row })))
}
beforeEach(() => { queryState = { data: [row], refetch: vi.fn() } })

describe('history SSR rendering (not browser interaction)', () => {
  it('renders a bounded source chain with scoped links and no ticket total', () => {
    const html = renderSection()
    expect(html).toContain('До 20 последних записей обходов')
    expect(html).toContain('Snapshot title')
    expect(html).toContain('/inspection/runs/run-1?linkedClientCompanyId=client-1')
    expect(html).not.toContain('/report')
    expect(html).not.toMatch(/attachment|Исполнитель|Файл/)
    expect(html).not.toContain('98765')
    expect(html).toContain('aria-expanded="false"')
  })
  it.each([403, 404])('suppresses unavailable round section for %i', (status) => {
    queryState = { isError: true, error: new ApiRequestError('secret-error', status) }
    expect(renderSection()).toBe('')
  })
  it('renders transient failures as retry, not absence or cached history', () => {
    queryState = { ...queryState, isError: true, error: new ApiRequestError('secret-error', 503) }
    const html = renderSection()
    expect(html).toContain('Не удалось загрузить историю обходов')
    expect(html).toContain('Повторить')
    expect(html).not.toContain('В загруженной части нет доступных обходов')
    expect(html).not.toContain('secret-error')
    expect(html).not.toContain('Snapshot title')
  })
  it('does not show cached link data while authorizing again', () => {
    queryState = { isFetching: true, data: { plan: { name: 'Old secret' }, tickets: [] } }
    expect(renderLinks()).not.toContain('Old secret')
    expect(renderLinks()).toContain('Проверяем доступ')
  })
  it('displays only sanitized source links and their current canonical status', () => {
    queryState = { data: { plan: null, tickets: [{ id: 't', number: 12, status: 'DONE', path: '/tickets/t?linkedClientCompanyId=client-1' }], incomplete: false } }
    const html = renderLinks()
    expect(html).toContain('Заявка №12')
    expect(html).toContain('Завершена')
    expect(html).toContain('Нет доступной ссылки на план')
  })
})


it('keys links by run and exact scope so a late old response cannot replace the current row', () => {
  queryState = { isPending: true }
  renderLinks()
  expect(queryOptions.queryKey).toEqual(['service-history-links', row.id, row.updatedAt, props.target, props.scope])
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ServiceHistoryLinks, {
    row: { ...row, id: 'run-2' }, target: props.target, scope: { companyId: 'another-scope' },
  })))
  expect(queryOptions.queryKey).toEqual(['service-history-links', 'run-2', row.updatedAt, props.target, { companyId: 'another-scope' }])
})


it('never presents an empty post-scope page as the complete history', () => {
  queryState = { data: [] }
  const html = renderSection()
  expect(html).toContain('В загруженной части нет доступных обходов')
  expect(html).toContain('ограниченная часть истории, не полный список')
  expect(html).not.toContain('вся история')
})


it.each([403, 404])('shows an unavailable source without stale links or network-retry for %i', (status) => {
  queryState = { isError: true, error: new ApiRequestError('hidden denial', status), data: { plan: { name: 'Old secret' } } }
  const html = renderLinks()
  expect(html).toContain('Связи обхода недоступны')
  expect(html).not.toMatch(/Повторить|Old secret|hidden denial/)
})
