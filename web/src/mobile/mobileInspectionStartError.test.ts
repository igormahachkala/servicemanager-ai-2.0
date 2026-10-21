import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ApiRequestError } from '../lib/api'
import { mobileInspectionStartErrorMessage } from './mobileInspectionStartError'
import { ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE } from './mobileShiftGate'

describe('mobile inspection start error resolution', () => {
  it('uses the canonical ShiftPolicy message for ACTIVE_SHIFT_REQUIRED', () => {
    const error = new ApiRequestError('ACTIVE_SHIFT_REQUIRED', 409, {
      code: 'ACTIVE_SHIFT_REQUIRED',
    })

    expect(mobileInspectionStartErrorMessage(error)).toBe(
      ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE,
    )
  })

  it('does not classify every 409 as ShiftPolicy', () => {
    const error = new ApiRequestError('INSPECTION_SCHEDULE_RUN_IN_PROGRESS', 409, {
      code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS',
    })

    expect(mobileInspectionStartErrorMessage(error)).toBe(
      'Не удалось начать обход. Проверьте соединение и повторите.',
    )
  })

  it('preserves access and not-found messages', () => {
    expect(mobileInspectionStartErrorMessage(new ApiRequestError('Forbidden', 403))).toBe(
      'Начать обход в выбранном контуре нельзя. Проверьте доступ к локации.',
    )
    expect(mobileInspectionStartErrorMessage(new ApiRequestError('Not found', 404))).toBe(
      'Шаблон или локация больше недоступны. Обновите выбор и повторите.',
    )
  })

  it('preserves the generic fallback for unknown and network errors', () => {
    const fallback = 'Не удалось начать обход. Проверьте соединение и повторите.'

    expect(mobileInspectionStartErrorMessage(new Error('Failed to fetch'))).toBe(fallback)
    expect(mobileInspectionStartErrorMessage(null)).toBe(fallback)
  })

  it('reuses the shared ShiftPolicy resolver without role inference', () => {
    const helper = readFileSync(
      resolve(process.cwd(), 'src/mobile/mobileInspectionStartError.ts'),
      'utf8',
    )
    const page = readFileSync(
      resolve(process.cwd(), 'src/mobile/MobileInspectionStartPage.tsx'),
      'utf8',
    )

    expect(helper).toMatch(/isActiveShiftRequiredError\(error\)/)
    expect(helper).toMatch(/ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE/)
    expect(helper).not.toMatch(/role\s*===/)
    expect(helper).not.toMatch(/['"](?:MASTER|TECHNICIAN)['"]/)
    expect(page).toMatch(/mobileInspectionStartErrorMessage\(cause\)/)
  })
})
