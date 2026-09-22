import { InspectionFrequency } from '@prisma/client'

import { endOfZonedDay, zonedParts } from '../common/zoned-time.utils'

/**
 * SMA-ROUND-SCHEDULE-ADVANCE-029.
 *
 * Поведение вокруг арифметики: завершение двигает план ровно один раз,
 * «сегодня» одинаково на /m и в MAX, перенос возможен после прошлых обходов,
 * чужое не видно.
 *
 * Проверяется то, что можно проверить без живой базы: транзакционные
 * инварианты закреплены по исходнику там, где их иначе не увидеть, —
 * и каждая такая проверка падает, если инвариант убрать (отрицательные
 * контроли прогнаны отдельно).
 */

const SERVICE = require('node:fs').readFileSync(
  require('node:path').resolve(__dirname, 'inspection.service.ts'),
  'utf8',
) as string

const SCHEDULE_SERVICE = require('node:fs').readFileSync(
  require('node:path').resolve(__dirname, 'inspection-schedule.service.ts'),
  'utf8',
) as string

function completeRunBlock(): string {
  const start = SERVICE.indexOf('async completeRun(')
  return SERVICE.slice(start, SERVICE.indexOf('private async advanceScheduleAfterCompletion'))
}

describe('029 завершение двигает план', () => {
  it('закрытие обхода и сдвиг плана идут одной транзакцией', () => {
    /*
     * Иначе возможен обход, закрытый без сдвига плана: визит сделан, а план
     * остался просроченным навсегда.
     */
    const block = completeRunBlock()
    const tx = block.indexOf('this.prisma.$transaction')
    const advance = block.indexOf('advanceScheduleAfterCompletion')
    expect(tx).toBeGreaterThan(-1)
    expect(advance).toBeGreaterThan(tx)
  })

  it('второго пути завершения не появилось', () => {
    // Единственное место, где обход переводится в COMPLETED.
    const transitions = SERVICE.split('InspectionRunStatus.COMPLETED,').length - 1
    expect(transitions).toBe(1)
  })

  it('сдвиг делает только победитель гонки', () => {
    /*
     * Признак «уже завершён» ставит сам переход статуса: updateMany с условием.
     * Проверка перед ним остаётся ради понятного сообщения, но полагаться
     * на неё нельзя — между чтением и записью помещается второе завершение.
     */
    const block = completeRunBlock()
    expect(block).toContain('updateMany')
    expect(block).toContain('status: { not: InspectionRunStatus.COMPLETED }')
    expect(block).toContain('claimed.count === 0')
    // Проигравший выходит до сдвига.
    const guard = block.indexOf('claimed.count === 0')
    const advance = block.indexOf('advanceScheduleAfterCompletion')
    expect(guard).toBeLessThan(advance)
  })

  it('обход без плана ничего не двигает', () => {
    const fn = SERVICE.slice(SERVICE.indexOf('private async advanceScheduleAfterCompletion'))
    expect(fn).toContain('if (!schedule || !schedule.isActive)')
  })

  it('одноразовый план после выполнения гаснет', () => {
    const fn = SERVICE.slice(SERVICE.indexOf('private async advanceScheduleAfterCompletion'))
    const noNext = fn.indexOf('if (!outcome.nextDueAt)')
    expect(noNext).toBeGreaterThan(-1)
    expect(fn.slice(noNext, noNext + 220)).toContain('isActive: false')
  })

  it('часовой пояс берётся у компании, а не у сервера', () => {
    const fn = SERVICE.slice(SERVICE.indexOf('private async advanceScheduleAfterCompletion'))
    expect(fn).toContain('company: { select: { timezone: true } }')
    expect(fn).toContain('timezone: schedule.company?.timezone')
  })
})

describe('029 «сегодня» одинаково на обеих поверхностях', () => {
  it('границу считает сервер по поясу компании', () => {
    expect(SCHEDULE_SERVICE).toContain('endOfCompanyDay')
    expect(SCHEDULE_SERVICE).toContain('endOfZonedDay(new Date(), company?.timezone)')
  })

  it('просроченные активные планы остаются видны: нижней границы нет', () => {
    const idx = SCHEDULE_SERVICE.indexOf("filters.dueToday === 'true'")
    expect(idx).toBeGreaterThan(-1)
    const branch = SCHEDULE_SERVICE.slice(idx, idx + 160)
    expect(branch).toContain('lte:')
    expect(branch).not.toContain('gte:')
  })

  it('MAX спрашивает тот же признак и своего окна не строит', () => {
    const max = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../max-bot/max-technician-rounds.service.ts'),
      'utf8',
    ) as string
    expect(max).toContain("dueToday: 'true'")
    expect(max).not.toContain('to: to.toISOString()')
  })

  it('/m спрашивает тот же признак и поясом устройства не пользуется', () => {
    const page = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../../../web/src/mobile/MobileInspectionTodayPage.tsx'),
      'utf8',
    ) as string
    expect(page).toContain('dueToday: true')
    expect(page).not.toContain('todayWindow(')
  })

  it('конец местных суток — действительно конец дня в поясе компании', () => {
    const end = endOfZonedDay(new Date('2026-03-10T06:00:00Z'), 'Europe/Moscow')
    const p = zonedParts(end, 'Europe/Moscow')
    expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 3, 10, 23, 59])
  })

  it('на границе суток пояс решает, какой это день', () => {
    // 21:30 UTC — в Москве уже следующие сутки.
    const instant = new Date('2026-03-10T21:30:00Z')
    expect(zonedParts(endOfZonedDay(instant, 'Europe/Moscow'), 'Europe/Moscow').day).toBe(11)
    expect(zonedParts(endOfZonedDay(instant, 'UTC'), 'UTC').day).toBe(10)
  })
})

