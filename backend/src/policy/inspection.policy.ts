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
}