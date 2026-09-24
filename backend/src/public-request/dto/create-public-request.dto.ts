import { Transform } from 'class-transformer'
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

export enum PublicQuickRequestType {
  REPAIR = 'repair',
  NOTE = 'note',
}

export enum PublicQuickRequestChannel {
  DIRECT_LINK = 'direct_link',
  QR = 'qr',
}

export class CreatePublicRequestDto {
  @IsUUID()
  locationId!: string

  @IsOptional()
  @IsUUID()
  equipmentId?: string

  @IsEnum(PublicQuickRequestType)
  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  requestType!: PublicQuickRequestType

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description!: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string

  @IsOptional()
  @IsUUID()
  presetLocationId?: string

  @IsOptional()
  @IsEnum(PublicQuickRequestChannel)
  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  channel?: PublicQuickRequestChannel

  @IsOptional()
  @IsString()
  @MaxLength(32)
  publicLinkVersion?: string
}
