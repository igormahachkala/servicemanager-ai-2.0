import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { childTicketCreatePath } from './childTicketCreatePath'

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

describe('childTicketCreatePath', () => {
  it('собирает desktop-путь с parentId, locationId и scope карточки', () => {
    expect(
      childTicketCreatePath({
        parentId: 'parent-1',
        locationId: 'loc-1',
        scope: { linkedClientCompanyId: 'client-c' },
      }),
    ).toBe('/tickets/new?parentId=parent-1&locationId=loc-1&linkedClientCompanyId=client-c')

    expect(
      childTicketCreatePath({
        parentId: 'parent-1',
        locationId: 'loc-1',
        surface: 'desktop',
        scope: { companyId: 'obs-1' },
      }),
    ).toBe('/tickets/new?parentId=parent-1&locationId=loc-1&companyId=obs-1')
  })

  it('собирает mobile-путь с тем же query и scope', () => {
    expect(
      childTicketCreatePath({
        parentId: 'parent-1',
        locationId: 'loc-1',
        surface: 'mobile',
        scope: { linkedClientCompanyId: 'client-c' },
      }),
    ).toBe('/m/tickets/new?parentId=parent-1&locationId=loc-1&linkedClientCompanyId=client-c')

    expect(
      childTicketCreatePath({
        parentId: 'parent-1',
        locationId: 'loc-1',
        surface: 'mobile',
        mobileRoot: '/max',
        scope: { companyId: 'obs-1' },
      }),
    ).toBe('/max/tickets/new?parentId=parent-1&locationId=loc-1&companyId=obs-1')
  })

  it('без родителя или точки путь не собирает', () => {
    expect(childTicketCreatePath({ parentId: '', locationId: 'loc-1' })).toBe('')
    expect(childTicketCreatePath({ parentId: 'parent-1', locationId: '  ' })).toBe('')
  })
})

describe('карточка ведёт на полную форму подзадачи', () => {
  const ticketPage = codeOf(readSrc('views/TicketPage.tsx'))
  const actionsPanel = codeOf(readSrc('components/ticket-card-v2/TicketActionsPanel.tsx'))
  const createPage = codeOf(readSrc('views/CreateTicketPage.tsx'))
  const mobileCreate = codeOf(readSrc('mobile/MobileCreateTicket.tsx'))
  const barrel = readSrc('components/ticket-card-v2/index.ts')
  const api = readSrc('lib/api.ts')

  it('CreateTicketInput принимает parentId', () => {
    const block = api.slice(api.indexOf('export type CreateTicketInput'), api.indexOf('export type UpdateTicketInput'))
    expect(block).toContain('parentId?: string | null')
  })

  it('desktop-форма читает parentId, фиксирует точку и кладёт parentId в POST /tickets', () => {
    expect(createPage).toContain("searchParams.get('parentId')")
    expect(createPage).toContain('parentId: presetParentId || undefined')
    expect(createPage).toContain('disabled={isBootstrapping || noLocations || !!presetParentId}')
    expect(createPage).toContain("presetParentId ? 'Создание подзадачи' : 'Создать заявку'")
    expect(createPage).toContain('if (presetParentId) return')
  })

  it('mobile-форма читает parentId, фиксирует точку и кладёт parentId в payload', () => {
    expect(mobileCreate).toContain("search.get('parentId')")
    expect(mobileCreate).toContain("search.get('locationId')")
    expect(mobileCreate).toContain('parentId: presetParentId || undefined')
    expect(mobileCreate).toContain('disabled={isBootstrapping || !activeLocations.length || !!presetParentId}')
    expect(mobileCreate).toContain("presetParentId ? 'Создание подзадачи' : 'Создать заявку'")
  })

  it('карточка не зовёт createChildTicket и не рисует урезанную форму', () => {
    expect(ticketPage).toContain('childTicketCreatePath')
    expect(ticketPage).not.toContain('api.createChildTicket')
    expect(ticketPage).not.toContain('TicketChildCreateForm')
    expect(ticketPage).not.toContain('showChildCreateForm')
    expect(ticketPage).toMatch(
      /const CHILD_CREATE_ROLES: api\.Role\[\] = \[\s*'ADMIN',\s*'MASTER',\s*'DISPATCHER',\s*'NETWORK_DIRECTOR',\s*'CLIENT',\s*'TERRITORIAL_MANAGER',\s*'TECHNICIAN',\s*\]/,
    )
    expect(barrel).not.toContain('TicketChildCreateForm')
  })

  it('кнопка панели ведёт на форму и доступна технику с правом создания', () => {
    expect(actionsPanel).toContain('+ Подзадача')
    expect(actionsPanel).toContain('childCreateHref')
    expect(actionsPanel).not.toContain('Ещё работа по этой точке')
    expect(actionsPanel).not.toContain('Скрыть доп. работу')
    expect(actionsPanel).not.toContain('onToggleChildCreateForm')
    expect(actionsPanel).not.toContain('canCreateChildTicket && !isTechnicianRole')
  })
})
