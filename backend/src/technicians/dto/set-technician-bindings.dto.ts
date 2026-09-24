import { Type } from 'class-transformer'
import { ArrayUnique, IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator'

class TechnicianBindingItemDto {
  @IsUUID()
  clientCompanyId!: string

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  locationIds?: string[]
}

export class SetTechnicianBindingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicianBindingItemDto)
  bindings!: TechnicianBindingItemDto[]
}