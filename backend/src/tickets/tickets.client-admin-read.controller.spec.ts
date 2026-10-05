import { UserRole } from '@prisma/client'

import { ROLES_KEY } from '../common/roles.decorator'
import { TicketsController } from './tickets.controller'

function rolesFor(method: keyof TicketsController): UserRole[] {
  return Reflect.getMetadata(ROLES_KEY, TicketsController.prototype[method]) ?? []
}

describe('TicketsController CLIENT_ADMIN read admission', () => {
  it.each([
    'board',
    'getOne',
    'listFailureCausesForTicket',
    'listAttachments',
  ] as const)('admits CLIENT_ADMIN to read-only route %s', (method) => {
    expect(rolesFor(method)).toContain(UserRole.CLIENT_ADMIN)
  })

  it.each([
    'uploadAttachment',
    'deleteAttachment',
    'update',
    'assign',
    'assignSmart',
    'claim',
    'updateStatus',
    'submitAcceptance',
    'addComment',
    'decide',
  ] as const)('does not admit CLIENT_ADMIN to mutation route %s', (method) => {
    expect(rolesFor(method)).not.toContain(UserRole.CLIENT_ADMIN)
  })
})
