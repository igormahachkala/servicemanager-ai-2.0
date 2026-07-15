import { ServiceContractRole, ServiceContractStatus } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateServiceContractDto {
  @IsOptional()
  @IsEnum(ServiceContractStatus)
  status?: ServiceContractStatus

  @IsOptional()
  @IsEnum(ServiceContractRole)
  role?: ServiceContractRole

  @IsOptional()
  @IsDateString()
  startsAt?: string | null

  @IsOptional()
  @IsDateString()
  endsAt?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null
}
