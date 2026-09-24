import { AssignmentCandidate, AssignmentDecision, AssignmentStrategy } from './assignment.types';

export function decideAssignment(
  strategy: AssignmentStrategy,
  candidates: AssignmentCandidate[],
  opts?: { seed?: string },
): AssignmentDecision {
  if (!candidates || candidates.length === 0) {
    return { assignedTechnicianId: null, strategy, reason: 'no_candidates' };
  }

  if (strategy === 'first_candidate') {
    return { assignedTechnicianId: candidates[0].id, strategy, reason: 'first_candidate' };
  }

  if (strategy === 'round_robin_cursor_v2') {
    // Этот режим требует persisted cursor (DB) и решается в AssignmentService.
    // Здесь оставляем safe fallback, чтобы не было неожиданных падений, если кто-то вызовет decideAssignment напрямую.
    return { assignedTechnicianId: candidates[0].id, strategy, reason: 'cursor_v2_requires_db_fallback_first' };
  }

  // round_robin_createdAt (v1):
  // детерминированный выбор по seed (например ticketId) => убираем “всегда первый”.
  const seed = (opts?.seed ?? '').toString();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const idx = hash % candidates.length;

  return {
    assignedTechnicianId: candidates[idx].id,
    strategy,
    reason: `hash(seed)%N=${idx}`,
  };
}
