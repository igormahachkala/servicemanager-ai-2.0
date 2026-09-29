import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateFailureCauseDto {
  @IsString()
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
