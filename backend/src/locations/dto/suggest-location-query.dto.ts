import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class SuggestLocationQueryDto {
  @IsString()
  @IsNotEmpty()
  q!: string

  @IsOptional()
  @IsString()
  city?: string
}
