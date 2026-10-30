import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { EquipmentHistoryEntry, EquipmentHistoryResponse } from '../../lib/api'
import { MobileEquipmentHistory } from '../../mobile/MobileEquipmentPage'
import { EquipmentHistoryTab } from './EquipmentHistoryTab'

function entry(overrides: Partial<EquipmentHistoryEntry> = {}): EquipmentHistoryEntry {
  return {
    ticketId: 'internal-request-id', createdAt: '2026-09-01T08:00:00Z', problem: 'Не охлаждает',
    result: 'Промыт теплообменник', resultAt: '2026-09-02T09:00:00Z', workReports: [],
    partsInstalled: [{ name: 'Датчик', serialNumber: 'S-1', quantity: '2' }],
    partsRemoved: [{ name: 'Старый датчик', serialNumber: null, quantity: '1' }],
    ...overrides,
  }
}

function page(tickets: EquipmentHistoryEntry[], nextCursor: string | null = null): EquipmentHistoryResponse {
  return { equipment: { id: 'equipment-1', name: 'Холодильник', companyId: 'client-1', locationId: 'location-1' }, tickets,
    page: { limit: 2, hasMore: !!nextCursor, nextCursor } }
}

function render(mobile: boolean, pages: EquipmentHistoryResponse[], scope = 'client-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const key = [mobile ? 'mobile-equipment-history' : 'equipment-history', 'equipment-1', scope]
  client.setQueryData(key, { pages, pageParams: pages.map((_, i) => i === 0 ? undefined : 'cursor') })
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      {mobile ? <MobileEquipmentHistory equipmentId="equipment-1" scopeCompanyId={scope} />
        : <EquipmentHistoryTab equipmentId="equipment-1" scopeCompanyId={scope} />}
    </QueryClientProvider>,
  )
  client.clear()
  return html
}

it('keeps legacy attachment-section rendering safe during a full-stack rollout', () => {
  // Cached production UI uses this unconditional read before rendering any report.
  const legacyEntry: { workReports: { url: string; originalName: string }[] } = entry()
  const html = renderToStaticMarkup(<div>{legacyEntry.workReports.length > 0
    ? legacyEntry.workReports.map((file) => <a key={file.url} href={file.url}>{file.originalName}</a>)
    : null}</div>)
  expect(legacyEntry.workReports).toEqual([])
  expect(html).toBe('<div></div>')
})

for (const mobile of [false, true]) {
  describe(mobile ? 'Mobile technical equipment history SSR' : 'Desktop technical equipment history SSR', () => {
    it('shows technical history/date semantics but never ticket navigation or stale metadata', () => {
      const staleEntry = { ...entry(),
        ticketNumber: 987654, status: 'DONE', closedAt: 'hidden-close-date',
        performedBy: 'hidden-person', performedByCompany: 'hidden-company', email: 'hidden@example.invalid',
        workReports: [{ url: '/hidden-file', originalName: 'hidden.pdf', mimeType: 'image/png' }],
        comments: [{ text: 'hidden-chat' }], notes: 'hidden-note',
      }
      const html = render(mobile, [page([staleEntry as unknown as EquipmentHistoryEntry])])
      for (const text of ['Обращение от 01.09.2026', 'Отметка о результате от 02.09.2026', 'Не охлаждает', 'Промыт теплообменник', 'Датчик (S-1) · 2', 'Старый датчик · 1', 'Дата обращения не означает завершения ремонта', 'Записей: 1.']) expect(html).toContain(text)
      for (const hidden of ['hidden', '987654', 'internal-request-id', 'Открыть заявку', 'Исполнитель', '/tickets/', '<a ', '<img', 'Выполнена']) expect(html).not.toContain(hidden)
    })

    it('does not present an unresolved request as performed work', () => {
      const html = render(mobile, [page([entry({ result: null, resultAt: null, partsInstalled: [], partsRemoved: [] })])])
      expect(html).toContain('Результат работ не указан')
      expect(html).toContain('Работы с комплектующими не указаны')
      expect(html).not.toContain('Отметка о результате от')
      expect(html).not.toContain('Выполнена')
    })

    it('keeps page completion/count truthful and renders every loaded page', () => {
      const first = page([entry()], 'next')
      expect(render(mobile, [first])).toContain('Показать ещё')
      expect(render(mobile, [first])).not.toContain('История показана полностью')
      const all = render(mobile, [first, page([entry({ ticketId: 'second-id', problem: 'Вторая запись' })])])
      expect(all).toContain('Вторая запись')
      expect(all).toContain('Записей: 2.')
      expect(all).not.toContain('Показать ещё')
    })

    it('isolates history pages across equipment and company changes', () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
      const prefix = mobile ? 'mobile-equipment-history' : 'equipment-history'
      client.setQueryData([prefix, 'old-equipment', 'old-client'], {
        pages: [page([entry({ problem: 'old-scope-content' })])], pageParams: [undefined],
      })
      const html = renderToStaticMarkup(
        <QueryClientProvider client={client}>
          {mobile ? <MobileEquipmentHistory equipmentId="new-equipment" scopeCompanyId="new-client" />
            : <EquipmentHistoryTab equipmentId="new-equipment" scopeCompanyId="new-client" />}
        </QueryClientProvider>,
      )
      expect(html).not.toContain('old-scope-content')
      expect(html).not.toContain('История показана полностью')
      client.clear()
    })

    it('renders an honest empty state and escapes entered free-form text', () => {
      expect(render(mobile, [page([])])).toContain('Записей в истории обслуживания пока нет')
      const html = render(mobile, [page([entry({ problem: '<script>alert(1)</script>', result: '<img src=x>' })])])
      expect(html).toContain('&lt;script&gt;')
      expect(html).toContain('&lt;img src=x&gt;')
      expect(html).not.toContain('<script>')
      expect(html).not.toContain('<img ')
    })
  })
}
