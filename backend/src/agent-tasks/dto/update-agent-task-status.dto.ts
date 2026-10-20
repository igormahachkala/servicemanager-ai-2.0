import { IsEnum } from 'class-validator'
import { AgentTaskStatus } from '@prisma/client'

export class UpdateAgentTaskStatusDto {
  @IsEnum(AgentTaskStatus)
  status!: AgentTaskStatus
}
