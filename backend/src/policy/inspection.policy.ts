import { allow, deny, type PolicyDecision } from './policy.types'
import { UserRole } from '@prisma/client'

export type InspectionUserCtx = {
  id: string
  companyId: string
  role: UserRole
}

const TEMPLATE_MANAGE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
]

/**
 * SMA-ROUNDS-V1-SCHEDULE-CRUD-098.
 *
 * Planning a round and performing one are different capabilities and must not be inferred
 * from a single role check: a technician executes rounds but does not plan them.
 *
 * The management set is deliberately identical to TEMPLATE_MANAGE_ROLES rather than a new
 * matrix. Both are backed by the same canonical grant — LOCATIONS_MANAGE in
 * common/permissions-matrix.ts, held by ADMIN (client and provider), MASTER+PROVIDER and
 * DISPATCHER+PROVIDER, and NOT by TECHNICIAN, NETWORK_DIRECTOR, TERRITORIAL_MANAGER or
 * CLIENT. The controller requires that permission on every management route, so this list
 * narrows by role and the guard narrows by grant; neither invents a power the matrix does
 * not already give.
 */
const SCHEDULE_MANAGE_ROLES: UserRole[] = TEMPLATE_MANAGE_ROLES

const RUN_EXECUTION_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TECHNICIAN,
]

export class InspectionPolicy {
  canCreateTemplate(user: InspectionUserCtx): PolicyDecision {
    if (TEMPLATE_MANAGE_ROLES.includes(user.role)) return allow()
    return deny('Role cannot manage inspection templates')
  }

  canStartRun(user: InspectionUserCtx): PolicyDecision {
    if (RUN_EXECUTION_ROLES.includes(user.role)) return allow()
    return deny('Role cannot start inspection runs')
  }

  canUpdateRunItem(user: InspectionUserCtx): PolicyDecision {
    if (RUN_EXECUTION_ROLES.includes(user.role)) return allow()
    return deny('Role cannot update inspection run items')
  }

  canUploadAttachment(user: InspectionUserCtx): PolicyDecision {
    if (RUN_EXECUTION_ROLES.includes(user.role)) return allow()
    return deny('Role cannot upload inspection attachments')
  }

  canCreateTicket(user: InspectionUserCtx): PolicyDecision {
    if (RUN_EXECUTION_ROLES.includes(user.role)) return allow()
    return deny('Role cannot create ticket from inspection item')
  }

  canCompleteRun(user: InspectionUserCtx): PolicyDecision {
    if (RUN_EXECUTION_ROLES.includes(user.role)) return allow()
    return deny('Role cannot complete inspection runs')
  }

  canSubmitReport(user: InspectionUserCtx): PolicyDecision {
    if (RUN_EXECUTION_ROLES.includes(user.role)) return allow()
    return deny('Role cannot submit inspection reports')
  }

  canReviewReport(user: InspectionUserCtx): PolicyDecision {
    if (TEMPLATE_MANAGE_ROLES.includes(user.role)) return allow()
    return deny('Role cannot review inspection reports')
  }

  /** 098: plan, edit and retire schedules. Distinct from canStartRun — see SCHEDULE_MANAGE_ROLES. */
  canManageSchedule(user: InspectionUserCtx): PolicyDecision {
    if (SCHEDULE_MANAGE_ROLES.includes(user.role)) return allow()
    return deny('Role cannot manage inspection schedules')
  }

  /**
   * 098: see schedules at all. Executors are included because a technician must be able to
   * read the rounds planned for them; the service narrows that list to their own assignments.
   */
  canViewSchedules(user: InspectionUserCtx): PolicyDecision {
    if (RUN_EXECUTION_ROLES.includes(user.role)) return allow()
    return deny('Role cannot view inspection schedules')
  }
}