import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus, UserAccessLocationMode, UserRole } from '@prisma/client';

import { EXECUTOR_CAPABLE_ROLES } from '../common/executor.utils';
import {
  interpretUserAccessLocationScope,
  uniqueLocationIds,
} from '../common/user-access-scope-mode.utils';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { resolveServiceContractLocationScope } from '../service-contracts/service-contract-location-scope';
import { matchCategorySpecializationLinks } from '../tickets/ticket-specialization-match.utils';

const companyIdentitySelect = {
  id: true,
  name: true,
  legalName: true,
  brandName: true,
  type: true,
} as const;

type CompanyIdentity = Prisma.CompanyGetPayload<{ select: typeof companyIdentitySelect }>;

type LocationBindingAccessClient = Pick<
  Prisma.TransactionClient,
  'user' | 'userAccessScope' | 'userLocationBinding'
>;

export type AssignmentRequiredSpecialization = {
  id: string;
  name: string;
  isActive: boolean;
};

export type AssignmentEligibilityCandidate = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  companyId: string;
  company: CompanyIdentity;
  matched: boolean;
  matchedBy: string[];
  matchReason: 'fallback_no_category_specializations' | 'category_specialization' | 'no_match';
  assignedCount: number;
  inProgressCount: number;
  activeLoad: number;
  specializations: { id: string; name: string; isActive: boolean }[];
};

function locationAccessKey(userId: string, companyId: string) {
  return `${userId}:${companyId}`;
}

