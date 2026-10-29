import { describe, expect, it } from 'vitest'
import { mobileTicketDetailGetOneScopes, scopeForMobileTicketLink } from '../mobile/mobileTicketDisplay'
import { resolveTicketPageScope } from './ticketPageScope'

const none = { urlCompanyId: '', urlLinkedClientCompanyId: '', persistedCompanyId: '', persistedLinkedClientCompanyId: '' }

describe('resolveTicketPageScope', () => {
  it('провайдер: явный linked в адресе не получает сохранённый companyId (дефект аудита)', () => {
    expect(
      resolveTicketPageScope({ ...none, urlLinkedClientCompanyId: 'client-1', persistedCompanyId: 'client-1', role: 'ADMIN' }),
    ).toEqual({ companyId: '', linkedClientCompanyId: 'client-1' })
  })

  it('явная область адреса главнее сохранённой, даже пока роль не загружена', () => {
    expect(
      resolveTicketPageScope({
        ...none,
        urlLinkedClientCompanyId: 'client-1',
        persistedCompanyId: 'client-1',
        persistedLinkedClientCompanyId: 'client-2',
        role: undefined,
      }),
    ).toEqual({ companyId: '', linkedClientCompanyId: 'client-1' })
  })

  it('без области в адресе у провайдера сохранённый companyId рядом с linked отбрасывается', () => {
    for (const role of ['TECHNICIAN', 'STAFF', 'DISPATCHER', 'MASTER'] as const) {
      expect(
        resolveTicketPageScope({ ...none, persistedCompanyId: 'client-1', persistedLinkedClientCompanyId: 'client-1', role }),
      ).toEqual({ companyId: '', linkedClientCompanyId: 'client-1' })
    }
  })

  it('PLATFORM_ADMIN: режим наблюдения из адреса и из сохранённой области не меняется', () => {
    expect(resolveTicketPageScope({ ...none, urlCompanyId: 'client-1', role: 'PLATFORM_ADMIN' })).toEqual({
      companyId: 'client-1',
      linkedClientCompanyId: '',
    })
    expect(resolveTicketPageScope({ ...none, persistedCompanyId: 'client-1', role: 'PLATFORM_ADMIN' })).toEqual({
      companyId: 'client-1',
      linkedClientCompanyId: '',
    })
    expect(
      resolveTicketPageScope({ ...none, urlCompanyId: 'client-1', urlLinkedClientCompanyId: 'client-2', role: 'PLATFORM_ADMIN' }),
    ).toEqual({ companyId: 'client-1', linkedClientCompanyId: 'client-2' })
  })

  it('прямая ссылка без области и без сохранённой области — своя компания, без параметров', () => {
    expect(resolveTicketPageScope({ ...none, role: 'ADMIN' })).toEqual({ companyId: '', linkedClientCompanyId: '' })
  })

  it('CLIENT и роли без linked: сохранённый companyId остаётся как был', () => {
    expect(resolveTicketPageScope({ ...none, persistedCompanyId: 'own-1', role: 'CLIENT' })).toEqual({
      companyId: 'own-1',
      linkedClientCompanyId: '',
    })
    expect(resolveTicketPageScope({ ...none, urlCompanyId: 'client-1', role: 'ADMIN' })).toEqual({
      companyId: 'client-1',
      linkedClientCompanyId: '',
    })
  })
})

describe('mobileTicketDetailGetOneScopes: те же правила', () => {
  const base = { ...none, stateTicketOwnerCompanyId: '' }

  it('явный linked + сохранённый companyId → только linked', () => {
    expect(
      mobileTicketDetailGetOneScopes({
        ...base,
        urlLinkedClientCompanyId: 'client-1',
        persistedCompanyId: 'client-1',
        meRole: 'TECHNICIAN',
      }),
    ).toEqual([{ companyId: undefined, linkedClientCompanyId: 'client-1' }])
  })

  it('явный linked не смешивается с сохранённым companyId, пока me не загружен', () => {
    expect(
      mobileTicketDetailGetOneScopes({
        ...base,
        urlLinkedClientCompanyId: 'client-1',
        persistedCompanyId: 'client-1',
        persistedLinkedClientCompanyId: 'client-2',
        meRole: undefined,
      }),
    ).toEqual([{ companyId: undefined, linkedClientCompanyId: 'client-1' }])
  })

  it('владелец из state и сохранённый companyId у провайдера → без companyId и в повторе', () => {
    const scopes = mobileTicketDetailGetOneScopes({
      ...base,
      stateTicketOwnerCompanyId: 'client-1',
      persistedCompanyId: 'client-9',
      persistedLinkedClientCompanyId: 'client-2',
      meRole: 'STAFF',
    })
    expect(scopes).toEqual([{ companyId: undefined, linkedClientCompanyId: 'client-1' }])
  })

  it('PLATFORM_ADMIN: сохранённый companyId остаётся режимом наблюдения', () => {
    expect(mobileTicketDetailGetOneScopes({ ...base, persistedCompanyId: 'client-1', meRole: 'PLATFORM_ADMIN' })).toEqual([
      { companyId: 'client-1', linkedClientCompanyId: undefined },
    ])
  })
})

describe('scopeForMobileTicketLink: ссылка из мобильных списков и обхода', () => {
  const provider = { companyId: 'prov-1', role: 'DISPATCHER' as const }

  it('провайдер на странице с ?companyId=клиент: ссылка на заявку клиента — только linked', () => {
    expect(scopeForMobileTicketLink(provider, { companyId: 'client-1' }, { companyId: 'client-1' })).toEqual({
      companyId: undefined,
      linkedClientCompanyId: 'client-1',
    })
    expect(
      scopeForMobileTicketLink(provider, { companyId: 'client-1', linkedClientCompanyId: 'client-1' }, { companyId: 'client-1' }),
    ).toEqual({ companyId: undefined, linkedClientCompanyId: 'client-1' })
  })

  it('своя заявка провайдера: companyId рядом с linked не переносится', () => {
    expect(
      scopeForMobileTicketLink(provider, { companyId: 'client-1', linkedClientCompanyId: 'client-1' }, { companyId: 'prov-1' }),
    ).toEqual({ companyId: undefined, linkedClientCompanyId: 'client-1' })
  })

  it('PLATFORM_ADMIN: companyId страницы остаётся', () => {
    expect(
      scopeForMobileTicketLink({ companyId: 'platform-0', role: 'PLATFORM_ADMIN' }, { companyId: 'client-1' }, { companyId: 'client-1' }),
    ).toEqual({ companyId: 'client-1', linkedClientCompanyId: undefined })
  })

  it('CLIENT: область страницы без изменений', () => {
    expect(scopeForMobileTicketLink({ companyId: 'client-1', role: 'CLIENT' }, { companyId: 'client-1' }, { companyId: 'client-1' })).toEqual({
      companyId: 'client-1',
      linkedClientCompanyId: undefined,
    })
  })
})
