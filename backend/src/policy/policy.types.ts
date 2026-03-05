// backend/src/policy/policy.types.ts

export type AllowDecision<T> = {
  allowed: true;
  where: T;
};

export type DenyDecision = {
  allowed: false;
  reason: string;
};

export type PolicyDecision<T = void> = AllowDecision<T> | DenyDecision;

/**
 * allow() — перегрузки:
 * - allow() для "просто разрешить"
 * - allow(payload) для "разрешить и вернуть payload (where/query)"
 */
export function allow(): PolicyDecision<void>;
export function allow<T>(where: T): PolicyDecision<T>;
export function allow<T>(where?: T): PolicyDecision<T | void> {
  if (arguments.length === 0) return { allowed: true, where: undefined } as PolicyDecision<void>;
  return { allowed: true, where: where as T };
}

export function deny(reason: string): PolicyDecision<never> {
  return { allowed: false, reason };
}