@Injectable()
export class AssignmentEligibilityResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async listAllTechnicians(
    companyIds: string | string[],
    requiredSpecializations: AssignmentRequiredSpecialization[],
    options?: { fallbackToAllWhenNoSpecializations?: boolean },
    accessClient: Pick<Prisma.TransactionClient, 'user'> = this.prisma,
  ): Promise<AssignmentEligibilityCandidate[]> {
    const companyIdsArray = Array.isArray(companyIds) ? companyIds : [companyIds];
    const requiredIds = requiredSpecializations.map((x) => x.id);
    const fallbackToAllWhenNoSpecializations =
      !!options?.fallbackToAllWhenNoSpecializations && requiredIds.length === 0;

    const techs = await accessClient.user.findMany({
      where: {
        companyId: companyIdsArray.length === 1 ? companyIdsArray[0] : { in: companyIdsArray },
        isExecutor: true,
        isActive: true,
        deletedAt: null,
        role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        company: { select: companyIdentitySelect },
        technicianSpecializations: {
          include: { specialization: true },
        },
        assignedTickets: {
          where: {
            status: {
              in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return techs.map((t) => {
      const matchedLabels = matchCategorySpecializationLinks({
        categoryLinks: requiredSpecializations.map((s) => ({
          specializationId: s.id,
          specialization: { name: s.name },
        })),
        technicianSpecializationIds: t.technicianSpecializations.map((x) => x.specializationId),
        technicianSpecializationNames: t.technicianSpecializations.map((x) => x.specialization.name),
      });

      const assignedCount = t.assignedTickets.filter((x) => x.status === TicketStatus.ASSIGNED).length;
      const inProgressCount = t.assignedTickets.filter((x) => x.status === TicketStatus.IN_PROGRESS).length;

      return {
        id: t.id,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        role: t.role,
        companyId: t.companyId,
        company: t.company,
        matched: fallbackToAllWhenNoSpecializations || matchedLabels.length > 0,
        matchedBy: matchedLabels,
        matchReason: fallbackToAllWhenNoSpecializations
          ? ('fallback_no_category_specializations' as const)
          : matchedLabels.length > 0
            ? ('category_specialization' as const)
            : ('no_match' as const),
        assignedCount,
        inProgressCount,
        activeLoad: assignedCount + inProgressCount,
        specializations: t.technicianSpecializations.map((x) => ({
          id: x.specialization.id,
          name: x.specialization.name,
          isActive: x.specialization.isActive,
        })),
      };
    });
  }

  async listLocationAssignableExecutors(params: {
    employerCompanyId: string;
    scopeCompanyId: string;
    locationId: string;
  }) {
    const all = await this.listAllTechnicians(params.employerCompanyId, [], {
      fallbackToAllWhenNoSpecializations: true,
    });
    return this.filterTechniciansByLocationBindings(all, params.scopeCompanyId, params.locationId);
  }

  async filterTechniciansByLocationBindings<T extends { id: string }>(
    technicians: T[],
    scopeCompanyId: string,
    locationId: string,
    accessClient: LocationBindingAccessClient = this.prisma,
  ): Promise<T[]> {
    if (technicians.length === 0) return technicians;

    const technicianIds = Array.from(new Set(technicians.map((item) => item.id)));
    const activeUsers = await accessClient.user.findMany({
      where: {
        id: { in: technicianIds },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        companyId: true,
      },
    });
    const employerCompanyByUserId = new Map(activeUsers.map((item) => [item.id, item.companyId]));
    const activeTechnicianIds = technicianIds.filter((id) => employerCompanyByUserId.has(id));
    if (activeTechnicianIds.length === 0) return [];

    const contractLocationsByEmployer = new Map<string, Set<string> | null>();
    const providerCompanyIds = uniqueLocationIds(
      activeUsers
        .map((item) => item.companyId)
        .filter((companyId) => companyId !== scopeCompanyId),
    );
    await Promise.all(
      providerCompanyIds.map(async (providerCompanyId) => {
        const access = await this.serviceContractsService.getLinkedClientAccess(providerCompanyId, scopeCompanyId);
        if (!access) {
          contractLocationsByEmployer.set(providerCompanyId, new Set());
          return;
        }
        const contractLocationScope = access.effectiveLocationScope ?? resolveServiceContractLocationScope({
          locationMode: access.locationMode,
          locationIds: access.locations?.map((row) => row.locationId) ?? [],
        });
        contractLocationsByEmployer.set(
          providerCompanyId,
          contractLocationScope.mode === 'tenant_wide'
            ? null
            : new Set(contractLocationScope.locationIds),
        );
      }),
    );

    const employerCompanyIds = uniqueLocationIds(activeUsers.map((item) => item.companyId));
    const bindingCompanyIds = uniqueLocationIds([...employerCompanyIds, scopeCompanyId]);
    const [accessScopes, bindings] = await Promise.all([
      accessClient.userAccessScope.findMany({
        where: {
          userId: { in: activeTechnicianIds },
          companyId: { in: employerCompanyIds },
        },
        select: {
          userId: true,
          companyId: true,
          locationMode: true,
        },
      }),
      accessClient.userLocationBinding.findMany({
        where: {
          userId: { in: activeTechnicianIds },
          companyId: { in: bindingCompanyIds },
          location: {
            clientCompanyId: scopeCompanyId,
            isActive: true,
            deletedAt: null,
          },
        },
        select: {
          userId: true,
          companyId: true,
          locationId: true,
        },
      }),
    ]);

    const explicitScopeByTechnicianCompany = new Map<string, UserAccessLocationMode>();
    for (const scope of accessScopes) {
      explicitScopeByTechnicianCompany.set(
        locationAccessKey(scope.userId, scope.companyId),
        scope.locationMode,
      );
    }

    const bindingsByTechnicianCompany = new Map<string, Set<string>>();
    for (const binding of bindings) {
      const key = locationAccessKey(binding.userId, binding.companyId);
      if (!bindingsByTechnicianCompany.has(key)) {
        bindingsByTechnicianCompany.set(key, new Set<string>());
      }
      bindingsByTechnicianCompany.get(key)!.add(binding.locationId);
    }

    return technicians.filter((technician) => {
      const employerCompanyId = employerCompanyByUserId.get(technician.id);
      if (!employerCompanyId) return false;

      if (employerCompanyId !== scopeCompanyId) {
        const contractLocations = contractLocationsByEmployer.get(employerCompanyId);
        if (contractLocations === undefined || (contractLocations !== null && !contractLocations.has(locationId))) {
          return false;
        }
      }

      const explicitLocationMode =
        explicitScopeByTechnicianCompany.get(locationAccessKey(technician.id, employerCompanyId)) ?? null;
      const candidateBindingCompanyIds = explicitLocationMode
        ? [employerCompanyId]
        : uniqueLocationIds([employerCompanyId, scopeCompanyId]);
      const locationIds = uniqueLocationIds(
        candidateBindingCompanyIds.flatMap((companyId) =>
          Array.from(bindingsByTechnicianCompany.get(locationAccessKey(technician.id, companyId)) ?? []),
        ),
      );
      const interpreted = interpretUserAccessLocationScope({
        explicitLocationMode,
        locationIds,
      });

      if (interpreted.runtimeMode === 'tenant_wide') return true;
      if (interpreted.runtimeMode === 'restricted_empty') return false;
      return interpreted.locationIds.includes(locationId);
    });
  }
}
