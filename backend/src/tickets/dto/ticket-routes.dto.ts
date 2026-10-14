import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator'

import { TICKET_ROUTES_BATCH_MAX } from '../ticket-route.service'

export class TicketRoutesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(TICKET_ROUTES_BATCH_MAX)
  @IsString({ each: true })
  ticketIds!: string[]
}
