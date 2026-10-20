import { PublicRequestType } from '@prisma/client'
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  brandName?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phone?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxId?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNumber?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(255)
  signatureLineName?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(255)
  signatureLineTitle?: string | null

  @IsOptional()
  @IsBoolean()
  autoAssignEnabled?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string

  @IsOptional()
  @IsBoolean()
  allowTechnicianClaim?: boolean

  @IsOptional()
  @IsBoolean()
  slaStrictMode?: boolean

  @IsOptional()
  @IsBoolean()
  publicRequestEnabled?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicRequestIntro?: string | null

  @IsOptional()
  @IsBoolean()
  publicRequestAllowPhotos?: boolean

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  publicRequestMaxPhotos?: number

  @IsOptional()
  @IsBoolean()
  publicRequestRequirePhone?: boolean

  @IsOptional()
  @IsEnum(PublicRequestType)
  publicRequestDefaultType?: PublicRequestType | null

  @IsOptional()
  @IsBoolean()
  publicRequestRateLimitEnabled?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(40)
  publicRequestLocationPresetMode?: string | null
}
