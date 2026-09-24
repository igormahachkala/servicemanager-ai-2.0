import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

export class PublicTokenQueryDto {
  @IsString()
  @IsNotEmpty()
  token!: string

  @IsOptional()
  @IsUUID()
  locationId?: string
}
