import { ConflictException, Injectable } from '@nestjs/common'
import { CompanyType, UserRole, WorkShiftStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'

/**
 * SMA-PROVIDER-SHIFT-POLICY-FOUNDATION-078.
 *
 * The single place that answers "does this actor need an open work shift right now?".
 *
 * The policy is optional, off by default, and deliberately narrow:
 *
 *   * it applies only to PROVIDER companies — a CLIENT company has no field workforce,
 *     so `Company.type` (the existing canonical discriminator) decides applicability.
 *     No second provider flag is introduced;
 *   * within a provider, it applies only to the roles that actually perform work in the
 *     field — TECHNICIAN and MASTER. Management roles (ADMIN, DISPATCHER) organise work
 *     rather than execute it, so blocking them would stop dispatch during the exact
 *     incident where dispatch matters most;
 *   * it governs operational mutations only. Reading a ticket, commenting, attaching a
 *     photo and client acceptance are never gated — a closed shift must not make the
 *     system unreadable.
 *
 * This foundation intentionally does NOT wire enforcement into ticket claim, status,
 * completion or rounds. Those land in 079 and call {@link assertActiveShiftForOperationalWork}
 * so that there is exactly one implementation of the rule.
 *
 * Shift state is read from the existing WorkShift table via the existing OPEN status.
 * No second shift table, no second active-shift resolver, no MAX-specific variant.
 */

/** Canonical machine-readable code for the whole policy. */
export const ACTIVE_SHIFT_REQUIRED = 'ACTIVE_SHIFT_REQUIRED'

/** Canonical RU message shown to the user. */
export const ACTIVE_SHIFT_REQUIRED_MESSAGE =
  'Откройте рабочую смену, чтобы выполнить это действие.'

/**
 * Roles subject to the policy when it is enabled.
 *
 * Kept as an explicit set rather than "everyone except management" so that adding a role
 * to the system does not silently opt it into being blocked.
 */
export const SHIFT_POLICY_SUBJECT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.TECHNICIAN,
  UserRole.MASTER,
])

/**
 * 409 Conflict — the request is well-formed and the actor is authorised; the workspace is
 * simply in the wrong state. That is a conflict, not a permission failure, and using 403
 * here would be indistinguishable from a genuine access denial in both logs and UI.
 */
export class ActiveShiftRequiredException extends ConflictException {
  constructor() {
    super({ code: ACTIVE_SHIFT_REQUIRED, message: ACTIVE_SHIFT_REQUIRED_MESSAGE })
  }
}

export type ShiftPolicyActor = {
  id: string
  companyId: string
  role: UserRole
}

export type ShiftPolicyDecision = {
  /** Whether an open shift is required for operational work by this actor right now. */
  required: boolean
  /** Why — for logging and for 079 to render precise UX without re-deriving the rule. */
  reason:
    | 'policy_disabled'
    | 'company_not_provider'
    | 'role_not_subject'
    | 'required'
    | 'company_not_found'
}

@Injectable()
export class ShiftPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Does the policy apply to this actor?
   *
   * Fails closed on a missing company: an actor whose company cannot be read has no
   * provable exemption, and 079 will surface that as "open a shift" rather than silently
   * letting the work through.
   */
  async isShiftRequiredForActor(actor: ShiftPolicyActor): Promise<ShiftPolicyDecision> {
    if (!SHIFT_POLICY_SUBJECT_ROLES.has(actor.role)) {
      return { required: false, reason: 'role_not_subject' }
    }

    const company = await this.prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { type: true, requireActiveShiftForWork: true },
    })

    if (!company) return { required: true, reason: 'company_not_found' }
    if (company.type !== CompanyType.PROVIDER) {
      return { required: false, reason: 'company_not_provider' }
    }
    if (!company.requireActiveShiftForWork) {
      return { required: false, reason: 'policy_disabled' }
    }

    return { required: true, reason: 'required' }
  }

  /** Is there an open WorkShift for this actor? Reads the existing workforce state only. */
  async hasActiveShift(actor: ShiftPolicyActor): Promise<boolean> {
    const shift = await this.prisma.workShift.findFirst({
      where: { companyId: actor.companyId, userId: actor.id, status: WorkShiftStatus.OPEN },
      select: { id: true },
    })
    return Boolean(shift)
  }

  /**
   * The reusable assertion 079 will call before an operational mutation.
   *
   * Returns quietly when the policy does not apply, so a call site can be added without
   * conditionals; throws {@link ActiveShiftRequiredException} only when the policy applies
   * and no shift is open.
   *
   * Never call this on a read path. Read access is unchanged by this task and must stay so.
   */
  async assertActiveShiftForOperationalWork(actor: ShiftPolicyActor): Promise<void> {
    const decision = await this.isShiftRequiredForActor(actor)
    if (!decision.required) return
    if (await this.hasActiveShift(actor)) return
    throw new ActiveShiftRequiredException()
  }

  /**
   * Whether a company may meaningfully hold the flag at all.
   *
   * Used by the settings path to refuse enabling the policy on a CLIENT company instead of
   * storing a value that could never take effect — a stored-but-inert setting is worse than
   * a rejection, because it reads as configured.
   */
  static canCompanyUseShiftPolicy(companyType: CompanyType): boolean {
    return companyType === CompanyType.PROVIDER
  }
}
