import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Role, TicketCard } from '../lib/api'
import { notificationSectionToDetailTab } from './mobileTicketDetailTab'
import { inspectionNavSuffix } from './mobileRoute'
import { formatShiftDuration, homeShiftView, shouldShowHomeShiftStatus } from './home/shiftStatusView'
import { selectHomeUrgentTickets } from './home/homeUrgent'

/**
 * SMA-MOBILE-SERVICE-OS Phase 0+1. Чистая логика + source-contract (окружение node).
 */

describe('Ticket default landing (section → вкладка)', () => {
  it('обычное открытие (без section) → Инфо, а не Чат', () => {
    expect(notificationSectionToDetailTab(undefined)).toBe('info')
    expect(notificationSectionToDetailTab(null)).toBe('info')
    expect(notificationSectionToDetailTab('')).toBe('info')
  })
  it('deep-link в чат сохраняется: comments → chat', () => {
    expect(notificationSectionToDetailTab('comments')).toBe('chat')
  })
  it('прочие секции уведомлений не сломаны', () => {
    expect(notificationSectionToDetailTab('attachments')).toBe('photos')
    expect(notificationSectionToDetailTab('actions')).toBe('actions')
    expect(notificationSectionToDetailTab('acceptance')).toBe('actions')
    expect(notificationSectionToDetailTab('overview')).toBe('info')
    expect(notificationSectionToDetailTab('history')).toBe('info')
    expect(notificationSectionToDetailTab('unknown')).toBe('info')
  })
})

describe('Обходы: посадка нижнего пункта по роли', () => {
  it('техник → сегодняшние визиты', () => {
    expect(inspectionNavSuffix('TECHNICIAN')).toBe('/inspection/today')
  })
  it('остальные роли → общий список (без изменений)', () => {
    for (const role of ['MASTER', 'DISPATCHER', 'ADMIN', 'NETWORK_DIRECTOR'] as Role[]) {
      expect(inspectionNavSuffix(role)).toBe('/inspection')
    }
    expect(inspectionNavSuffix(undefined)).toBe('/inspection')
    expect(inspectionNavSuffix(null)).toBe('/inspection')
  })
})

describe('Статус смены на Главной', () => {
  it('показываем субъектам смены (техник/мастер), не остальным', () => {
    expect(shouldShowHomeShiftStatus('TECHNICIAN')).toBe(true)
    expect(shouldShowHomeShiftStatus('MASTER')).toBe(true)
    for (const role of ['DISPATCHER', 'ADMIN', 'NETWORK_DIRECTOR', 'CLIENT', 'CLIENT_ADMIN', 'PLATFORM_ADMIN'] as Role[]) {
      expect(shouldShowHomeShiftStatus(role)).toBe(false)
    }
    expect(shouldShowHomeShiftStatus(null)).toBe(false)
  })

  it('формат длительности HH:MM, битое/пустое → 00:00', () => {
    const base = Date.parse('2026-10-05T08:00:00.000Z')
    expect(formatShiftDuration('2026-10-05T08:00:00.000Z', base)).toBe('00:00')
    expect(formatShiftDuration('2026-10-05T08:00:00.000Z', base + 65 * 60_000)).toBe('01:05')
    expect(formatShiftDuration('2026-10-05T08:00:00.000Z', base + 5 * 60_000)).toBe('00:05')
    expect(formatShiftDuration(null, base)).toBe('00:00')
    expect(formatShiftDuration('не-дата', base)).toBe('00:00')
  })

  it('view: active при OPEN, иначе inactive; без данных — unknown', () => {
    const now = Date.parse('2026-10-05T10:30:00.000Z')
    expect(homeShiftView({ shift: { status: 'OPEN', openedAt: '2026-10-05T08:00:00.000Z' } }, now)).toEqual({
      state: 'active',
      durationLabel: '02:30',
    })
    expect(homeShiftView({ shift: { status: 'CLOSED', openedAt: '2026-10-05T08:00:00.000Z' } }, now)).toEqual({ state: 'inactive' })
    expect(homeShiftView({ shift: null }, now)).toEqual({ state: 'inactive' })
    expect(homeShiftView(undefined, now)).toEqual({ state: 'unknown' })
  })
})

describe('Приоритетный блок срочных', () => {
  const card = (id: string, priority: string, status: string): TicketCard =>
    ({ id, priority, status } as unknown as TicketCard)

  it('берёт только срочные и ещё активные', () => {
    const cards = [
      card('a', 'URGENT', 'NEW'),
      card('b', 'URGENT', 'IN_PROGRESS'),
      card('c', 'URGENT', 'ASSIGNED'),
      card('d', 'URGENT', 'DONE'),
      card('e', 'URGENT', 'AWAITING_ACCEPTANCE'),
      card('f', 'URGENT', 'CANCELED'),
      card('g', 'NOT_URGENT', 'NEW'),
    ]
    expect(selectHomeUrgentTickets(cards).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('дедуплицирует по id', () => {
    expect(selectHomeUrgentTickets([card('a', 'URGENT', 'NEW'), card('a', 'URGENT', 'NEW')]).map((t) => t.id)).toEqual(['a'])
  })

  it('пустой/нулевой вход → []', () => {
    expect(selectHomeUrgentTickets([])).toEqual([])
    expect(selectHomeUrgentTickets(null)).toEqual([])
    expect(selectHomeUrgentTickets(undefined)).toEqual([])
  })
})

describe('Source-contract: убран шум, добавлены блоки', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8')

  it('HomeQuickCards: карта-заглушка «Планирование» удалена', () => {
    const s = read('home/HomeQuickCards.tsx')
    expect(s).not.toContain('Планирование')
    expect(s).not.toContain('onPlanning')
    expect(s).not.toContain('--stub')
  })

  it('MobileHome: нет дубль-FAB, есть статус смены и блок срочных', () => {
    const s = read('home/MobileHome.tsx')
    expect(s).not.toContain('HomeFAB')
    expect(s).toContain('<HomeShiftStatus')
    expect(s).toContain('<HomeUrgentBlock')
  })

  it('MobileChatsPage: убраны неработающие кнопки композера', () => {
    const s = read('MobileChatsPage.tsx')
    expect(s).not.toContain('aria-label="Вложение"')
    expect(s).not.toContain('aria-label="Фото"')
  })

  it('MobileTicketPage: технический UUID убран из карточки', () => {
    const s = read('MobileTicketPage.tsx')
    expect(s).not.toContain("<RowIcon name=\"hash\" />ID")
  })

  it('MobileShell: «Обходы» использует ролевую посадку', () => {
    const s = read('MobileShell.tsx')
    expect(s).toContain('inspectionNavSuffix(meQ.data?.role)')
  })
})
