import { ValidationPipe } from '@nestjs/common'

import { EditNotStartedScheduleDto } from './edit-not-started-schedule.dto'

const input: Record<string, unknown> = {
  templateId: '11111111-1111-4111-8111-111111111111',
  locationId: '22222222-2222-4222-8222-222222222222',
  name: 'Обход', frequency: 'ONCE', startDate: '2026-10-30T09:00:00.000Z',
  expectedUpdatedAt: '2026-10-29T09:00:00.000Z',
}
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
const validate = (value: unknown) => pipe.transform(value, { type: 'body', metatype: EditNotStartedScheduleDto })

describe('EditNotStartedScheduleDto', () => {
  it('accepts an unassigned location-wide plan and explicit nullable links', async () => {
    await expect(validate(input)).resolves.toBeInstanceOf(EditNotStartedScheduleDto)
    await expect(validate({ ...input, equipmentId: null, assignedToUserId: null, intervalDays: null }))
      .resolves.toBeInstanceOf(EditNotStartedScheduleDto)
  })
  it.each(['templateId', 'locationId', 'name', 'frequency', 'startDate', 'expectedUpdatedAt'])(
    'requires non-null %s', async (key) => {
      const missing = { ...input }
      delete missing[key]
      await expect(validate(missing)).rejects.toThrow()
      await expect(validate({ ...input, [key]: null })).rejects.toThrow()
    },
  )
  it.each([
    { equipmentId: 'not-a-uuid' }, { assignedToUserId: 'not-a-uuid' },
    { startDate: '2026-02-30T09:00:00.000Z' }, { expectedUpdatedAt: 'invalid' },
    { name: '' }, { name: 'a'.repeat(161) }, { frequency: 'OTHER' },
    { intervalDays: 0 }, { intervalDays: 3651 }, { intervalDays: 1.5 },
    { isActive: true }, { nextDueAt: '2026-10-30T09:00:00.000Z' },
    { leadTimeDays: 3 }, { graceDays: 3 }, { lastGeneratedAt: null },
  ])('rejects invalid or outside-scope fields %p', async (changes) => {
    await expect(validate({ ...input, ...changes })).rejects.toThrow()
  })
})
