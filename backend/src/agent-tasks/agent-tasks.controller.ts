import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'

import { JwtAuthGuard } from '../auth/jwt.guard'

import { AgentTasksService } from './agent-tasks.service'
import { EngineeringAgentGuard } from './engineering-agent.guard'
import { type AgentTaskUserCtx } from './agent-tasks.access'
import { CreateAgentTaskDto } from './dto/create-agent-task.dto'
import { UpdateAgentTaskStatusDto } from './dto/update-agent-task-status.dto'
import { UpdateAgentTaskResultDto } from './dto/update-agent-task-result.dto'

@UseGuards(JwtAuthGuard, EngineeringAgentGuard)
@Controller('agent-tasks')
export class AgentTasksController {
  constructor(private readonly svc: AgentTasksService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(this.userFromRequest(req))
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateAgentTaskDto) {
    return this.svc.create(this.userFromRequest(req), dto)
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.svc.get(this.userFromRequest(req), id)
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAgentTaskStatusDto) {
    return this.svc.updateStatus(this.userFromRequest(req), id, dto)
  }

  @Patch(':id/result')
  updateResult(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAgentTaskResultDto) {
    return this.svc.updateResult(this.userFromRequest(req), id, dto)
  }

  private userFromRequest(req: any): AgentTaskUserCtx {
    return {
      id: req.user.id,
      companyId: req.user.companyId,
      role: req.user.role,
      email: req.user.email,
    }
  }
}
