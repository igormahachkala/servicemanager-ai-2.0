import { IsString, Matches } from 'class-validator'

export class UpdateWorkforceSettingsDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  shiftAutoCloseTime!: string
}
