// backend/src/policy/policy.utils.ts

import { ForbiddenException } from '@nestjs/common';
import type { AllowDecision, PolicyDecision } from './policy.types';

/**
 * ВАЖНО: это assertion-функция.
 * После assertAllowed(decision) TypeScript знает, что decision.allowed === true,
 * а decision.where существует (для allow(payload)).
 */
export function assertAllowed<T>(d: PolicyDecision<T>): asserts d is AllowDecision<T> {
  if (!d.allowed) throw new ForbiddenException(d.reason);
}
