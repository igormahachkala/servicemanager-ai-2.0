import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator'

export class SubmitTicketAcceptanceDto {
  @IsString()
  failureCauseId!: string

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
