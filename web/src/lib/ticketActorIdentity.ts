import type * as api from './api'
import { getRoleDisplayLabel } from './resolveAdminProfile'

export type ActorIdentityInput = Partial<api.TicketActorIdentity> | null | undefined

export type TicketIdentityPresentation = {
  organization: string
  name: string
  role: string
}

type TicketWithCreatorIdentity = {
  company?: api.IdentityCompany | null
  requesterName?: string | null
  createdByUser?: ActorIdentityInput
}

type TicketWithAssigneeIdentity = {
  assignedTechnician?: ActorIdentityInput
  assigneeCompany?: api.IdentityCompany | null
  assignedCompany?: api.IdentityCompany | null
  contractorCompany?: api.IdentityCompany | null
  providerCompany?: api.IdentityCompany | null
}

function clean(value?: string | null): string {
  return (value || '').trim()
}

function cleanUnknown(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function displayCompanyName(company?: api.IdentityCompany | null, fallback = 'Организация не указана'): string {
  return clean(company?.legalName) || clean(company?.name) || clean(company?.brandName) || fallback
}

function actorName(actor?: ActorIdentityInput, fallback = 'Сотрудник не указан'): string {
  const lastName = clean(actor?.lastName)
  const firstName = clean(actor?.firstName)
  const fullName = [lastName, firstName].filter(Boolean).join(' ').trim()
  return fullName || clean(actor?.email) || fallback
}

function actorRole(actor?: ActorIdentityInput, fallback = 'Роль не указана'): string {
  const role = clean(actor?.role)
  if (!role) return fallback

  const companyType = actor?.company?.type ?? null
  if (companyType === 'CLIENT') {
    if (role === 'ADMIN') return 'Администратор клиента'
    if (role === 'CLIENT') return 'Представитель клиента'
    if (role === 'TERRITORIAL_MANAGER') return 'Территориальный менеджер клиента'
    if (role === 'NETWORK_DIRECTOR') return 'Сетевой директор клиента'
  }

  if (companyType === 'PROVIDER') {
    if (role === 'ADMIN' || role === 'ADMIN_PROVIDER') return 'Администратор подрядчика'
    if (role === 'DISPATCHER') return 'Диспетчер подрядчика'
    if (role === 'MASTER') return 'Мастер подрядчика'
    if (role === 'TECHNICIAN') return 'Техник подрядчика'
  }

  const label = getRoleDisplayLabel({ role, companyType })
  return label === '—' ? fallback : label
}

export function presentActorIdentity(
  actor: ActorIdentityInput,
  options?: {
    company?: api.IdentityCompany | null
    organizationFallback?: string
    nameFallback?: string
    roleFallback?: string
  },
): TicketIdentityPresentation {
  const company = actor?.company ?? options?.company ?? null
  return {
    organization: displayCompanyName(company, options?.organizationFallback),
    name: actorName(actor, options?.nameFallback),
    role: actorRole(actor, options?.roleFallback),
  }
}

export function presentTicketCreator(ticket?: TicketWithCreatorIdentity | null): TicketIdentityPresentation {
  const creator = ticket?.createdByUser ?? null
  if (creator) {
    return presentActorIdentity(creator, {
      company: creator.company ?? ticket?.company ?? null,
      nameFallback: 'Создатель не указан',
    })
  }

  return {
    organization: displayCompanyName(ticket?.company, 'Организация создателя не указана'),
    name: clean(ticket?.requesterName) || 'Создатель не указан',
    role: clean(ticket?.requesterName) ? 'Заявитель' : 'Роль не указана',
  }
}

export function presentTimelineCreator(actor: ActorIdentityInput, payload?: Record<string, unknown> | null): TicketIdentityPresentation {
  if (actor) return presentActorIdentity(actor, { nameFallback: 'Создатель не указан' })

  const requesterName = cleanUnknown(payload?.requesterName)
  const source = cleanUnknown(payload?.source)
  return {
    organization: 'Организация создателя не указана',
    name: requesterName || 'Создатель не указан',
    role: requesterName || source === 'PUBLIC_QUICK_REQUEST' ? 'Заявитель' : 'Роль не указана',
  }
}

export function presentTicketAssignee(ticket?: TicketWithAssigneeIdentity | null): TicketIdentityPresentation {
  const assignee = ticket?.assignedTechnician ?? null
  if (assignee) {
    return presentActorIdentity(assignee, {
      nameFallback: 'Исполнитель не выбран',
      roleFallback: 'Исполнитель',
    })
  }

  const assignedCompany =
    ticket?.assigneeCompany ??
    ticket?.assignedCompany ??
    ticket?.contractorCompany ??
    ticket?.providerCompany ??
    null

  return {
    organization: displayCompanyName(assignedCompany, 'Организация исполнителя не указана'),
    name: 'Исполнитель не выбран',
    role: 'Роль не указана',
  }
}

export function identityLines(identity: TicketIdentityPresentation): string[] {
  return [identity.organization, identity.name, identity.role].map(clean).filter(Boolean)
}

export function identityBlockText(title: string, identity: TicketIdentityPresentation): string {
  return [title, ...identityLines(identity)].join('\n')
}

export function compactIdentityLabel(identity: TicketIdentityPresentation): string {
  const lines = identityLines(identity)
  return lines.length ? lines.join(' · ') : '—'
}

export function compactTicketCreatorLabel(ticket?: TicketWithCreatorIdentity | null): string {
  return compactIdentityLabel(presentTicketCreator(ticket))
}

export function compactTicketAssigneeLabel(ticket?: TicketWithAssigneeIdentity | null): string {
  return compactIdentityLabel(presentTicketAssignee(ticket))
}
