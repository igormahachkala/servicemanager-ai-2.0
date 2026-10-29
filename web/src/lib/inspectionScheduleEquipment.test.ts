import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { InspectionScheduleEquipmentPicker, InspectionSchedulesPage } from '../views/InspectionSchedulesPage'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  inspectionScheduleEquipmentLabel,
  inspectionScheduleEquipmentPayload,
  inspectionScheduleScopeReducer,
  type InspectionScheduleScope,
  type ScheduleEquipmentSnapshot,
} from './inspectionScheduleEquipment'

const selected: InspectionScheduleScope = {
  clientCompanyId: 'client-a', locationId: 'location-a', equipmentId: 'equipment-a',
}
const loaded: ScheduleEquipmentSnapshot = {
  clientCompanyId: 'client-a', locationId: 'location-a',
  items: [{ id: 'equipment-a', name: 'Витрина', model: 'ХК-120', locationId: 'location-a', companyId: 'client-a' }],
}
const page = () => readFileSync(resolve(process.cwd(), 'src/views/InspectionSchedulesPage.tsx'), 'utf8')

describe('inspection schedule equipment payload', () => {
  it('preserves the site-wide payload without equipmentId, including during loading/error', () => {
    const scope = { ...selected, equipmentId: '' }
    expect(inspectionScheduleEquipmentPayload(scope)).toEqual({})
    expect(inspectionScheduleEquipmentPayload(scope, loaded)).toEqual({})
    expect(JSON.stringify({ locationId: scope.locationId, ...inspectionScheduleEquipmentPayload(scope) }))
      .toBe('{"locationId":"location-a"}')
  })

  it('adds only the selected equipmentId from the current location/client snapshot', () => {
    expect(inspectionScheduleEquipmentPayload(selected, loaded)).toEqual({ equipmentId: 'equipment-a' })
  })

  it('works for own-company context without adding clientCompanyId to the payload', () => {
    expect(inspectionScheduleEquipmentPayload(
      { ...selected, clientCompanyId: '' }, { ...loaded, clientCompanyId: '' },
    )).toEqual({ equipmentId: 'equipment-a' })
  })

  it('accepts a scoped list when optional location/company metadata is absent', () => {
    expect(inspectionScheduleEquipmentPayload(selected, {
      ...loaded, items: [{ id: 'equipment-a', name: 'Витрина' }],
    })).toEqual({ equipmentId: 'equipment-a' })
  })

  it('rejects a selection while no successful current snapshot is available', () => {
    expect(() => inspectionScheduleEquipmentPayload(selected)).toThrow(/Дождитесь загрузки/)
  })

  it.each([
    { ...loaded, clientCompanyId: 'client-b' },
    { ...loaded, locationId: 'location-b' },
  ])('rejects a late response from a previous context even if the id matches', (snapshot) => {
    expect(() => inspectionScheduleEquipmentPayload(selected, snapshot)).toThrow(/Дождитесь загрузки/)
  })

  it('rejects a selected equipment with no location', () => {
    expect(() => inspectionScheduleEquipmentPayload({ ...selected, locationId: '' }, loaded)).toThrow()
  })

  it.each([
    { items: [] },
    { items: [{ ...loaded.items[0], id: 'equipment-b' }] },
    { items: [{ ...loaded.items[0], locationId: 'location-b' }] },
    { items: [{ ...loaded.items[0], companyId: 'client-b' }] },
  ])('rejects a removed/mismatched selection instead of silently creating a site-wide schedule', ({ items }) => {
    expect(() => inspectionScheduleEquipmentPayload(selected, { ...loaded, items })).toThrow(/больше недоступно/)
  })
})

