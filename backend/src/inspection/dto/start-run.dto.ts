import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class StartRunDto {
  @IsUUID()
  templateId!: string

  @IsUUID()
  locationId!: string

  @IsOptional()
  @IsUUID()
  equipmentId?: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string
}
