import { describe, expect, it } from 'vitest'

import { ApiRequestError } from './api'
import {
  PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS,
  applyConfirm,
  applyRejectFieldComplete,
  applyRowChoice,
  descendantCloseStatusLabel,
  emptyChildCloseDraft,
  isDraftComplete,
  parentCloseNeedsDialog,
  readParentCloseRefuse,
  rowNeedsFieldCompleteConfirm,
  toChildResolutionsPayload,
  unresolvedDescendantsForClose,
  type UnresolvedDescendant,
} from './ticketParentClose'

function item(overrides: Partial<UnresolvedDescendant> & Pick<UnresolvedDescendant, 'id' | 'status'>): UnresolvedDescendant {
  return {
    ticketNumber: 12,
    problemText: 'Не холодит',
    categoryName: 'Холодильник',
    ...overrides,
  }
}

describe('unresolvedDescendantsForClose', () => {
  it('берёт ticket.unresolvedDescendants, если это массив, даже пустой', () => {
    const fromApi = unresolvedDescendantsForClose({
      unresolvedDescendants: [
        {
          id: 'c-1',
          ticketNumber: 4,
          problemText: 'Дверь',
          status: 'IN_PROGRESS',
          categoryName: 'Двери',
        },
      ],
      children: [{ id: 'ignored', status: 'NEW', problemText: 'не должен попасть' }],
    })
    expect(fromApi).toEqual([
      {
        id: 'c-1',
        ticketNumber: 4,
        problemText: 'Дверь',
        status: 'IN_PROGRESS',
        categoryName: 'Двери',
      },
    ])

    expect(
      unresolvedDescendantsForClose({
        unresolvedDescendants: [],
        children: [{ id: 'c-2', status: 'IN_PROGRESS', problemText: 'живой ребёнок' }],
      }),
    ).toEqual([])
  })

  it('иначе фильтрует children: не DONE и не CANCELED', () => {
    const items = unresolvedDescendantsForClose({
      children: [
        { id: 'open', ticketNumber: 1, status: 'IN_PROGRESS', problemText: 'открыта', problemCategory: { name: 'A' } },
        { id: 'field', ticketNumber: 2, status: 'FIELD_COMPLETE', problemText: 'на подтверждении', categoryName: 'B' },
        { id: 'done', ticketNumber: 3, status: 'DONE', problemText: 'закрыта' },
        { id: 'canceled', ticketNumber: 4, status: 'CANCELED', problemText: 'отменена' },
        { id: 'new', ticketNumber: 5, status: 'NEW', problemText: null, problemCategory: { name: 'Свет' } },
      ],
    })

    expect(items.map((row) => row.id)).toEqual(['open', 'field', 'new'])
    expect(items.find((row) => row.id === 'field')?.status).toBe('FIELD_COMPLETE')
    expect(items.find((row) => row.id === 'new')).toEqual({
      id: 'new',
      ticketNumber: 5,
      problemText: null,
      status: 'NEW',
      categoryName: 'Свет',
    })
  })
})

describe('parentCloseNeedsDialog', () => {
  it('true только если есть нерешённые строки', () => {
    expect(parentCloseNeedsDialog([])).toBe(false)
    expect(parentCloseNeedsDialog([item({ id: 'c-1', status: 'NEW' })])).toBe(true)
  })
})

