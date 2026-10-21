// TODO_REMOVE_AFTER_STABILIZATION — temporary executor diagnostics endpoint

import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { Roles } from './roles.decorator'
import { RolesGuard } from './roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { EXECUTOR_CAPABLE_ROLES, isExecutorEligible } from './executor.utils'
import { resolveTechnicianOperationalScope } from '../tickets/ticket-access.utils'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('debug')
export class DebugController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  // TODO_REMOVE_AFTER_STABILIZATION
  @Get('executors/:id')
  @Roles(UserRole.ADMIN)
  async getExecutorDiagnostics(@Req() req: any, @Param('id') executorId: string) {
    const companyId: string = req.user.companyId

    const user = await this.prisma.user.findFirst({
      where: { id: executorId, companyId },
      select: {
        id: true,
        role: true,
        isExecutor: true,
        isActive: true,
        technicianSpecializations: {
          select: {
            specialization: { select: { id: true, name: true } },
          },
        },
        locationBindings: {
          where: { companyId },
          select: { locationId: true, companyId: true },
        },
      },
    })

    if (!user) {
      return { found: false, executorId, companyId }
    }

    const eligible = isExecutorEligible({ role: user.role, isExecutor: user.isExecutor })

    const [rolePermissions, userPermissions] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where: { role: user.role },
        select: { permissionBlock: { select: { code: true } } },
      }),
      this.prisma.userPermission.findMany({
        where: { userId: executorId },
        select: { permissionBlock: { select: { code: true } } },
      }),
    ])

    const permissions = [
      ...rolePermissions.map((p) => p.permissionBlock.code),
      ...userPermissions.map((p) => p.permissionBlock.code),
    ]

    let operationalScope: Record<string, unknown> | null = null
    if (eligible) {
      try {
        const scope = await resolveTechnicianOperationalScope({
          prisma: this.prisma,
          serviceContractsService: this.serviceContractsService,
          actor: { id: executorId, role: user.role, companyId },
        })
        operationalScope = {
          companyIds: scope.companyIds,
          allowTechnicianClaim: scope.allowTechnicianClaim,
          specializationIds: scope.specializationIds,
          specializationNames: scope.specializationNames,
        }
      } catch (e: unknown) {
        operationalScope = { error: e instanceof Error ? e.message : String(e) }
      }
    }

    const candidateCheck = await this.prisma.user.findFirst({
      where: {
        id: executorId,
        companyId,
        isExecutor: true,
        role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) },
        isActive: true,
      },
      select: { id: true },
    })

    return {
      found: true,
      executorId,
      companyId,
      role: user.role,
      isExecutor: user.isExecutor,
      isActive: user.isActive,
      executorEligible: eligible,
      assignmentCandidateEligible: !!candidateCheck,
      permissions,
      specializations: user.technicianSpecializations.map((s) => ({
        id: s.specialization.id,
        name: s.specialization.name,
      })),
      locationBindingCount: user.locationBindings.length,
      locationBindings: user.locationBindings,
      operationalScope,
    }
  }
}
