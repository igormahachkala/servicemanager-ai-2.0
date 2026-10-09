import { describe, expect, it } from 'vitest'

import { isChildTicket, roleCanCreateChildTicket, roleCanDetachChildTicket } from './ticketIsChild'

describe('isChildTicket', () => {
  it('true только при непустом parentId', () => {
    expect(isChildTicket({ parentId: 'parent-1' })).toBe(true)
    expect(isChildTicket({ parentId: '  parent-1  ' })).toBe(true)
  })

  it('false для родителя и пустого parentId', () => {
    expect(isChildTicket({})).toBe(false)
    expect(isChildTicket({ parentId: null })).toBe(false)
    expect(isChildTicket({ parentId: undefined })).toBe(false)
    expect(isChildTicket({ parentId: '' })).toBe(false)
    expect(isChildTicket({ parentId: '   ' })).toBe(false)
  })
})

describe('roleCanCreateChildTicket', () => {
  it('совпадает с ролями POST /tickets', () => {
    expect(roleCanCreateChildTicket('TECHNICIAN')).toBe(true)
    expect(roleCanCreateChildTicket('CLIENT')).toBe(true)
    expect(roleCanCreateChildTicket('STAFF')).toBe(false)
    expect(roleCanCreateChildTicket(null)).toBe(false)
  })
})

describe('roleCanDetachChildTicket', () => {
  it('true только для ADMIN', () => {
    expect(roleCanDetachChildTicket('ADMIN')).toBe(true)
    expect(roleCanDetachChildTicket('PLATFORM_ADMIN')).toBe(false)
    expect(roleCanDetachChildTicket('MASTER')).toBe(false)
    expect(roleCanDetachChildTicket('TECHNICIAN')).toBe(false)
    expect(roleCanDetachChildTicket('CLIENT')).toBe(false)
    expect(roleCanDetachChildTicket('STAFF')).toBe(false)
    expect(roleCanDetachChildTicket(null)).toBe(false)
    expect(roleCanDetachChildTicket(undefined)).toBe(false)
  })
})
