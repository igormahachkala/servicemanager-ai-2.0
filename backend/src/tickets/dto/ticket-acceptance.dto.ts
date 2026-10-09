import { IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, ArrayMaxSize, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export enum AcceptanceDecision {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export const CHILD_TICKET_RESOLUTION_VALUES = ['FIELD_COMPLETE', 'CANCELED'] as const
export type ChildTicketResolutionValue = (typeof CHILD_TICKET_RESOLUTION_VALUES)[number]

export class ChildTicketResolutionItemDto {
  @IsString()
  ticketId!: string

  @IsIn(CHILD_TICKET_RESOLUTION_VALUES)
  resolution!: ChildTicketResolutionValue
}

export class TicketAcceptanceDto {
  @IsEnum(AcceptanceDecision)
  decision!: AcceptanceDecision

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  attachmentIds?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildTicketResolutionItemDto)
  childResolutions?: ChildTicketResolutionItemDto[]
}
