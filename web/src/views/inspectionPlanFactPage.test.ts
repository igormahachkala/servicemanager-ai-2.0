import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { InspectionPlanFactResults } from './InspectionPlanFactPage'
import { PlanFactTicketResults } from '../components/inspection/PlanFactTickets'
import { PLAN_FACT_COVERAGE } from '../lib/inspectionPlanFact'
import {
  data,
  FILTER,
  NOW,
  plan,
  run,
} from '../lib/inspectionPlanFact.fixtures'
function render(
  extra: Partial<Parameters<typeof InspectionPlanFactResults>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(InspectionPlanFactResults, {
        data: data(),
        filter: FILTER,
        now: NOW,
        loading: false,
        failed: false,
        outboundScope: { linkedClientCompanyId: 'client-1' },
        ...extra,
      }),
    ),
  )
}
describe('plan/fact SSR', () => {
  it('renders distinct current and historical workers, never raw emails or unverified ticket links', () => {
    const html = render()
    for (const text of [
      'Назначен сейчас',
      'Второй Пётр',
      'Фактический исполнитель',
      'Первый Иван',
      'Историческое название',
      'Без фильтра периода',
      '/inspection/runs/run-1?linkedClientCompanyId=client-1',
    ])
      expect(html).toContain(text)
    expect(html).not.toContain('@example.test')
    expect(html).not.toContain('/tickets/ticket-1')
  })
  it('hides old source data on errors/loading and honestly labels empty results', () => {
    expect(render({ failed: true })).toContain('Не удалось загрузить')
    expect(render({ failed: true })).not.toContain('Историческое название')
    expect(render({ loading: true })).toContain('Загружаем')
    expect(
      render({ data: { schedules: [], completed: [], active: [] } }),
    ).toContain('в загруженной выборке')
  })
  it('explicitly describes incomplete coverage without completion percentage', () => {
    for (const text of [
      'не полный архив',
      'не восстанавливаются',
      'Процент выполнения не рассчитывается',
    ])
      expect(PLAN_FACT_COVERAGE).toContain(text)
  })
  it('does not treat inaccessible/canceled tickets as resolved', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(PlanFactTicketResults, {
          findings: [
            {
              id: 'item',
              title: 'Связанный дефект',
              status: 'ISSUE',
              ticketId: 'ticket',
            },
          ],
          result: {
            tickets: [
              {
                id: 'ticket',
                number: 17,
                href: '/tickets/ticket',
                status: 'CANCELED',
              },
            ],
            unavailable: 2,
            deferred: 3,
          },
        }),
      ),
    )
    for (const text of [
      'не подтверждение устранения',
      'статус и устранение неизвестны',
      'лимит 10',
      'Связанный дефект',
    ])
      expect(html).toContain(text)
  })
})

it('does not render unconfirmed expired plans as confirmed overdue in the summary', () => {
  const html = render({
    data: data({
      schedules: [
        plan({ nextDueAt: run().dueAt!, overdueAt: run().overdueAt! }),
      ],
      completed: [],
    }),
    filter: { ...FILTER, employeeId: 'worker-new' },
  })
  expect(html).toContain('Срок прошёл · факт не подтверждён')
  expect(html).toContain('с просроченным незавершённым обходом 0')
  expect(html).toContain('срок прошёл, факт не подтверждён 1')
  expect(html).not.toContain('>Просрочен<')
})
