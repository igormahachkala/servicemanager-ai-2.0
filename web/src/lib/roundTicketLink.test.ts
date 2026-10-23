import { describe, expect, it } from 'vitest'
import { roundTicketPath, roundTicketScope } from './roundTicketLink'

const provider = { companyId: 'prov-1', role: 'DISPATCHER' as const }

describe('roundTicketScope — область заявки из desktop-обхода', () => {
  it('провайдер, заявка клиента площадки: linkedClientCompanyId владельца', () => {
    expect(roundTicketScope({ me: provider, outboundScope: {}, ownerCompanyId: 'client-1' })).toEqual({ linkedClientCompanyId: 'client-1' })
  })

  it('провайдер пришёл с ?companyId=: режим наблюдения не переносится', () => {
    expect(roundTicketScope({ me: provider, outboundScope: { companyId: 'client-1' }, ownerCompanyId: 'client-1' })).toEqual({
      linkedClientCompanyId: 'client-1',
    })
  })

  it('чужой linked из адреса не побеждает владельца заявки', () => {
    expect(roundTicketScope({ me: provider, outboundScope: { linkedClientCompanyId: 'client-2' }, ownerCompanyId: 'client-1' })).toEqual({
      linkedClientCompanyId: 'client-1',
    })
  })

  it('своя компания: без параметров области', () => {
    expect(roundTicketScope({ me: { companyId: 'client-1', role: 'ADMIN' }, outboundScope: { linkedClientCompanyId: 'x' }, ownerCompanyId: 'client-1' })).toEqual({})
  })

  it('роль без linked-контура (CLIENT) параметр не получает', () => {
    expect(roundTicketScope({ me: { companyId: 'c-9', role: 'CLIENT' }, outboundScope: {}, ownerCompanyId: 'client-1' })).toEqual({})
  })

  it('PLATFORM_ADMIN: companyId из адреса, иначе владелец', () => {
    const admin = { companyId: 'platform', role: 'PLATFORM_ADMIN' as const }
    expect(roundTicketScope({ me: admin, outboundScope: { companyId: 'client-7' }, ownerCompanyId: 'client-1' })).toEqual({ companyId: 'client-7' })
    expect(roundTicketScope({ me: admin, outboundScope: {}, ownerCompanyId: 'client-1' })).toEqual({ companyId: 'client-1' })
  })

  it('пока профиль не загружен — без области (как прежняя ссылка)', () => {
    expect(roundTicketScope({ me: undefined, outboundScope: { companyId: 'client-1' }, ownerCompanyId: 'client-1' })).toEqual({})
  })

  it('путь кодирует id и добавляет область', () => {
    expect(roundTicketPath('t 1', { me: provider, outboundScope: {}, ownerCompanyId: 'client-1' })).toBe('/tickets/t%201?linkedClientCompanyId=client-1')
    expect(roundTicketPath('t-1', { me: { companyId: 'client-1', role: 'ADMIN' }, outboundScope: {}, ownerCompanyId: 'client-1' })).toBe('/tickets/t-1')
  })
})
