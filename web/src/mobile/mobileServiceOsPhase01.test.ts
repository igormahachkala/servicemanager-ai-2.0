import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Role, TicketCard } from '../lib/api'
import { notificationSectionToDetailTab } from './mobileTicketDetailTab'
import { inspectionNavSuffix } from './mobileRoute'
import { formatShiftDuration, homeShiftView, shouldShowHomeShiftStatus } from './home/shiftStatusView'
import { isHomeUrgentTicket, selectHomeUrgentTickets } from './home/homeUrgent'

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

  it('isHomeUrgentTicket — единый предикат (priority ИЛИ urgency URGENT + активный статус)', () => {
    expect(isHomeUrgentTicket(card('a', 'URGENT', 'NEW'))).toBe(true)
    expect(isHomeUrgentTicket(card('a', 'URGENT', 'IN_PROGRESS'))).toBe(true)
    expect(isHomeUrgentTicket(card('a', 'URGENT', 'DONE'))).toBe(false)
    expect(isHomeUrgentTicket(card('a', 'URGENT', 'AWAITING_ACCEPTANCE'))).toBe(false)
    expect(isHomeUrgentTicket(card('a', 'NOT_URGENT', 'NEW'))).toBe(false)
    // urgency === URGENT тоже срочная (даже если priority не URGENT)
    expect(isHomeUrgentTicket({ id: 'u', priority: 'NORMAL', urgency: 'URGENT', status: 'NEW' } as unknown as TicketCard)).toBe(true)
  })
})

describe('Source-contract: убран шум, добавлены блоки', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8')

  it('HomeQuickCards: заглушка удалена; «Срочные» вынесены из quick-cards (один urgent surface)', () => {
    const s = read('home/HomeQuickCards.tsx')
    expect(s).not.toContain('Планирование')
    expect(s).not.toContain('onPlanning')
    expect(s).not.toContain('--stub')
    // compact urgent quick-card убрана — срочные теперь в HomeUrgentCard
    expect(s).not.toContain('mobileHomeQuickCard--urgent')
    expect(s).not.toContain('urgentCount')
    expect(s).not.toContain('onToggleUrgent')
  })

  it('MobileHome: статус смены + полноценная операционная карточка срочных (не compact)', () => {
    const s = read('home/MobileHome.tsx')
    expect(s).not.toContain('HomeFAB')
    expect(s).not.toContain('HomeUrgentBlock')
    expect(s).toContain('<HomeShiftStatus')
    expect(s).toContain('<HomeUrgentCard')
    // один urgent surface: в HomeQuickCards срочных нет
    expect(s).not.toContain('urgentCount={urgentTickets.length}')
    // «Все срочные» → canonical urgent quick-filter (тот же предикат, что у карточки)
    expect(s).toContain("onViewAll={() => activateQuickFilter('urgent')}")
    // Materials — новый светло-синий visual state
    expect(s).toContain('mobileHomeQuickCard--blue')
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

describe('Mobile Settings: сворачиваемые группы', () => {
  const s = readFileSync(join(__dirname, 'MobileSettingsPage.tsx'), 'utf8')

  it('заголовки групп — доступные кнопки с aria-expanded + chevron', () => {
    expect(s).toContain('mobileSettingsGroupHeader')
    expect(s).toContain('aria-expanded={open}')
    expect(s).toContain('aria-controls={regionId}')
    expect(s).toContain('GroupChevron')
  })

  it('группы — реальные смысловые разделы, без длинного плоского списка', () => {
    expect(s).toContain("manage: 'Управление'")
    expect(s).toContain("work: 'Работа и обходы'")
    expect(s).toContain("notifications: 'Уведомления'")
    // активная группа раскрывается, состояние запоминается локально
    expect(s).toContain('activeGroupId')
    expect(s).toContain('SETTINGS_GROUPS_LS')
  })

  it('каждый пункт настроек отнесён к группе (нельзя «потерять» пункт)', () => {
    // Все id, которые страница может добавить в managementLinks, должны иметь группу в LINK_GROUP.
    const linkIds = Array.from(s.matchAll(/id:\s*'([a-zA-Z]+)'/g)).map((m) => m[1])
    const groupedIds = new Set(Array.from(s.matchAll(/^\s{2}([a-zA-Z]+):\s*'(?:manage|work)'/gm)).map((m) => m[1]))
    const pushed = linkIds.filter((id) => ['desktop', 'companies', 'permissions', 'company', 'employees', 'locations', 'access', 'workforce', 'materials', 'inspection', 'inspectionTemplates'].includes(id))
    for (const id of pushed) {
      expect(groupedIds.has(id)).toBe(true)
    }
    expect(pushed.length).toBe(11)
  })

  it('доступность пунктов не меняется (ролевая логика managementLinks сохранена)', () => {
    expect(s).toContain('canAccessManagementDesktop')
    expect(s).toContain('WORKFORCE_ROLES.has(role)')
    expect(s).toContain('INSPECTION_TEMPLATE_ROLES.has(role)')
    // notification panel и contour card не удалены
    expect(s).toContain('NotificationPreferencesPanel')
    expect(s).toContain('ClientContourCard')
  })
})

describe('P1-1: единый canonical urgent-предикат (карточка == quick-filter == chip)', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8')
  const card = (id: string, priority: string, status: string): TicketCard =>
    ({ id, priority, status } as unknown as TicketCard)

  it('URGENT активная заявка — в карточке (select) и в предикате списка', () => {
    const t = card('x', 'URGENT', 'NEW')
    expect(isHomeUrgentTicket(t)).toBe(true)
    expect(selectHomeUrgentTickets([t]).map((x) => x.id)).toEqual(['x'])
  })

  it('SLA-warning, но НЕ URGENT → не срочная (предикат не смотрит на SLA)', () => {
    const near = { id: 's', priority: 'NORMAL', urgency: 'NOT_URGENT', status: 'NEW', slaDueAt: new Date(Date.now() + 10 * 60000).toISOString() } as unknown as TicketCard
    expect(isHomeUrgentTicket(near)).toBe(false)
    expect(selectHomeUrgentTickets([near])).toEqual([])
  })

  it('chip «urgent» использует canonical isHomeUrgentTicket, а не SLA-warning', () => {
    const s = read('mobileHomeListUtils.ts')
    expect(s).toContain("import { isHomeUrgentTicket } from './home/homeUrgent'")
    expect(s).toContain("case 'urgent':")
    expect(s).toContain('return isHomeUrgentTicket(ticket)')
    expect(s).not.toContain("getSlaState(ticket, nowMs) === 'warning'")
    expect(s).not.toContain('function isUrgentTicket')
  })

  it('HomeUrgentCard: count/превью из canonical homeUrgent; max 3; пустой → null; строки → ticket flow', () => {
    const c = read('home/HomeUrgentCard.tsx')
    expect(c).toContain("from './homeUrgent'")
    expect(c).toContain('HOME_URGENT_PREVIEW_MAX')
    expect(c).toContain('tickets.slice(0, HOME_URGENT_PREVIEW_MAX)')
    expect(c).toContain('if (!tickets.length) return null')
    expect(c).toContain('to={ticketHref(ticket)}')
  })
})
