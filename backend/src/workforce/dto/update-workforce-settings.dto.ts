import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator'

export class UpdateWorkforceSettingsDto {
  /**
   * Optional since SMA-PROVIDER-SHIFT-POLICY-FOUNDATION-078 added a second setting to this
   * endpoint. Previously required; making it optional is backward compatible, because every
   * existing caller still sends it and an omitted field now simply leaves the value alone.
   */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  shiftAutoCloseTime?: string

  /**
   * Provider Shift Policy. Meaningful only for PROVIDER companies; enabling it on a CLIENT
   * company is refused by the service rather than stored inert.
   */
  @IsOptional()
  @IsBoolean()
  requireActiveShiftForWork?: boolean
}
