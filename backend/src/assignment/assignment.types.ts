export type AssignmentCandidate = {
  id: string;
  email?: string;
  matchedSpecializationsCount: number;
  assignedCount: number;
  inProgressCount: number;
  activeLoad: number;
};

export type AssignmentContext = {
  companyId: string;
  ticketId?: string;
  problemCategoryId: string;
  specializationIds: string[];
};

export type AssignmentStrategy =
  | 'first_candidate'
  | 'round_robin_createdAt'
  | 'round_robin_cursor_v2';

export type AssignmentDecision =
  | { assignedTechnicianId: string; strategy: AssignmentStrategy; reason: string }
  | { assignedTechnicianId: null; strategy: AssignmentStrategy; reason: string };
