import { Injectable } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AssignmentInput = {
  ticketId: string;
  companyId: string;
  locationId: string;
  categoryId?: string;
};

type TechnicianCandidate = {
  technicianId: string;
  locationBindings: string[];
  specializationIds: string[];
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
    const candidates = await this.getAvailableTechnicians(params.companyId);

    const withLocationAccess = candidates.filter((t) =>
      t.locationBindings.includes(params.locationId),
    );

    let filtered = withLocationAccess;
    let categorySpecIds: string[] = [];
    let reason = 'least_loaded + location_match';
    if (params.categoryId) {
      categorySpecIds = await this.getCategorySpecializationIds(
        params.companyId,
        params.categoryId,
      );
      if (categorySpecIds.length > 0) {
        const required = new Set(categorySpecIds);
        filtered = filtered.filter((t) =>
          t.specializationIds.some((id) => required.has(id)),
        );
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

    const requiredSpecs = new Set(categorySpecIds);
    const scored = filtered.map((candidate) => {
      const locationMatch = candidate.locationBindings.includes(params.locationId);
      const categoryMatch =
        requiredSpecs.size === 0
          ? false
          : candidate.specializationIds.some((id) => requiredSpecs.has(id));
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

  private async getCategorySpecializationIds(
    companyId: string,
    categoryId: string,
  ): Promise<string[]> {
    const links = await this.prisma.problemCategorySpecialization.findMany({
      where: {
        problemCategoryId: categoryId,
        problemCategory: { companyId, isActive: true },
      },
      select: { specializationId: true },
    });
    return links.map((x) => x.specializationId);
  }

  private async getAvailableTechnicians(
    companyId: string,
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
            companyId,
            location: { clientCompanyId: companyId, isActive: true },
          },
          select: { locationId: true },
        },
        technicianSpecializations: {
          select: { specializationId: true },
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
      activeTicketsCount: u.assignedTickets.length,
    }));
  }
}
