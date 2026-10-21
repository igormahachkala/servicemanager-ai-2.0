export type WorkflowDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export function allow(): WorkflowDecision {
  return { allowed: true };
}

export function deny(reason: string): WorkflowDecision {
  return { allowed: false, reason };
}
