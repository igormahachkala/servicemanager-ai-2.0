import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CloseWorkShiftDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}
