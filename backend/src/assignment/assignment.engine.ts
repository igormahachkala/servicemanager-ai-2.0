import { Injectable } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { matchCategorySpecializationLinks } from '../tickets/ticket-specialization-match.utils';

export type AssignmentInput = {
  ticketId: string;
  companyId: string;
  locationId: string;
  locationCompanyId?: string;
  categoryId?: string;
  categoryCompanyId?: string;
};

type TechnicianCandidate = {
  technicianId: string;
  locationBindings: string[];
  specializationIds: string[];
  specializationNames: string[];
  activeTicketsCount: number;
};

export type AssignmentSelectedTechnician = {
  technicianId: string;
  reason: string;
  candidatesCount: number;
  score: number;
};

export type AssignmentDecisionLog = {
  ticketId: string;
  chosenTechnicianId: string | null;
  candidatesCount: number;
  reason: string;
  createdAt: string;
};

@Injectable()
export class AssignmentEngine {
  constructor(private readonly prisma: PrismaService) {}

  async selectTechnicianForTicket(
    params: AssignmentInput,
  ): Promise<AssignmentSelectedTechnician | null> {
    const locationCompanyId = params.locationCompanyId ?? params.companyId;
    const candidates = await this.getAvailableTechnicians(params.companyId, locationCompanyId);

    const withLocationAccess = candidates.filter((t) => {
      if (t.locationBindings.length === 0) return true;
      return t.locationBindings.includes(params.locationId);
    });

    let filtered = withLocationAccess;
    let categoryLinks: { specializationId: string; specialization: { name: string | null } | null }[] = [];
    let reason = 'least_loaded + location_match';
    if (params.categoryId) {
      categoryLinks = await this.getCategorySpecializationLinks(
        params.categoryCompanyId ?? params.companyId,
        params.categoryId,
      );
      if (categoryLinks.length > 0) {
        filtered = filtered.filter((t) => {
          const matched = matchCategorySpecializationLinks({
            categoryLinks,
            technicianSpecializationIds: t.specializationIds,
            technicianSpecializationNames: t.specializationNames,
          });
          return matched.length > 0;
        });
        reason = 'least_loaded + location_match + category_match';
      }
    }

    if (filtered.length === 0) {
      await this.logDecision({
        ticketId: params.ticketId,
        chosenTechnicianId: null,
        candidatesCount: withLocationAccess.length,
        reason: 'no_candidates_after_filters',
        createdAt: new Date().toISOString(),
      });
      return null;
    }

    const scored = filtered.map((candidate) => {
      const locationMatch = candidate.locationBindings.includes(params.locationId);
      const categoryMatch =
        categoryLinks.length > 0 &&
        matchCategorySpecializationLinks({
          categoryLinks,
          technicianSpecializationIds: candidate.specializationIds,
          technicianSpecializationNames: candidate.specializationNames,
        }).length > 0;
      const score =
        (locationMatch ? 50 : 0) +
        (categoryMatch ? 30 : 0) -
        candidate.activeTicketsCount * 10;
      return { candidate, score };
    });

    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.candidate.activeTicketsCount !== b.candidate.activeTicketsCount) {
        return a.candidate.activeTicketsCount - b.candidate.activeTicketsCount;
      }
      return a.candidate.technicianId.localeCompare(b.candidate.technicianId);
    });

    const selected = scored[0];
    const reasonWithScore = `${reason};score=${selected.score}`;
    await this.logDecision({
      ticketId: params.ticketId,
      chosenTechnicianId: selected.candidate.technicianId,
      candidatesCount: filtered.length,
      reason: reasonWithScore,
      createdAt: new Date().toISOString(),
    });
    return {
      technicianId: selected.candidate.technicianId,
      reason,
      candidatesCount: filtered.length,
      score: selected.score,
    };
  }

  private async logDecision(decision: AssignmentDecisionLog) {
    await this.prisma.assignmentDecision.create({
      data: {
        ticketId: decision.ticketId,
        technicianId: decision.chosenTechnicianId,
        candidatesCount: decision.candidatesCount,
        reason: decision.reason,
      },
    });
  }

  private async getCategorySpecializationLinks(
    companyId: string,
    categoryId: string,
  ): Promise<{ specializationId: string; specialization: { name: string | null } | null }[]> {
    const links = await this.prisma.problemCategorySpecialization.findMany({
      where: {
        problemCategoryId: categoryId,
        problemCategory: { companyId, isActive: true },
      },
      select: {
        specializationId: true,
        specialization: { select: { name: true } },
      },
    });
    return links;
  }

  private async getAvailableTechnicians(
    companyId: string,
    locationCompanyId: string,
  ): Promise<TechnicianCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        role: UserRole.TECHNICIAN,
        isActive: true,
      },
      select: {
        id: true,
        locationBindings: {
          where: {
            companyId: locationCompanyId,
            location: { clientCompanyId: locationCompanyId, isActive: true },
          },
          select: { locationId: true },
        },
        technicianSpecializations: {
          select: {
            specializationId: true,
            specialization: { select: { name: true } },
          },
        },
        assignedTickets: {
          where: {
            status: { in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
          },
          select: { id: true },
        },
      },
    });

    return users.map((u) => ({
      technicianId: u.id,
      locationBindings: u.locationBindings.map((x) => x.locationId),
      specializationIds: u.technicianSpecializations.map(
        (x) => x.specializationId,
      ),
      specializationNames: u.technicianSpecializations
        .map((x) => (x.specialization?.name || '').trim())
        .filter((x) => x.length > 0),
      activeTicketsCount: u.assignedTickets.length,
    }));
  }
}
