import { TicketUrgency } from '@prisma/client'

import { TicketsAssignmentService } from './tickets.assignment.service'

/**
 * SMA-TICKET-HISTORY-AUDIT-001.
 * Карта изменений для события ticket.updated: только реально изменённые поля,
 * старое и новое значение, человекочитаемые названия для связанных сущностей.
 */
describe('TicketsAssignmentService ticket update history', () => {
  function makeService() {
    return new TicketsAssignmentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )
  }

  function makeTx(rows?: {
    locations?: { id: string; name: string }[]
    categories?: { id: string; name: string }[]
    equipment?: { id: string; name: string }[]
  }) {
    return {
      location: { findMany: jest.fn().mockResolvedValue(rows?.locations ?? []) },
      problemCategory: { findMany: jest.fn().mockResolvedValue(rows?.categories ?? []) },
      equipment: { findMany: jest.fn().mockResolvedValue(rows?.equipment ?? []) },
    }
  }

  const before = {
    locationId: 'loc-old',
    equipmentId: null,
    problemCategoryId: 'cat-old',
    problemText: 'Старое описание',
    urgency: TicketUrgency.NOT_URGENT,
    urgencyReason: null,
    requesterName: 'Пётр',
    requesterPhone: '+70000000001',
    address: 'Старый адрес',
    pointName: 'Точка А',
  }

  function build(svc: any, tx: any, changedFields: string[], after: Record<string, unknown>) {
    return svc.buildTicketUpdateChanges(tx, { changedFields, before, after })
  }

  it('одно изменённое поле — одна запись со старым и новым значением', async () => {
    const svc = makeService()
    const changes = await build(svc, makeTx(), ['problemText'], { problemText: 'Новое описание' })

    expect(Object.keys(changes)).toEqual(['problemText'])
    expect(changes.problemText).toEqual({ from: 'Старое описание', to: 'Новое описание' })
  })

  it('несколько полей — одно событие со всеми изменениями', async () => {
    const svc = makeService()
    const tx = makeTx({
      locations: [
        { id: 'loc-old', name: 'Уфа 18' },
        { id: 'loc-new', name: 'Уфа 11' },
      ],
      categories: [
        { id: 'cat-old', name: 'Другое' },
        { id: 'cat-new', name: 'Кондиционирование' },
      ],
    })

    const changes = await build(svc, tx, ['locationId', 'problemCategoryId', 'urgency'], {
      locationId: 'loc-new',
      problemCategoryId: 'cat-new',
      urgency: TicketUrgency.URGENT,
    })

    expect(Object.keys(changes).sort()).toEqual(['locationId', 'problemCategoryId', 'urgency'])
    expect(changes.locationId).toEqual({
      from: 'Уфа 18',
      to: 'Уфа 11',
      fromId: 'loc-old',
      toId: 'loc-new',
    })
    expect(changes.problemCategoryId).toEqual({
      from: 'Другое',
      to: 'Кондиционирование',
      fromId: 'cat-old',
      toId: 'cat-new',
    })
    expect(changes.urgency).toEqual({ from: TicketUrgency.NOT_URGENT, to: TicketUrgency.URGENT })
  })

  it('неизменённое поле отсутствует в карте', async () => {
    const svc = makeService()
    const changes = await build(svc, makeTx(), ['problemText'], {
      problemText: 'Новое описание',
      // адрес передан, но его нет в changedFields — значит он не менялся
      address: 'Старый адрес',
    })

    expect(changes.address).toBeUndefined()
  })

  it('изменений нет — карта пустая, событию нечего нести', async () => {
    const svc = makeService()
    const changes = await build(svc, makeTx(), [], {})

    expect(changes).toEqual({})
  })

  it('смена локации сохраняет названия и идентификаторы', async () => {
    const svc = makeService()
    const tx = makeTx({
      locations: [
        { id: 'loc-old', name: 'Уфа 18' },
        { id: 'loc-new', name: 'Уфа 11' },
      ],
    })

    const changes = await build(svc, tx, ['locationId'], { locationId: 'loc-new' })

    expect(changes.locationId.from).toBe('Уфа 18')
    expect(changes.locationId.to).toBe('Уфа 11')
    expect(changes.locationId.fromId).toBe('loc-old')
    expect(changes.locationId.toId).toBe('loc-new')
  })

  it('данные заявителя фиксируются', async () => {
    const svc = makeService()
    const changes = await build(svc, makeTx(), ['requesterName', 'requesterPhone'], {
      requesterName: 'Иван',
      requesterPhone: '+70000000002',
    })

    expect(changes.requesterName).toEqual({ from: 'Пётр', to: 'Иван' })
    expect(changes.requesterPhone).toEqual({ from: '+70000000001', to: '+70000000002' })
  })

  it('снятие оборудования фиксируется как переход в пустое значение', async () => {
    const svc = makeService()
    const tx = makeTx({ equipment: [{ id: 'eq-old', name: 'Сплит-система' }] })

    const changes = await (svc as any).buildTicketUpdateChanges(tx, {
      changedFields: ['equipmentId'],
      before: { ...before, equipmentId: 'eq-old' },
      after: { equipmentId: null },
    })

    expect(changes.equipmentId).toEqual({
      from: 'Сплит-система',
      to: null,
      fromId: 'eq-old',
      toId: null,
    })
  })

  it('связанные сущности не запрашиваются, если не менялись', async () => {
    const svc = makeService()
    const tx = makeTx()

    await build(svc, tx, ['problemText'], { problemText: 'Новое описание' })

    expect(tx.location.findMany).not.toHaveBeenCalled()
    expect(tx.problemCategory.findMany).not.toHaveBeenCalled()
    expect(tx.equipment.findMany).not.toHaveBeenCalled()
  })
})