describe('черновик: Подтверждаю / Нет и Ок', () => {
  const field = item({ id: 'field-1', status: 'FIELD_COMPLETE', ticketNumber: 8 })
  const open = item({ id: 'open-1', status: 'IN_PROGRESS', ticketNumber: 9, problemText: 'Мотор' })
  const items = [field, open]

  it('Подтверждаю оставляет FIELD_COMPLETE, Нет сбрасывает и даёт Выполнено/Отменено', () => {
    let draft = emptyChildCloseDraft(items)
    expect(rowNeedsFieldCompleteConfirm(field, draft.find((row) => row.ticketId === field.id))).toBe(true)
    expect(rowNeedsFieldCompleteConfirm(open, draft.find((row) => row.ticketId === open.id))).toBe(false)

    draft = applyConfirm(draft, field.id)
    expect(draft.find((row) => row.ticketId === field.id)).toEqual({
      ticketId: field.id,
      resolution: 'FIELD_COMPLETE',
      fieldCompleteRejected: false,
    })
    expect(rowNeedsFieldCompleteConfirm(field, draft.find((row) => row.ticketId === field.id))).toBe(true)

    draft = applyRejectFieldComplete(draft, field.id)
    const rejected = draft.find((row) => row.ticketId === field.id)
    expect(rejected).toEqual({
      ticketId: field.id,
      resolution: null,
      fieldCompleteRejected: true,
    })
    expect(rowNeedsFieldCompleteConfirm(field, rejected)).toBe(false)

    draft = applyRowChoice(draft, field.id, 'CANCELED')
    expect(draft.find((row) => row.ticketId === field.id)?.resolution).toBe('CANCELED')
  })

  it('Ок нельзя, пока черновик пустой или строка без выбора', () => {
    expect(isDraftComplete(items, [])).toBe(false)
    expect(isDraftComplete(items, emptyChildCloseDraft(items))).toBe(false)

    const oneChosen = applyRowChoice(emptyChildCloseDraft(items), open.id, 'FIELD_COMPLETE')
    expect(isDraftComplete(items, oneChosen)).toBe(false)

    const confirmed = applyConfirm(oneChosen, field.id)
    expect(isDraftComplete(items, confirmed)).toBe(true)
  })

  it('payload черновика — childResolutions [{ ticketId, resolution }]', () => {
    const draft = applyRowChoice(applyConfirm(emptyChildCloseDraft(items), field.id), open.id, 'CANCELED')
    expect(isDraftComplete(items, draft)).toBe(true)
    expect(toChildResolutionsPayload(items, draft)).toEqual([
      { ticketId: 'field-1', resolution: 'FIELD_COMPLETE' },
      { ticketId: 'open-1', resolution: 'CANCELED' },
    ])
  })
})

describe('descendantCloseStatusLabel', () => {
  it('FIELD_COMPLETE=Выполнено, DONE=Завершена, CANCELED=Отменена', () => {
    expect(descendantCloseStatusLabel('FIELD_COMPLETE')).toBe('Выполнено')
    expect(descendantCloseStatusLabel('DONE')).toBe('Завершена')
    expect(descendantCloseStatusLabel('CANCELED')).toBe('Отменена')
  })
})

describe('readParentCloseRefuse', () => {
  const unresolved = [
    {
      id: 'c-9',
      ticketNumber: 9,
      problemText: 'Уплотнение',
      status: 'FIELD_COMPLETE',
      categoryName: 'Дверь',
    },
  ]

  it('достаёт code из payload.code и unresolved', () => {
    const err = new ApiRequestError('refuse', 400, {
      code: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS,
      unresolved,
    })
    expect(readParentCloseRefuse(err)).toEqual({
      code: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS,
      unresolved: [
        {
          id: 'c-9',
          ticketNumber: 9,
          problemText: 'Уплотнение',
          status: 'FIELD_COMPLETE',
          categoryName: 'Дверь',
        },
      ],
    })
  })

  it('достаёт code из payload.message.code', () => {
    const err = new ApiRequestError('refuse', 400, {
      statusCode: 400,
      message: {
        code: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS,
        unresolved,
      },
    })
    const parsed = readParentCloseRefuse(err)
    expect(parsed?.code).toBe(PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS)
    expect(parsed?.unresolved).toHaveLength(1)
    expect(parsed?.unresolved[0]?.id).toBe('c-9')
  })

  it('на обычной ошибке без ApiRequestError возвращает null', () => {
    expect(readParentCloseRefuse(new Error('boom'))).toBeNull()
  })
})
