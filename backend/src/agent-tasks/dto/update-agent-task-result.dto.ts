import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateAgentTaskResultDto {
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  result?: string
}
