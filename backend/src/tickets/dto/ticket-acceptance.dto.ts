import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ArrayMaxSize } from 'class-validator'

export enum AcceptanceDecision {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
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
}
