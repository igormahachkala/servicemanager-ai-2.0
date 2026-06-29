import { IsString, MaxLength, MinLength } from 'class-validator'

export class CreateAgentTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  prompt!: string
}