describe('inspection schedule equipment context changes', () => {
  it('clears equipment synchronously with a location change without mutating previous state', () => {
    const changed = inspectionScheduleScopeReducer(selected, { type: 'location', value: 'location-b' })
    expect(changed).toEqual({ clientCompanyId: 'client-a', locationId: 'location-b', equipmentId: '' })
    expect(selected.equipmentId).toBe('equipment-a')
    expect(inspectionScheduleEquipmentPayload(changed, loaded)).toEqual({})
  })

  it.each(['client-b', ''])('clears both location and equipment in the same client-change update (%s)', (value) => {
    const changed = inspectionScheduleScopeReducer(selected, { type: 'client', value })
    expect(changed).toEqual({ clientCompanyId: value, locationId: '', equipmentId: '' })
    expect(inspectionScheduleEquipmentPayload(changed)).toEqual({})
  })

  it('does not resurrect old equipment when switching back to the previous location', () => {
    const away = inspectionScheduleScopeReducer(selected, { type: 'location', value: 'location-b' })
    const back = inspectionScheduleScopeReducer(away, { type: 'location', value: 'location-a' })
    expect(back.equipmentId).toBe('')
    expect(inspectionScheduleEquipmentPayload(back, loaded)).toEqual({})
  })

  it('clears location/equipment after save while retaining the selected client', () => {
    expect(inspectionScheduleScopeReducer(selected, { type: 'location', value: '' })).toEqual({
      clientCompanyId: 'client-a', locationId: '', equipmentId: '',
    })
  })

  it('allows choosing equipment and explicitly returning to a site-wide schedule', () => {
    const scope = { ...selected, equipmentId: '' }
    const chosen = inspectionScheduleScopeReducer(scope, { type: 'equipment', value: 'equipment-a' })
    expect(inspectionScheduleEquipmentPayload(chosen, loaded)).toEqual({ equipmentId: 'equipment-a' })
    const cleared = inspectionScheduleScopeReducer(chosen, { type: 'equipment', value: '' })
    expect(inspectionScheduleEquipmentPayload(cleared, loaded)).toEqual({})
  })

  it('does not keep an equipment choice without a selected location', () => {
    expect(inspectionScheduleScopeReducer(
      { clientCompanyId: '', locationId: '', equipmentId: '' },
      { type: 'equipment', value: 'equipment-a' },
    ).equipmentId).toBe('')
  })
})

describe('inspection schedule equipment labels', () => {
  it('shows readable name/model without internal ids', () => {
    expect(inspectionScheduleEquipmentLabel(loaded.items[0])).toBe('Витрина · ХК-120')
    expect(inspectionScheduleEquipmentLabel({ name: ' Витрина ', model: ' ХК-120 ', type: 'Холодильник' }))
      .toBe('Витрина · ХК-120')
  })

  it('uses available type for the saved schedule relation, or just the name', () => {
    expect(inspectionScheduleEquipmentLabel({ name: 'Витрина', type: 'Холодильник' })).toBe('Витрина · Холодильник')
    expect(inspectionScheduleEquipmentLabel({ name: 'Витрина', model: null })).toBe('Витрина')
    expect(inspectionScheduleEquipmentLabel({ name: 'Витрина', model: 'Витрина' })).toBe('Витрина')
    expect(inspectionScheduleEquipmentLabel({ name: ' ' })).toBe('Оборудование без названия')
  })
})

