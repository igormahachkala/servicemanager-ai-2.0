import { ForbiddenException } from '@nestjs/common';
import { PolicyDecision } from './policy.types';

export function assertAllowed(decision: PolicyDecision): void {
  if (!decision.allow) throw new ForbiddenException(decision.reason ?? 'Forbidden by policy');
}
