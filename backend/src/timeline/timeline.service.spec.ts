import { TimelineService } from './timeline.service'

describe('TimelineService assignment history events', () => {
  it('maps immutable assignment history events into the ticket timeline', () => {
    const service = new TimelineService({} as any, {} as any)

    expect((service as any).toTimelineEvent('ticket.assignment_changed')).toBe('TICKET_ASSIGNMENT_CHANGED')
    expect((service as any).eventTitle('ticket.assignment_changed')).toBe('Assignment changed')
  })
})
