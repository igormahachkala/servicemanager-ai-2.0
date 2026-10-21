import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator'

export class SetUserLocationBindingsDto {
  @IsOptional()
  @IsUUID()
  companyId?: string

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  locationIds!: string[]
}
