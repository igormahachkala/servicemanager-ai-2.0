import { ServiceContractRole, ServiceContractStatus } from '@prisma/client'
import { ArrayUnique, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class CreateServiceContractDto {
  @IsUUID()
  clientCompanyId!: string

  @IsUUID()
  providerCompanyId!: string

  @IsOptional()
  @IsEnum(ServiceContractStatus)
  status?: ServiceContractStatus

  @IsOptional()
  @IsEnum(ServiceContractRole)
  role?: ServiceContractRole

  @IsOptional()
  @IsDateString()
  startsAt?: string

  @IsOptional()
  @IsDateString()
  endsAt?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  locationIds?: string[]
}
