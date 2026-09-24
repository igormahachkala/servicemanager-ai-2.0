import { describe, expect, it } from 'vitest'
import {
  getReturnToFromSearch,
  getWorkspaceFromSearch,
  loginPathWithReturnTo,
  returnToForWorkspace,
  sanitizeInternalAppPath,
  workspaceForInternalPath,
  workspacePathWithReturnTo,
} from './returnToNavigation'

describe('returnToNavigation', () => {
  it('keeps an internal path and builds login/workspace query', () => {
    expect(sanitizeInternalAppPath('/tickets/ticket-42?section=comments#top')).toBe(
      '/tickets/ticket-42?section=comments#top',
    )
    expect(loginPathWithReturnTo('/m/tickets/ticket-42?section=history')).toBe(
      '/login?returnTo=%2Fm%2Ftickets%2Fticket-42%3Fsection%3Dhistory',
    )
    expect(workspacePathWithReturnTo('/max/tickets/ticket-42?section=actions')).toBe(
      '/workspaces?returnTo=%2Fmax%2Ftickets%2Fticket-42%3Fsection%3Dactions',
    )
    expect(workspacePathWithReturnTo(null, 'management')).toBe('/workspaces?workspace=management')
    expect(workspacePathWithReturnTo('/m', 'mobile')).toBe('/workspaces?returnTo=%2Fm&workspace=mobile')
    expect(getWorkspaceFromSearch('?workspace=management')).toBe('management')
    expect(getWorkspaceFromSearch('?workspace=evil')).toBe('')
  })

  it('rejects external and forbidden returnTo values', () => {
    const rejected = [
      'https://evil.example/tickets/ticket-42',
      'http://evil.example/tickets/ticket-42',
      '//evil.example/tickets/ticket-42',
      '/\\evil.example\\tickets\\ticket-42',
      'javascript:alert(1)',
      '/login?returnTo=/tickets/ticket-42',
      '/request-access',
      '/unknown/ticket-42',
    ]
    for (const candidate of rejected) {
      expect(sanitizeInternalAppPath(candidate), candidate).toBe('')
    }
    expect(getReturnToFromSearch('?returnTo=%2Ftickets%2Fticket-42%3Fsection%3Dcomments')).toBe(
      '/tickets/ticket-42?section=comments',
    )
    expect(getReturnToFromSearch('?returnTo=https%3A%2F%2Fevil.example')).toBe('')
    expect(getReturnToFromSearch('?next=%2Fmax%2F&mode=mobile')).toBe('/max/')
    expect(getReturnToFromSearch('?returnTo=%2Fmax%2Ftickets%2F42&next=%2Fm')).toBe('/max/tickets/42')
  })

  it('maps a path to a workspace and ignores a foreign returnTo', () => {
    expect(workspaceForInternalPath('/m')).toBe('mobile')
    expect(workspaceForInternalPath('/m/tickets/abc')).toBe('mobile')
    expect(workspaceForInternalPath('/max/tickets/abc')).toBe('mobile')
    expect(workspaceForInternalPath('/board')).toBe('management')
    expect(workspaceForInternalPath('/tickets/abc')).toBe('management')
    expect(workspaceForInternalPath('/workspaces')).toBe('')
    expect(workspaceForInternalPath('https://evil.example/m')).toBe('')
    expect(workspaceForInternalPath('/login')).toBe('')

    expect(returnToForWorkspace('/m/tickets/abc', 'management')).toBe('')
    expect(returnToForWorkspace('/board', 'mobile')).toBe('')
    expect(returnToForWorkspace('/m/tickets/abc', 'mobile')).toBe('/m/tickets/abc')
    expect(returnToForWorkspace('/board?companyId=1', 'management')).toBe('/board?companyId=1')
    expect(returnToForWorkspace('/max/tickets/abc', 'mobile')).toBe('/max/tickets/abc')
    expect(returnToForWorkspace('/workspaces', 'management')).toBe('')
    expect(returnToForWorkspace('/m', '')).toBe('')
    expect(returnToForWorkspace('', 'mobile')).toBe('')
    expect(sanitizeInternalAppPath('/it')).toBe('')
    expect(returnToForWorkspace('/it', 'it')).toBe('')
  })
})
