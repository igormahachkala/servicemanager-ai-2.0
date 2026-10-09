import type { Role } from './api'

/**
 * Подзадача — заявка с непустым parentId.
 * Родитель этой проверки не проходит: у него parentId нет.
 */
export function isChildTicket(ticket: { parentId?: string | null }): boolean {
  return typeof ticket.parentId === 'string' && ticket.parentId.trim().length > 0
}

const CHILD_TICKET_CREATE_ROLES: Role[] = [
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'CLIENT',
  'TERRITORIAL_MANAGER',
  'TECHNICIAN',
]

/** Те же роли, что у POST /tickets. */
export function roleCanCreateChildTicket(role?: Role | null): boolean {
  return !!role && CHILD_TICKET_CREATE_ROLES.includes(role)
}

/** Отвязка подзадачи от родителя. Только ADMIN. */
export function roleCanDetachChildTicket(role?: Role | null): boolean {
  return role === 'ADMIN'
}
