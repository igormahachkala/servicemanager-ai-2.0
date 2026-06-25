export const AUDIT_ACTOR_TYPES = ['owner', 'employee', 'system'] as const

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number]

export const AUDIT_TARGET_TYPES = [
  'tool',
  'employee',
  'workspace',
  'task',
  'report',
  'permission',
  'assignment',
  'discussion',
  'memory',
  'approval',
  'run',
  'system',
] as const

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number]

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'invoke',
  'assign',
  'unassign',
  'approve',
  'reject',
  'review',
  'publish',
  'login',
  'configure',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]
