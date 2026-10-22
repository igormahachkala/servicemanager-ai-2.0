import { describe, expect, it } from 'vitest'

import { buildAnalyticsContractorsQuery } from './api'
import {
  contractorAnalyticsScope,
  contractorPeriodRange,
  fmtDurationMinutes,
  fmtSlaRatio,
  type ContractorScopeInput,
} from './contractorAnalytics'

const base: ContractorScopeInput = {
  analyticsAllowedForRole: true,
  observerCompanyId: '',
  canShowLinkedClients: false,
  linkedClientsLoading: false,
  selectedLinkedClient: null,
}

describe('contractorAnalyticsScope', () => {
  it('клиент запрашивает свой контур без параметров', () => {
    expect(contractorAnalyticsScope(base)).toEqual({ enabled: true, params: {} })
  })

  it('роль без аналитики не запрашивает ничего', () => {
    expect(contractorAnalyticsScope({ ...base, analyticsAllowedForRole: false })).toEqual({ enabled: false })
  })

  it('наблюдатель платформы — по companyId', () => {
    expect(contractorAnalyticsScope({ ...base, observerCompanyId: 'c-1' })).toEqual({
      enabled: true,
      params: { companyId: 'c-1' },
    })
  })

  it('PRIMARY и SECONDARY — по выбранному клиенту', () => {
    for (const role of ['PRIMARY', 'SECONDARY'] as const) {
      expect(
        contractorAnalyticsScope({
          ...base,
          canShowLinkedClients: true,
          selectedLinkedClient: { clientCompanyId: 'client-1', role },
        }),
      ).toEqual({ enabled: true, params: { linkedClientCompanyId: 'client-1' } })
    }
  })

  it('провайдер без выбранного клиента или во время загрузки — не запрашивает', () => {
    expect(contractorAnalyticsScope({ ...base, canShowLinkedClients: true })).toEqual({ enabled: false })
    expect(
      contractorAnalyticsScope({
        ...base,
        canShowLinkedClients: true,
        linkedClientsLoading: true,
        selectedLinkedClient: { clientCompanyId: 'client-1', role: 'PRIMARY' },
      }),
    ).toEqual({ enabled: false })
  })
})

describe('contractorPeriodRange', () => {
  const now = new Date(2026, 9, 21, 15, 30)

  it('7 дней — с полуночи локальных суток шесть дней назад', () => {
    expect(contractorPeriodRange('7d', now)).toEqual({ from: new Date(2026, 9, 15, 0, 0).toISOString() })
  })

  it('30 дней переходит через границу месяца', () => {
    expect(contractorPeriodRange('30d', now)).toEqual({ from: new Date(2026, 8, 22, 0, 0).toISOString() })
  })

  it('всё время — без границы', () => {
    expect(contractorPeriodRange('all', now)).toEqual({})
  })
})

describe('форматирование', () => {
  it('доля SLA: прочерк, когда оценивать нечего', () => {
    expect(fmtSlaRatio(0.875)).toBe('88%')
    expect(fmtSlaRatio(0)).toBe('0%')
    expect(fmtSlaRatio(null)).toBe('—')
  })

  it('длительность выполнения', () => {
    expect(fmtDurationMinutes(45)).toBe('45 мин')
    expect(fmtDurationMinutes(135)).toBe('2 ч 15 мин')
    expect(fmtDurationMinutes(180)).toBe('3 ч')
    expect(fmtDurationMinutes(60 * 24 * 3 + 60 * 4)).toBe('3 д 4 ч')
    expect(fmtDurationMinutes(null)).toBe('—')
  })
})

describe('buildAnalyticsContractorsQuery', () => {
  it('пустые параметры не уходят', () => {
    expect(buildAnalyticsContractorsQuery()).toBe('')
    expect(buildAnalyticsContractorsQuery({ linkedClientCompanyId: '  ', from: '' })).toBe('')
  })

  it('передаёт область, подрядчика и период', () => {
    expect(
      buildAnalyticsContractorsQuery({
        linkedClientCompanyId: 'client-1',
        contractorCompanyId: 'sub-a',
        from: '2026-10-15T00:00:00.000Z',
      }),
    ).toBe('?linkedClientCompanyId=client-1&contractorCompanyId=sub-a&from=2026-10-15T00%3A00%3A00.000Z')
  })
})
