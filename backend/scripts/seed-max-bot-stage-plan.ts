import { TicketStatus, UserRole } from '@prisma/client'

import { zonedDayRange } from '../src/max-bot/max-master-time'

export const MAX_BOT_STAGE_PASSWORD_ENV = 'STAGE_TEST_MAX_PASSWORD'
export const MAX_BOT_STAGE_TIMEZONE = 'Asia/Novosibirsk'
export const MAX_BOT_STAGE_TEMPLATE_ITEM_COUNT = 5

export const MAX_BOT_STAGE_IDS = {
  clientCompany: '81000000-0000-4000-8000-000000000001',
  providerCompany: '81000000-0000-4000-8000-000000000002',
  location: '81000000-0000-4000-8000-000000000011',
  category: '81000000-0000-4000-8000-000000000021',
  specialization: '81000000-0000-4000-8000-000000000031',
  contract: '81000000-0000-4000-8000-000000000041',
  template: '81000000-0000-4000-8000-000000000201',
} as const

export type MaxBotStageUserKey =
  | 'tech1'
  | 'tech2'
  | 'tech3'
  | 'tech4'
  | 'tech5'
  | 'tech6'
  | 'master'
  | 'admin'
  | 'dispatcher'

export type MaxBotStageUser = {
  key: MaxBotStageUserKey
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  isExecutor: boolean
}

export const MAX_BOT_STAGE_USERS: MaxBotStageUser[] = [
  user('tech1', '81000000-0000-4000-8000-000000000101', 'max.bot.tech1@stage.local', 'Иван', 'Соколов', UserRole.TECHNICIAN, true),
  user('tech2', '81000000-0000-4000-8000-000000000102', 'max.bot.tech2@stage.local', 'Пётр', 'Орлов', UserRole.TECHNICIAN, true),
  user('tech3', '81000000-0000-4000-8000-000000000103', 'max.bot.tech3@stage.local', 'Сергей', 'Волков', UserRole.TECHNICIAN, true),
  user('tech4', '81000000-0000-4000-8000-000000000104', 'max.bot.tech4@stage.local', 'Андрей', 'Морозов', UserRole.TECHNICIAN, true),
  user('tech5', '81000000-0000-4000-8000-000000000105', 'max.bot.tech5@stage.local', 'Николай', 'Белов', UserRole.TECHNICIAN, true),
  user('tech6', '81000000-0000-4000-8000-000000000106', 'max.bot.tech6@stage.local', 'Дмитрий', 'Крылов', UserRole.TECHNICIAN, true),
  user('master', '81000000-0000-4000-8000-000000000107', 'max.bot.master@stage.local', 'Алексей', 'Смирнов', UserRole.MASTER, false),
  user('admin', '81000000-0000-4000-8000-000000000108', 'max.bot.admin@stage.local', 'Марина', 'Кузнецова', UserRole.ADMIN, false),
  user('dispatcher', '81000000-0000-4000-8000-000000000109', 'max.bot.dispatcher@stage.local', 'Елена', 'Новикова', UserRole.DISPATCHER, false),
]

export const MAX_BOT_STAGE_TECH_KEYS: MaxBotStageUserKey[] = [
  'tech1',
  'tech2',
  'tech3',
  'tech4',
  'tech5',
  'tech6',
]

export const MAX_BOT_STAGE_MASTER_MENU_KEYS: MaxBotStageUserKey[] = ['master', 'admin', 'dispatcher']

export const MAX_BOT_STAGE_OPEN_SHIFT_KEYS: MaxBotStageUserKey[] = ['tech2', 'tech3']

const OVERDUE_BY_TECH = [2, 2, 1, 1, 1, 1]

export type MaxBotStageTicketPlan = {
  id: string
  ticketNumber: number
  status: TicketStatus
  assigneeKey: MaxBotStageUserKey | null
  problemText: string
  sla: 'future' | 'past'
}

export type MaxBotStageSchedulePlan = {
  id: string
  name: string
  assigneeKey: MaxBotStageUserKey | null
}

export type MaxBotStageInstants = {
  slaFuture: Date
  slaPast: Date
  nextDueAt: Date
  dayStart: Date
  dayEnd: Date
  openedAt: Date
}

export function maxBotStageInstants(now: Date, timezone = MAX_BOT_STAGE_TIMEZONE): MaxBotStageInstants {
  const { from, to } = zonedDayRange(now, timezone)
  return {
    slaFuture: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    slaPast: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    nextDueAt: new Date(from.getTime() + 10 * 60 * 60 * 1000),
    dayStart: from,
    dayEnd: to,
    openedAt: now,
  }
}

export function buildMaxBotStageTickets(): MaxBotStageTicketPlan[] {
  const rows: MaxBotStageTicketPlan[] = []
  let number = 9201
  let sequence = 1

  for (let index = 1; index <= 12; index += 1) {
    rows.push({
      id: ticketId(sequence),
      ticketNumber: number,
      status: TicketStatus.NEW,
      assigneeKey: null,
      problemText: `Новая заявка без исполнителя ${index}`,
      sla: 'future',
    })
    number += 1
    sequence += 1
  }

  for (const key of MAX_BOT_STAGE_TECH_KEYS) {
    for (let index = 1; index <= 2; index += 1) {
      rows.push({
        id: ticketId(sequence),
        ticketNumber: number,
        status: TicketStatus.IN_PROGRESS,
        assigneeKey: key,
        problemText: `Заявка в работе ${key} ${index}`,
        sla: 'future',
      })
      number += 1
      sequence += 1
    }
  }

  MAX_BOT_STAGE_TECH_KEYS.forEach((key, techIndex) => {
    const count = OVERDUE_BY_TECH[techIndex]
    for (let index = 1; index <= count; index += 1) {
      rows.push({
        id: ticketId(sequence),
        ticketNumber: number,
        status: TicketStatus.ASSIGNED,
        assigneeKey: key,
        problemText: `Просроченная заявка ${key} ${index}`,
        sla: 'past',
      })
      number += 1
      sequence += 1
    }
  })

  return rows
}

export function buildMaxBotStageSchedules(): MaxBotStageSchedulePlan[] {
  const rows: MaxBotStageSchedulePlan[] = []
  let sequence = 1
  for (const key of MAX_BOT_STAGE_TECH_KEYS) {
    for (let index = 1; index <= 2; index += 1) {
      rows.push({
        id: scheduleId(sequence),
        name: `Обход ${key} ${index}`,
        assigneeKey: key,
      })
      sequence += 1
    }
  }
  for (let index = 1; index <= 6; index += 1) {
    rows.push({
      id: scheduleId(sequence),
      name: `Обход без исполнителя ${index}`,
      assigneeKey: null,
    })
    sequence += 1
  }
  return rows
}

export function maxBotStageTemplateItemTitles() {
  return Array.from({ length: MAX_BOT_STAGE_TEMPLATE_ITEM_COUNT }, (_, index) => `Пункт обхода ${index + 1}`)
}

function user(
  key: MaxBotStageUserKey,
  id: string,
  email: string,
  firstName: string,
  lastName: string,
  role: UserRole,
  isExecutor: boolean,
): MaxBotStageUser {
  return { key, id, email, firstName, lastName, role, isExecutor }
}

function ticketId(sequence: number) {
  return `81000000-0000-4000-8000-000000001${String(sequence).padStart(3, '0')}`
}

function scheduleId(sequence: number) {
  return `81000000-0000-4000-8000-000000002${String(sequence).padStart(3, '0')}`
}