describe('inspection schedule equipment page contract', () => {
  it('uses the canonical location endpoint with client context and a context-keyed cache', () => {
    const source = page()
    expect(source).toContain("queryKey: ['inspection-schedule-equipment', clientCompanyId, locationId]")
    expect(source).toMatch(/queryFn: async \(\) => \(\{\s*clientCompanyId,\s*locationId,\s*items: await api\.equipmentByLocation\(locationId, clientCompanyId \|\| undefined\)/)
    expect(source).toMatch(/items: await api\.equipmentByLocation[\s\S]*?enabled: canManage && !!locationId/)
  })

  it('wires the tested reducer to parent-context changes and selection, not an effect-only reset', () => {
    const source = page()
    expect(source).toContain('useReducer(inspectionScheduleScopeReducer,')
    for (const type of ['client', 'location']) {
      expect(source).toContain(`dispatchScope({ type: '${type}', value: e.target.value })`)
    }
    expect(source).toContain("onChange={(value) => dispatchScope({ type: 'equipment', value })}")
    expect(source).toContain("dispatchScope({ type: 'location', value: '' })")
  })

  it('validates the payload before the existing create call and withholds failed/refreshing data', () => {
    const source = page()
    expect(source).toContain('const equipmentReady = equipmentQ.isSuccess && !equipmentQ.isFetching')
    expect(source).toMatch(/api\.createInspectionSchedule\(\{\s*templateId,\s*locationId,\s*\.\.\.inspectionScheduleEquipmentPayload\(scope, equipmentReady \? equipmentQ\.data : undefined\)/)
  })

  it('places the optional picker after the site and distinguishes loading/error/empty with retry', () => {
    const source = page()
    const site = source.indexOf('<div className="muted small">Точка</div>')
    const equipment = source.indexOf('<InspectionScheduleEquipmentPicker')
    const technician = source.indexOf('<div className="muted small">Техник</div>')
    expect(equipment).toBeGreaterThan(site)
    expect(technician).toBeGreaterThan(equipment)
    expect(source).toContain('loading={equipmentQ.isPending || equipmentQ.isFetching}')
    expect(source).toContain('items={equipmentQ.isSuccess ? equipmentQ.data.items : []}')
    expect(source).toContain('Загружаем оборудование…')
    expect(source).toContain('equipmentQ.isError')
    expect(source).toContain('Не удалось загрузить оборудование.')
    expect(source).toContain('onRetry={() => equipmentQ.refetch()}')
    expect(source).toContain('На этой точке нет оборудования.')
    expect(source).toContain('<option value="">Вся точка (без привязки к оборудованию)</option>')
  })

  it('shows linked equipment or the site-wide default in saved schedules', () => {
    expect(page()).toContain("s.equipment ? inspectionScheduleEquipmentLabel(s.equipment) : 'Вся точка'")
  })
})


describe('inspection schedule equipment rendered UI', () => {
  function renderPicker(overrides: Partial<Parameters<typeof InspectionScheduleEquipmentPicker>[0]> = {}) {
    return renderToStaticMarkup(createElement(InspectionScheduleEquipmentPicker, {
      locationId: 'location-a', equipmentId: '', items: loaded.items,
      loading: false, error: false, onChange: () => {}, onRetry: () => {}, ...overrides,
    }))
  }

  it('renders an optional site-wide selection by default and the selected readable name/model', () => {
    expect(renderPicker()).toContain('<option value="" selected="">Вся точка (без привязки к оборудованию)</option>')
    expect(renderPicker({ equipmentId: 'equipment-a' }))
      .toContain('<option value="equipment-a" selected="">Витрина · ХК-120</option>')
  })

  it('disables the picker before site selection without claiming an empty or failed equipment list', () => {
    const html = renderPicker({ locationId: '', items: [], loading: true })
    expect(html).toContain('<select disabled="">')
    expect(html).toContain('Сначала выберите точку')
    expect(html).not.toContain('На этой точке нет оборудования.')
    expect(html).not.toContain('Не удалось загрузить оборудование.')
  })

  it('shows loading distinctly from an empty result and disables selection during a refresh', () => {
    const html = renderPicker({ loading: true, items: [] })
    expect(html).toContain('<select disabled="">')
    expect(html).toContain('Загружаем оборудование…')
    expect(html).not.toContain('На этой точке нет оборудования.')
  })

  it('shows a retry on error and leaves the site-wide choice available', () => {
    const html = renderPicker({ error: true, items: [] })
    expect(html).toContain('Не удалось загрузить оборудование.')
    expect(html).toContain('<button type="button" class="ghost">Повторить загрузку</button>')
    expect(html).toContain('<select>')
    expect(html).not.toContain('На этой точке нет оборудования.')
  })

  it('explains a successful empty result without claiming a request error', () => {
    const html = renderPicker({ items: [] })
    expect(html).toContain('На этой точке нет оборудования. Можно запланировать обход всей точки.')
    expect(html).not.toContain('Повторить загрузку')
    expect(html).not.toContain('Не удалось загрузить оборудование.')
  })

  it('keeps a stale selected value visibly unavailable instead of falsely showing a site-wide choice', () => {
    const html = renderPicker({ equipmentId: 'equipment-removed', items: [] })
    expect(html).toContain('<option value="equipment-removed" disabled="" selected="">Выбранное оборудование недоступно</option>')
    expect(html).toContain('Выберите оборудование заново или «Вся точка».')
    expect(html).not.toContain('<option value="" selected="">')
  })

  function renderPage(role: string, withEquipment: boolean) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    client.setQueryData(['me'], { role })
    client.setQueryData(['inspection-templates'], [])
    client.setQueryData(['linked-clients'], [])
    client.setQueryData(['locations', ''], [])
    client.setQueryData(['inspection-schedules', ''], [{
      id: 'schedule-a', name: 'Проверка витрины', frequency: 'ONCE', isActive: true,
      template: { id: 'template-a', name: 'Чек-лист' },
      location: { id: 'location-a', name: 'Магазин' },
      equipment: withEquipment ? { id: 'equipment-a', name: 'Витрина', type: 'Холодильник' } : null,
    }])
    try {
      return renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: ['/inspection/schedules'] },
          createElement(InspectionSchedulesPage)),
      ))
    } finally {
      client.clear()
    }
  }

  it('renders the real manager page with the picker after site and saved equipment label', () => {
    const html = renderPage('ADMIN', true)
    expect(html.indexOf('Оборудование (необязательно)')).toBeGreaterThan(html.indexOf('>Точка</div>'))
    expect(html).toContain('Оборудование: Витрина · Холодильник')
  })

  it('renders the real site-wide schedule default without an equipment relation', () => {
    expect(renderPage('ADMIN', false)).toContain('Оборудование: Вся точка')
  })

  it('retains the existing manager-only creation UI while showing saved equipment to a technician', () => {
    const html = renderPage('TECHNICIAN', true)
    expect(html).not.toContain('Оборудование (необязательно)')
    expect(html).not.toContain('Запланировать обход')
    expect(html).toContain('Оборудование: Витрина · Холодильник')
  })
})
