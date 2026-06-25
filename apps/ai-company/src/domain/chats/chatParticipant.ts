export type ParticipantType = 'owner' | 'employee' | 'system'

export type ChatParticipant = {
  id: string
  type: ParticipantType
  employeeId?: string
  displayName: string
  role: string
  joinedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseChatParticipant(value: unknown): ChatParticipant | null {
  if (!isRecord(value)) return null

  const type =
    value.type === 'owner' || value.type === 'employee' || value.type === 'system'
      ? value.type
      : null

  if (
    !type ||
    typeof value.id !== 'string' ||
    typeof value.displayName !== 'string' ||
    typeof value.role !== 'string' ||
    typeof value.joinedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    type,
    employeeId: typeof value.employeeId === 'string' ? value.employeeId : undefined,
    displayName: value.displayName,
    role: value.role,
    joinedAt: value.joinedAt,
  }
}

export function createOwnerParticipant(joinedAt: string, displayName: string): ChatParticipant {
  return {
    id: 'owner',
    type: 'owner',
    displayName,
    role: 'owner',
    joinedAt,
  }
}

export function createEmployeeParticipant(
  employeeId: string,
  displayName: string,
  role: string,
  joinedAt: string,
): ChatParticipant {
  return {
    id: employeeId,
    type: 'employee',
    employeeId,
    displayName,
    role,
    joinedAt,
  }
}

export function createSystemParticipant(joinedAt: string): ChatParticipant {
  return {
    id: 'system',
    type: 'system',
    displayName: 'System',
    role: 'system',
    joinedAt,
  }
}
