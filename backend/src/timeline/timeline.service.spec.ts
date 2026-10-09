import { TimelineService } from './timeline.service'

describe('TimelineService assignment history events', () => {
  it('maps immutable assignment history events into the ticket timeline', () => {
    const service = new TimelineService({} as any, {} as any)

    expect((service as any).toTimelineEvent('ticket.assignment_changed')).toBe('TICKET_ASSIGNMENT_CHANGED')
    expect((service as any).eventTitle('ticket.assignment_changed')).toBe('Assignment changed')
  })

  it('maps child ticket created events into the parent timeline', () => {
    const service = new TimelineService({} as any, {} as any)

    expect((service as any).toTimelineEvent('ticket.child_created')).toBe('CHILD_TICKET_CREATED')
    expect((service as any).eventTitle('ticket.child_created')).toBe('Создана подзадача')
    expect((service as any).eventToDomainType.CHILD_TICKET_CREATED).toBe('ticket.child_created')
  })

  it('maps ticket detached from parent events into the child timeline', () => {
    const service = new TimelineService({} as any, {} as any)

    expect((service as any).toTimelineEvent('ticket.detached_from_parent')).toBe(
      'TICKET_DETACHED_FROM_PARENT',
    )
    expect((service as any).eventTitle('ticket.detached_from_parent')).toBe('Отвязана от заявки')
    expect((service as any).eventToDomainType.TICKET_DETACHED_FROM_PARENT).toBe(
      'ticket.detached_from_parent',
    )
  })
})
