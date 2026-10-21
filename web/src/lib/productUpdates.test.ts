/**
 * SMA-UPDATES-CENTER-V1 — правила отображения Центра обновлений.
 */
import { describe, expect, it } from 'vitest'

import type { ProductUpdate, Role } from './api'
import { isManagementNavItemVisible, railSectionIdForPath } from './navigation'
import { getMobileMoreEntries } from '../mobile/mobileMoreEntries'
import {
  EMPTY_FORM,
  audienceLabel,
  canManageProductUpdates,
  formErrors,
  formFromUpdate,
  formatUpdateDate,
  inputFromForm,
  missingForPublish,
  paragraphs,
  safeFeaturePath,
  safeMediaUrl,
  visibleMedia,
} from './productUpdates'

describe('canManageProductUpdates — зеркало бэкенда', () => {
  it('PLATFORM_ADMIN и ADMIN с доступом к управленческой части', () => {
    expect(canManageProductUpdates({ role: 'PLATFORM_ADMIN' })).toBe(true)
    expect(canManageProductUpdates({ role: 'ADMIN', canAccessManagementSurface: true })).toBe(true)
  })

  it('ADMIN без ManagementSurface и прочие роли — нет', () => {
    expect(canManageProductUpdates({ role: 'ADMIN', canAccessManagementSurface: false })).toBe(false)
    for (const role of ['CLIENT_ADMIN', 'DISPATCHER', 'MASTER', 'TECHNICIAN', 'CLIENT', 'NETWORK_DIRECTOR']) {
      expect(canManageProductUpdates({ role, canAccessManagementSurface: true })).toBe(false)
    }
    expect(canManageProductUpdates(null)).toBe(false)
  })
})

describe('ссылки перед выводом', () => {
  it('ссылка на функцию — только путь приложения', () => {
    expect(safeFeaturePath('/inspection/schedules')).toBe('/inspection/schedules')
    for (const bad of ['https://evil.example', '//evil.example', 'javascript:alert(1)', 'inspection', '/a b', null, undefined, '']) {
      expect(safeFeaturePath(bad)).toBeNull()
    }
  })

  it('изображение — https или путь приложения', () => {
    expect(safeMediaUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png')
    expect(safeMediaUrl('/uploads/a.png')).toBe('/uploads/a.png')
    for (const bad of ['http://cdn.example/a.png', 'data:image/png;base64,AA', 'javascript:alert(1)', '//evil/a.png', '']) {
      expect(safeMediaUrl(bad)).toBeNull()
    }
  })

  it('опасные изображения не выводятся, остальные сохраняют пояснение', () => {
    expect(visibleMedia([{ url: 'javascript:x', caption: 'a' }, { url: '/uploads/b.png', caption: ' Экран ' }])).toEqual([
      { url: '/uploads/b.png', caption: 'Экран' },
    ])
    expect(visibleMedia(undefined)).toEqual([])
  })
})

describe('отображение', () => {
  it('аудитория: пусто — «Для всех», иначе русские названия ролей', () => {
    expect(audienceLabel([])).toBe('Для всех')
    expect(audienceLabel(['TECHNICIAN', 'CLIENT'])).toBe('Техники, Клиенты')
  })

  it('дата: нет или битая — прочерк', () => {
    expect(formatUpdateDate(null)).toBe('—')
    expect(formatUpdateDate('not-a-date')).toBe('—')
    expect(formatUpdateDate('2026-10-21T10:00:00.000Z')).toMatch(/2026/)
  })

  it('абзацы: пустые строки отбрасываются', () => {
    expect(paragraphs('Первое\n\n  Второе  \n')).toEqual(['Первое', 'Второе'])
    expect(paragraphs(null)).toEqual([])
  })
})

describe('форма редактора', () => {
  it('ошибки ссылки и изображений видны до отправки', () => {
    expect(formErrors({ ...EMPTY_FORM, featurePath: 'https://evil.example', media: [{ url: '', caption: '' }, { url: 'http://x/a.png', caption: '' }] })).toEqual([
      'Ссылка на функцию — путь приложения, начинается с «/», например /inspection/schedules',
      'Изображение 1: укажите адрес',
      'Изображение 2: только https:// или путь /uploads/…',
    ])
    expect(formErrors(EMPTY_FORM)).toEqual([])
  })

  it('для публикации нужны все четыре раздела — как на бэкенде', () => {
    expect(missingForPublish(EMPTY_FORM)).toEqual(['Заголовок', 'Краткое описание', 'Что изменилось', 'Как пользоваться'])
    expect(missingForPublish({ title: 'T', summary: 'S', changes: 'C', howToUse: 'H' })).toEqual([])
  })

  it('форма ↔ карточка: пустая ссылка уходит как null, текст обрезается', () => {
    const update = {
      title: ' T ', summary: 'S', changes: 'C', howToUse: 'H', featurePath: null,
      media: [{ url: '/uploads/a.png', caption: 'c' }], audienceRoles: ['TECHNICIAN'],
    } as unknown as ProductUpdate
    const input = inputFromForm(formFromUpdate(update))
    expect(input).toEqual({
      title: 'T', summary: 'S', changes: 'C', howToUse: 'H', featurePath: null,
      media: [{ url: '/uploads/a.png', caption: 'c' }], audienceRoles: ['TECHNICIAN'],
    })
  })
})

describe('вход в раздел', () => {
  const roles: Role[] = ['PLATFORM_ADMIN', 'ADMIN', 'CLIENT_ADMIN', 'DISPATCHER', 'MASTER', 'TECHNICIAN', 'CLIENT', 'TERRITORIAL_MANAGER', 'NETWORK_DIRECTOR', 'STAFF']

  it('пункт «Что нового» виден любой роли управленческой части; без роли — нет', () => {
    for (const role of roles) expect(isManagementNavItemVisible('/updates', { role })).toBe(true)
    expect(isManagementNavItemVisible('/updates', { role: null })).toBe(false)
    expect(railSectionIdForPath('/updates')).toBe('more')
  })

  it('мобильное «Ещё» содержит «Что нового» у любой роли', () => {
    for (const role of roles) {
      const entry = getMobileMoreEntries({ role }, '/m').find((e) => e.id === 'updates')
      expect(entry?.to).toBe('/m/updates')
    }
    expect(getMobileMoreEntries({ role: 'TECHNICIAN' }, '/max').find((e) => e.id === 'updates')?.to).toBe('/max/updates')
  })
})
