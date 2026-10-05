import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
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
  checkpointLinkedTicketLabel,
  checkpointLinkedTicketNotice,
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

// ── 120W: связанная заявка живёт отдельно от отметки ────────────────────────

const UUID = '3f2b9a1c-5d4e-4a7b-9c8d-1e2f3a4b5c6d'
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i

function exportedTicketMutationNames(apiSource: string): string[] {
  const sourceFile = ts.createSourceFile(
    'api.ts',
    apiSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  return sourceFile.statements
    .filter((node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) &&
      !!node.name &&
      !!node.body &&
      !!node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    )
    .filter((node) => {
      const body = node.body!.getText(sourceFile)
      return body.includes('/tickets') && /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/.test(body)
    })
    .map((node) => node.name!.text)
    .sort()
}

describe('120W связанная заявка при правке чек-поинта', () => {
  it('1. без связанной заявки экран молчит', () => {
    expect(checkpointLinkedTicketNotice({ hasLinkedTicket: false, draftStatus: 'OK' })).toEqual({ kind: 'none' })
    expect(
      checkpointLinkedTicketNotice({ hasLinkedTicket: false, ticketNumber: 128, draftStatus: 'ISSUE' }),
    ).toEqual({ kind: 'none' })
  })

  it('2. заявка и ISSUE: напоминание о независимости без обещания отмены', () => {
    const notice = checkpointLinkedTicketNotice({
      hasLinkedTicket: true,
      ticketNumber: 128,
      draftStatus: 'ISSUE',
    })

    expect(notice.kind).toBe('info')
    // Ни закрытия, ни отмены здесь не происходит и обещать их нельзя.
    expect(notice.kind === 'info' ? notice.text : '').not.toMatch(
      /будет отмен|будет закр|отменится|закроется|автоматически/i,
    )
    expect(notice.kind === 'info' ? notice.text : '').toContain('Заявка #128')
  })

  it('2. то же для CRITICAL и для пустого черновика', () => {
    for (const draftStatus of ['CRITICAL', null] as const) {
      const notice = checkpointLinkedTicketNotice({ hasLinkedTicket: true, ticketNumber: 128, draftStatus })
      expect(notice.kind).toBe('info')
    }
  })

  it('3, 4. заявка и «Норма»: предупреждение с человекочитаемым номером', () => {
    const notice = checkpointLinkedTicketNotice({
      hasLinkedTicket: true,
      ticketNumber: 128,
      draftStatus: 'OK',
    })

    expect(notice.kind).toBe('warning')
    expect(notice.kind === 'warning' ? notice.label : '').toBe('Заявка #128')
    expect(notice.kind === 'warning' ? notice.text : '').toBe(
      'По этому пункту уже создана заявка #128. Изменение результата обхода не изменит и не отменит заявку.',
    )
  })

  it('5. идентификатор заявки наружу не попадает ни при каком номере', () => {
    // Канонический источник имени принимает только номер: идентификатору
    // взяться неоткуда даже в секунды между созданием и обновлением обхода.
    expect(checkpointLinkedTicketLabel(128)).toBe('Заявка #128')
    expect(checkpointLinkedTicketLabel(null)).toBe('Заявка')
    expect(checkpointLinkedTicketLabel(undefined)).toBe('Заявка')
    expect(checkpointLinkedTicketLabel(UUID as never)).toBe('Заявка')

    for (const draftStatus of ['OK', 'ISSUE'] as const) {
      for (const ticketNumber of [null, undefined, UUID as never]) {
        const notice = checkpointLinkedTicketNotice({ hasLinkedTicket: true, ticketNumber, draftStatus })
        const text = notice.kind === 'none' ? '' : notice.text
        expect(text).not.toMatch(UUID_RE)
        expect(text).not.toContain(UUID)
        expect(text).toContain('аявка')
      }
    }
  })

  it('6, 7. сохранение остаётся доступным и payload остаётся полным', () => {
    // Предупреждение ничего не блокирует: сборка payload о заявке не знает.
    const current = item({ status: 'CRITICAL', requiresRepair: true, comment: 'Течь', ticketId: UUID })
    const result = buildCompleteCheckpointPayload(current, {
      ...checkpointDraftFromItem(current),
      status: 'OK',
    })

    expect(result).toEqual({
      ok: true,
      payload: { status: 'OK', requiresRepair: false, comment: 'Течь' },
    })
  })
})

describe('120W source contract', () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
  const page = () => read('src/mobile/MobileInspectionRunPage.tsx')
  const logic = () => read('src/mobile/mobileInspectionRunEditing.ts')

  it('8. путь сохранения не вызывает ни одной операции над заявкой', () => {
    const source = page()
    const api = read('src/lib/api.ts')
    const ticketMutations = exportedTicketMutationNames(api)

    // Пинуем фактическую поверхность api.ts: новый Ticket-mutator не должен
    // появиться незаметно и остаться вне запрета для редактора обхода.
    expect(ticketMutations).toEqual([
      'addTicketComment',
      'assignTicket',
      'changeTicketCategory',
      'claimTicket',
      'createChildTicket',
      'createTicket',
      'decideTicketAcceptance',
      'deleteDraftTicketAttachment',
      'deleteTicketAttachment',
      'requestTicketAssignment',
      'smartAssignTicket',
      'startTicketWorkLog',
      'stopTicketWorkLog',
      'updateTicket',
      'updateTicketStatus',
      'uploadDraftTicketAttachment',
      'uploadTicketAttachment',
    ])

    for (const name of ticketMutations) {
      expect(api).toMatch(new RegExp(`export async function ${name}\\(`))
      expect(source).not.toContain(`api.${name}(`)
    }
    // Единственная операция над заявкой на этом экране — её создание (120N).
    expect((source.match(/api\.createTicketFromInspectionItem/g) || []).length).toBe(1)
    // Отметка обновляется только обновлением чек-поинта, и ticketId в payload не уходит.
    expect(source).toMatch(/api\.updateInspectionRunItem\(runId, input\.itemId, input\.payload\)/)
    expect(logic()).not.toMatch(/payload\.ticketId|ticketId:/)
  })

  it('сообщение стоит рядом с «Сохранить» и не является модальным окном', () => {
    const source = page()
    const notice = source.indexOf('mobilePatrolLinkedTicketNotice')
    const save = source.indexOf('mobilePatrolItemEditorActions')
    expect(notice).toBeGreaterThan(-1)
    expect(save).toBeGreaterThan(notice)
    // В V1 подтверждения нет: сохранить «Норму» можно, прочитав предупреждение.
    expect(source).not.toMatch(/confirmLinkedTicket|window\.confirm/)
    expect(source).toMatch(/disabled=\{busy\}\s*\n\s*onClick=\{\(\) => saveItem\(item\)\}/)
  })

  it('без заявки сообщение не рендерится', () => {
    expect(page()).toMatch(/linkedTicketNotice\.kind !== 'none' \? \(/)
    expect(page()).toMatch(/hasLinkedTicket: !!createdTicketId/)
  })
})
