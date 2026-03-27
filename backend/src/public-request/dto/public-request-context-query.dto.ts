import { IsOptional, IsUUID } from 'class-validator'

export class PublicRequestContextQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string
}
