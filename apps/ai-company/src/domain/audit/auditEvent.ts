import type { AuditAction, AuditActorType, AuditTargetType } from './auditTypes'

export type AuditMetadata = Record<string, string | number | boolean | null>

export type AuditEvent = {
  id: string
  actorType: AuditActorType
  actorId: string
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  workspaceId: string | null
  metadata: AuditMetadata
  createdAt: string
}

export type AuditFilter = {
  actorType?: AuditActorType | 'all'
  action?: AuditAction | 'all'
  targetType?: AuditTargetType | 'all'
  workspaceId?: string | 'all'
}
