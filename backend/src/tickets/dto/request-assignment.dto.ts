import { IsOptional, IsString } from 'class-validator'

export class RequestAssignmentDto {
  @IsOptional()
  @IsString()
  targetUserId?: string
}
