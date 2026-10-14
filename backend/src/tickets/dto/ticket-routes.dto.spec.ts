import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { TICKET_ROUTES_BATCH_MAX } from '../ticket-route.service'
import { TicketRoutesDto } from './ticket-routes.dto'

jest.mock('../../twogis/twogis-routing.service', () => ({
  TwogisRoutingService: class TwogisRoutingService {},
}))

async function errorsFor(body: unknown) {
  return validate(plainToInstance(TicketRoutesDto, body))
}

describe('TicketRoutesDto', () => {
  it('accepts a list of ticket ids up to the batch limit', async () => {
    const ticketIds = Array.from({ length: TICKET_ROUTES_BATCH_MAX }, (_, i) => `t-${i}`)
    await expect(errorsFor({ ticketIds })).resolves.toHaveLength(0)
  })

  it('rejects an empty list, a list over the limit and non-string ids', async () => {
    const overLimit = Array.from({ length: TICKET_ROUTES_BATCH_MAX + 1 }, (_, i) => `t-${i}`)
    await expect(errorsFor({ ticketIds: [] })).resolves.not.toHaveLength(0)
    await expect(errorsFor({ ticketIds: overLimit })).resolves.not.toHaveLength(0)
    await expect(errorsFor({ ticketIds: [1, 2] })).resolves.not.toHaveLength(0)
    await expect(errorsFor({})).resolves.not.toHaveLength(0)
  })
})
