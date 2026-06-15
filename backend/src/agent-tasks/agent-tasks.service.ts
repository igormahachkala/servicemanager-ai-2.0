import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AgentTaskStatus, Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'

import { type AgentTaskUserCtx } from './agent-tasks.access'
import { CreateAgentTaskDto } from './dto/create-agent-task.dto'
import { UpdateAgentTaskStatusDto } from './dto/update-agent-task-status.dto'
import { UpdateAgentTaskResultDto } from './dto/update-agent-task-result.dto'

/**
 * Engineering Agent task store (MVP). Persists tasks and their results only —
 * it never executes anything. Access is enforced upstream by
 * EngineeringAgentGuard; every query here is additionally scoped by companyId.
 */
@Injectable()
export class AgentTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AgentTaskUserCtx) {
    return this.prisma.agentTask.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ createdAt: 'desc' }],
      select: taskSelect(),
    })
  }

  async get(user: AgentTaskUserCtx, id: string) {
    const task = await this.prisma.agentTask.findFirst({
      where: { id, companyId: user.companyId },
      select: taskSelect(),
    })
    if (!task) throw new NotFoundException('Agent task not found')
    return task
  }

  async create(user: AgentTaskUserCtx, dto: CreateAgentTaskDto) {
    const title = dto.title.trim()
    const prompt = dto.prompt.trim()
    if (!title) throw new BadRequestException('Task title is required')
    if (!prompt) throw new BadRequestException('Task prompt is required')

    return this.prisma.agentTask.create({
      data: {
        companyId: user.companyId,
        createdByUserId: user.id,
        title,
        prompt,
        status: AgentTaskStatus.NEW,
      },
      select: taskSelect(),
    })
  }

  async updateStatus(user: AgentTaskUserCtx, id: string, dto: UpdateAgentTaskStatusDto) {
    await this.requireTask(user.companyId, id)

    return this.prisma.agentTask.update({
      where: { id },
      data: { status: dto.status },
      select: taskSelect(),
    })
  }

  async updateResult(user: AgentTaskUserCtx, id: string, dto: UpdateAgentTaskResultDto) {
    await this.requireTask(user.companyId, id)

    return this.prisma.agentTask.update({
      where: { id },
      data: { result: dto.result?.trim() || null },
      select: taskSelect(),
    })
  }

  private async requireTask(companyId: string, id: string) {
    const task = await this.prisma.agentTask.findFirst({
      where: { id, companyId },
      select: { id: true },
    })
    if (!task) throw new NotFoundException('Agent task not found')
    return task
  }
}

function taskSelect() {
  return {
    id: true,
    companyId: true,
    title: true,
    prompt: true,
    status: true,
    result: true,
    createdAt: true,
    updatedAt: true,
    createdBy: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
  } satisfies Prisma.AgentTaskSelect
}