describe('029 перенос, переназначение, отмена', () => {
  it('перенос ближайшего визита разрешён и после прошлых обходов', () => {
    const idx = SCHEDULE_SERVICE.indexOf('if (dto.startDate !== undefined) {')
    // Окно до конца метода: комментарий длинный, и короткий срез
    // проскакивал бы мимо самой строки присваивания.
    const block = SCHEDULE_SERVICE.slice(idx, SCHEDULE_SERVICE.indexOf('async remove('))
    expect(block).toContain('data.nextDueAt = startDate')
    // Прежней заморозки по lastGeneratedAt больше нет.
    expect(block).not.toContain('if (!current.lastGeneratedAt) data.nextDueAt')
  })

  it('прошлые обходы переносом не переписываются', () => {
    // Правка расписания не трогает таблицу обходов вовсе.
    const update = SCHEDULE_SERVICE.slice(
      SCHEDULE_SERVICE.indexOf('async update('),
      SCHEDULE_SERVICE.indexOf('async remove('),
    )
    expect(update).not.toContain('inspectionRun.update')
    expect(update).not.toContain('inspectionRun.updateMany')
  })

  it('переназначение не трогает идущий или прошлый обход', () => {
    const update = SCHEDULE_SERVICE.slice(
      SCHEDULE_SERVICE.indexOf('async update('),
      SCHEDULE_SERVICE.indexOf('async remove('),
    )
    expect(update).toContain('assignedToUserId')
    expect(update).not.toContain('inspectionRun')
  })

  it('отмена сохраняет прежнюю семантику: с историей — гасить, без — удалять', () => {
    const remove = SCHEDULE_SERVICE.slice(SCHEDULE_SERVICE.indexOf('async remove('))
    expect(remove).toContain('current._count.runs > 0 || current.lastGeneratedAt')
    expect(remove).toContain('isActive: false')
    expect(remove).toContain('inspectionSchedule.delete')
  })
})

describe('029 границы и изоляция', () => {
  it('план читается только внутри своей компании', () => {
    const fn = SCHEDULE_SERVICE.slice(SCHEDULE_SERVICE.indexOf('private async endOfCompanyDay'))
    expect(fn).toContain('where: { id: companyId }')
  })

  it('выдача сужена по компании актора', () => {
    const list = SCHEDULE_SERVICE.slice(SCHEDULE_SERVICE.indexOf('async list('), SCHEDULE_SERVICE.indexOf('async get('))
    expect(list).toMatch(/companyId/)
  })

  it('неактивные планы отсекаются фильтром, а не на клиенте', () => {
    const list = SCHEDULE_SERVICE.slice(SCHEDULE_SERVICE.indexOf('async list('), SCHEDULE_SERVICE.indexOf('async get('))
    expect(list).toContain("where.isActive = filters.active === 'true'")
  })

  it('прежняя защита от второго обхода по плану цела', () => {
    expect(SERVICE).toContain('INSPECTION_SCHEDULE_RUN_IN_PROGRESS')
    const guard = SERVICE.slice(SERVICE.indexOf('INSPECTION_SCHEDULE_RUN_IN_PROGRESS') - 900)
    expect(guard).toContain('status: InspectionRunStatus.IN_PROGRESS')
  })

  it('CUSTOM без интервала не сохраняется', () => {
    expect(SCHEDULE_SERVICE).toContain('intervalDays is required for CUSTOM frequency')
    expect(SCHEDULE_SERVICE).toContain('intervalDays is allowed only for CUSTOM frequency')
  })

  it('leadTimeDays и graceDays в этом срезе поведения не получили', () => {
    // Остаются хранимой настройкой: ни в арифметике, ни в фильтре «сегодня».
    const recurrence = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, 'inspection-recurrence.ts'),
      'utf8',
    ) as string
    expect(recurrence).not.toContain('leadTimeDays')
    expect(recurrence).not.toContain('graceDays')
    // Хранение и выдача их сохраняют — это верно. Проверяется, что они
    // не участвуют в решении «виден ли план сегодня».
    const dueBranch = SCHEDULE_SERVICE.slice(
      SCHEDULE_SERVICE.indexOf("filters.dueToday === 'true'"),
      SCHEDULE_SERVICE.indexOf('const schedules = await this.prisma.inspectionSchedule.findMany'),
    )
    expect(dueBranch).not.toContain('graceDays')
    expect(dueBranch).not.toContain('leadTimeDays')
  })

  it('фонового процесса в этом срезе не заведено', () => {
    const inspectionDir = require('node:fs')
      .readdirSync(__dirname)
      .filter((f: string) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    const withTimers = inspectionDir.filter((f: string) => {
      const src = require('node:fs').readFileSync(require('node:path').resolve(__dirname, f), 'utf8') as string
      return src.includes('setInterval') || src.includes('@Cron')
    })
    expect(withTimers).toEqual([])
  })
})
