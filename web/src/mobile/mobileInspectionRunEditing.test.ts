import { describe, expect, it } from 'vitest'

import type { InspectionRunItem } from '../lib/api'
import { MemoryDriver } from './offline/driver'
import { OfflineStore } from './offline/store'
import {
  CHECKPOINT_STATE_LABELS,
  EDITABLE_CHECKPOINT_STATUSES,
  buildCompleteCheckpointPayload,
  canEditCheckpoint,
  checkpointDraftFromItem,
  checkpointPayloadForOfflineQueue,
  checkpointStatusOptions,
} from './mobileInspectionRunEditing'

function item(overrides: Partial<InspectionRunItem> = {}): InspectionRunItem {
  return {
    id: 'item-1',
    runId: 'run-1',
    title: 'Проверить оборудование',
    sortOrder: 0,
    zoneSortOrder: 0,
    checkpointSortOrder: 0,
    responseType: 'NORMAL_PROBLEM',
    isRequired: true,
    status: 'PENDING',
    requiresRepair: false,
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    attachments: [],
    ...overrides,
  }
}

describe('120N состояние чек-поинта', () => {
  it('отображает только четыре понятных состояния', () => {
    expect(CHECKPOINT_STATE_LABELS).toEqual({
      PENDING: 'Не заполнено',
      OK: 'Норма',
      ISSUE: 'Проблема',
      CRITICAL: 'Критично',
      SKIPPED: 'Не заполнено',
    })
  })

  it('в редакторе всегда доступны Норма, Проблема и Критично', () => {
    expect(EDITABLE_CHECKPOINT_STATUSES).toEqual([
      { value: 'OK', label: 'Норма' },
      { value: 'ISSUE', label: 'Проблема' },
      { value: 'CRITICAL', label: 'Критично' },
    ])
    expect(checkpointStatusOptions('ISSUE').map((option) => option.value)).toEqual([
      'OK',
      'ISSUE',
      'CRITICAL',
    ])
  })
})

describe('120N восстановление и изменение ответа', () => {
  it('переносит полный серверный ответ в draft', () => {
    expect(checkpointDraftFromItem(item({
      status: 'ISSUE',
      comment: 'Подтекает',
      booleanValue: false,
      numberValue: 12.5,
      textValue: 'Старое значение',
    }))).toEqual({
      status: 'ISSUE',
      comment: 'Подтекает',
      booleanValue: 'false',
      numberValue: '12.5',
      textValue: 'Старое значение',
    })
  })

  it('редактирует ISSUE напрямую, не сбрасывая статус', () => {
    const current = item({ status: 'ISSUE', requiresRepair: true, comment: 'Было' })
    const draft = { ...checkpointDraftFromItem(current), comment: 'Стало' }
    expect(buildCompleteCheckpointPayload(current, draft)).toEqual({
      ok: true,
      payload: { status: 'ISSUE', requiresRepair: true, comment: 'Стало' },
    })
  })

  it('переводит ISSUE в CRITICAL полным payload', () => {
    const current = item({ status: 'ISSUE', requiresRepair: true, comment: 'Течь' })
    const draft = { ...checkpointDraftFromItem(current), status: 'CRITICAL' as const }
    expect(buildCompleteCheckpointPayload(current, draft)).toEqual({
      ok: true,
      payload: { status: 'CRITICAL', requiresRepair: true, comment: 'Течь' },
    })
  })

  it('переводит CRITICAL в OK и снимает requiresRepair', () => {
    const current = item({ status: 'CRITICAL', requiresRepair: true, comment: 'Исправлено' })
    const draft = { ...checkpointDraftFromItem(current), status: 'OK' as const }
    expect(buildCompleteCheckpointPayload(current, draft)).toEqual({
      ok: true,
      payload: { status: 'OK', requiresRepair: false, comment: 'Исправлено' },
    })
  })

  it('сохраняет и редактирует YES_NO, включая false', () => {
    const current = item({ responseType: 'YES_NO', status: 'OK', booleanValue: false })
    const first = checkpointDraftFromItem(current)
    expect(first.booleanValue).toBe('false')
    expect(buildCompleteCheckpointPayload(current, { ...first, booleanValue: 'true' })).toEqual({
      ok: true,
      payload: { status: 'OK', requiresRepair: false, comment: '', booleanValue: true },
    })
  })

  it('сохраняет и редактирует NUMBER', () => {
    const current = item({ responseType: 'NUMBER', status: 'OK', numberValue: 12.5 })
    expect(buildCompleteCheckpointPayload(current, {
      ...checkpointDraftFromItem(current),
      numberValue: '14.25',
    })).toEqual({
      ok: true,
      payload: { status: 'OK', requiresRepair: false, comment: '', numberValue: 14.25 },
    })
  })

  it('передаёт ограничения NUMBER в пользовательскую ошибку', () => {
    const current = item({ responseType: 'NUMBER', numericMin: 10, numericMax: 20 })
    const draft = { ...checkpointDraftFromItem(current), status: 'OK' as const }
    expect(buildCompleteCheckpointPayload(current, { ...draft, numberValue: '9' })).toEqual({
      ok: false,
      message: 'Значение не может быть меньше 10',
    })
    expect(buildCompleteCheckpointPayload(current, { ...draft, numberValue: '21' })).toEqual({
      ok: false,
      message: 'Значение не может быть больше 20',
    })
  })

  it('сохраняет и редактирует TEXT', () => {
    const current = item({ responseType: 'TEXT', status: 'OK', textValue: 'Первый ответ' })
    expect(buildCompleteCheckpointPayload(current, {
      ...checkpointDraftFromItem(current),
      textValue: '  Новый ответ  ',
    })).toEqual({
      ok: true,
      payload: { status: 'OK', requiresRepair: false, comment: '', textValue: 'Новый ответ' },
    })
  })

  it('не разрешает редактировать завершённый обход', () => {
    expect(canEditCheckpoint('IN_PROGRESS')).toBe(true)
    expect(canEditCheckpoint('COMPLETED')).toBe(false)
  })
})

describe('120N полный offline payload', () => {
  it('две правки схлопываются в один окончательный полный ответ', async () => {
    const store = new OfflineStore(new MemoryDriver(), 'company:user')
    const current = item({ responseType: 'TEXT', status: 'ISSUE', comment: 'Первая', textValue: 'A' })
    const target = { roundId: 'run-1', checkpointId: current.id }
    const first = buildCompleteCheckpointPayload(current, checkpointDraftFromItem(current))
    const second = buildCompleteCheckpointPayload(current, {
      ...checkpointDraftFromItem(current),
      status: 'CRITICAL',
      comment: 'Итоговый комментарий',
      textValue: 'Итоговый ответ',
    })
    if (!first.ok || !second.ok) throw new Error('fixture must be valid')

    await store.enqueue({
      kind: 'checkpoint.update',
      target,
      payload: checkpointPayloadForOfflineQueue(first.payload),
    })
    await store.enqueue({
      kind: 'checkpoint.update',
      target,
      payload: checkpointPayloadForOfflineQueue(second.payload),
    })

    const queued = await store.listQueue()
    expect(queued).toHaveLength(1)
    expect(queued[0].payload).toEqual({
      status: 'CRITICAL',
      requiresRepair: true,
      comment: 'Итоговый комментарий',
      textValue: 'Итоговый ответ',
    })
  })
})
