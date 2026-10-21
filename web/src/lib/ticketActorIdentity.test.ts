import { describe, expect, it } from 'vitest'
import { displayCompanyName, presentTicketCreator } from './ticketActorIdentity'

const ticketCompany = {
  id: 'client-ticket',
  legalName: 'ООО «Клиент из заявки»',
  brandName: 'Клиент из заявки',
  name: 'Ticket Client',
  type: 'CLIENT' as const,
}

const creatorCompany = {
  id: 'client-creator',
  legalName: 'ООО «Клиент создателя»',
  brandName: 'Клиент создателя',
  name: 'Creator Client',
  type: 'CLIENT' as const,
}

describe('ticket actor identity', () => {
  it('prefers legalName then brandName then name', () => {
    expect(displayCompanyName({ id: 'c1', legalName: 'ООО «Юрлицо»', brandName: 'Бренд', name: 'Name' })).toBe(
      'ООО «Юрлицо»',
    )
    expect(displayCompanyName({ id: 'c2', legalName: '', brandName: 'Бренд', name: 'Name' })).toBe('Бренд')
    expect(displayCompanyName({ id: 'c3', legalName: '', brandName: '', name: 'Name' })).toBe('Name')
  })

  it('presents the creator company, not the ticket company', () => {
    expect(
      presentTicketCreator({
        company: ticketCompany,
        createdByUser: {
          id: 'creator-1',
          email: 'creator@example.test',
          firstName: 'Иван',
          lastName: 'Иванов',
          role: 'ADMIN',
          company: creatorCompany,
        },
      }),
    ).toEqual({
      organization: 'ООО «Клиент создателя»',
      name: 'Иванов Иван',
      role: 'Администратор клиента',
    })
  })

  it('falls back to a generic organization when the creator has no company', () => {
    expect(
      presentTicketCreator({
        company: ticketCompany,
        createdByUser: {
          id: 'creator-2',
          email: 'creator@example.test',
          firstName: 'Петр',
          lastName: 'Петров',
          role: 'CLIENT',
          company: null,
        },
      }),
    ).toEqual({
      organization: 'Организация не указана',
      name: 'Петров Петр',
      role: 'Клиент',
    })
  })

  it('uses requesterName when createdByUser is absent', () => {
    expect(
      presentTicketCreator({
        company: ticketCompany,
        requesterName: 'Старый заявитель',
      }),
    ).toEqual({
      organization: 'ООО «Клиент из заявки»',
      name: 'Старый заявитель',
      role: 'Заявитель',
    })
  })
})
