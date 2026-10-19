import { describe, expect, it } from 'vitest'

import { isProtectedUploadUrl } from './api'

/**
 * P2 — EQUIPMENT PREVIEW COMPATIBILITY.
 *
 * Бэкенд раздаёт снимки оборудования под защищённым маршрутом
 * /uploads/equipment/ (uploads.controller ALLOWED_FOLDERS), требующим
 * Authorization. Предикат isProtectedUploadUrl раньше знал только
 * ticket-attachments и inspection-run-items, поэтому equipment-URL уходил в
 * passthrough (<img src>) без заголовка → 401 и пустое превью.
 *
 * Здесь закреплено, что все три защищённые папки распознаются как защищённые,
 * а посторонние URL остаются passthrough.
 */
describe('isProtectedUploadUrl — защищённые папки совпадают с backend', () => {
  it('equipment распознаётся как защищённый (регрессия P2)', () => {
    expect(isProtectedUploadUrl('/uploads/equipment/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg')).toBe(true)
    expect(isProtectedUploadUrl('https://api.example.com/uploads/equipment/x.png')).toBe(true)
  })

  it('ticket-attachments и inspection-run-items остаются защищёнными', () => {
    expect(isProtectedUploadUrl('/uploads/ticket-attachments/x.png')).toBe(true)
    expect(isProtectedUploadUrl('/uploads/inspection-run-items/x.png')).toBe(true)
  })

  it('посторонние и публичные URL — passthrough', () => {
    expect(isProtectedUploadUrl('/uploads/avatars/x.png')).toBe(false)
    expect(isProtectedUploadUrl('https://cdn.example.com/logo.svg')).toBe(false)
    expect(isProtectedUploadUrl('')).toBe(false)
  })
})
