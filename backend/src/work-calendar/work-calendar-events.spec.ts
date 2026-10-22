import { TicketStatus } from '@prisma/client';

import {
  buildEmployeeResources,
  buildLocationResources,
  inspectionEvent,
  inspectionEventStatus,
  mergeEvents,
  ticketEvent,
  type CalendarLocation,
  type CalendarPerson,
  type CalendarScheduleRow,
  type CalendarTicketRow,
} from './work-calendar-events';

const OWN = 'provider-1';
const LOC: CalendarLocation = {
  id: 'loc-1',
  name: 'Фудзияма — Уфа',
  city: 'Уфа',
  address: 'ул. Ленина, 1',
  clientCompanyId: 'client-a',
};
const TECH: CalendarPerson = {
  id: 'u-tech',
  firstName: 'Иван',
  lastName: 'Петров',
  companyId: OWN,
};

function ticketRow(
  overrides: Partial<CalendarTicketRow> = {},
): CalendarTicketRow {
  return {
    id: 't-1',
    ticketNumber: 1042,
    companyId: 'client-a',
    status: TicketStatus.ASSIGNED,
    urgency: 'NOT_URGENT',
    priority: 'NORMAL',
    problemText: 'Не работает   холодильник',
    plannedDueAt: new Date('2026-10-27T07:00:00.000Z'),
    slaDueAt: null,
    parentId: null,
    location: LOC,
    assignedTechnician: TECH,
    ...overrides,
  };
}

function scheduleRow(
  overrides: Partial<CalendarScheduleRow> = {},
): CalendarScheduleRow {
  return {
    id: 's-1',
    name: 'ТО ежемесячное',
    frequency: 'MONTHLY',
    intervalDays: null,
    nextDueAt: new Date('2026-10-28T06:00:00.000Z'),
    followingDueAt: new Date('2026-11-28T06:00:00.000Z'),
    overdueAt: new Date('2026-10-29T06:00:00.000Z'),
    isOverdue: false,
    template: { id: 'tpl-1', name: 'ТО' },
    location: LOC,
    assignedTo: TECH,
    lastRun: null,
    ...overrides,
  };
}

describe('SMA-WORK-CALENDAR-V1 событие заявки', () => {
  it('плановая заявка: срок и местные сутки есть, окна нет', () => {
    const event = ticketEvent(ticketRow(), 'Europe/Moscow');
    expect(event).toMatchObject({
      id: 'ticket:t-1',
      type: 'TICKET',
      sourceId: 't-1',
      title: '#1042 Не работает холодильник',
      status: TicketStatus.ASSIGNED,
      scheduling: 'SCHEDULED',
      dueAt: '2026-10-27T07:00:00.000Z',
      localDate: '2026-10-27',
      startAt: null,
      endAt: null,
      hasWindow: false,
      employeeId: 'u-tech',
      locationId: 'loc-1',
      clientCompanyId: 'client-a',
    });
  });

  it('заявка без плановой даты — UNSCHEDULED без срока и без окна', () => {
    const event = ticketEvent(
      ticketRow({ plannedDueAt: null, assignedTechnician: null }),
      'Europe/Moscow',
    );
    expect(event).toMatchObject({
      scheduling: 'UNSCHEDULED',
      dueAt: null,
      localDate: null,
      startAt: null,
      endAt: null,
      hasWindow: false,
      employeeId: null,
    });
  });

  it('срок SLA не подменяет плановую дату', () => {
    const event = ticketEvent(
      ticketRow({
        plannedDueAt: null,
        slaDueAt: new Date('2026-10-27T10:00:00.000Z'),
      }),
      'UTC',
    );
    expect(event.dueAt).toBeNull();
    expect(event.ticket?.slaDueAt).toBe('2026-10-27T10:00:00.000Z');
  });
});

describe('SMA-WORK-CALENDAR-V1 событие плана обходов', () => {
  it('срок визита — nextDueAt, окна нет, данные повторения переданы как есть', () => {
    const event = inspectionEvent(scheduleRow(), 'Asia/Yekaterinburg');
    expect(event).toMatchObject({
      id: 'inspection:s-1',
      type: 'INSPECTION',
      status: 'PLANNED',
      scheduling: 'SCHEDULED',
      dueAt: '2026-10-28T06:00:00.000Z',
      localDate: '2026-10-28',
      startAt: null,
      endAt: null,
      hasWindow: false,
      inspection: {
        frequency: 'MONTHLY',
        overdueAt: '2026-10-29T06:00:00.000Z',
        isOverdue: false,
        followingDueAt: '2026-11-28T06:00:00.000Z',
      },
    });
  });

  it('«в работе» — только обход, запущенный на текущий срок', () => {
    const due = new Date('2026-10-28T06:00:00.000Z');
    expect(
      inspectionEventStatus({
        nextDueAt: due,
        isOverdue: true,
        lastRun: { id: 'r', status: 'IN_PROGRESS', dueAt: due },
      }),
    ).toBe('IN_PROGRESS');
    expect(
      inspectionEventStatus({
        nextDueAt: due,
        isOverdue: true,
        lastRun: {
          id: 'r',
          status: 'IN_PROGRESS',
          dueAt: new Date('2026-09-28T06:00:00.000Z'),
        },
      }),
    ).toBe('OVERDUE');
    expect(
      inspectionEventStatus({
        nextDueAt: due,
        isOverdue: false,
        lastRun: { id: 'r', status: 'COMPLETED', dueAt: due },
      }),
    ).toBe('PLANNED');
  });
});

describe('SMA-WORK-CALENDAR-V1 дублирование событий', () => {
  it('одна сущность — одно событие, даже если строка пришла дважды', () => {
    const events = mergeEvents([
      ticketEvent(ticketRow(), 'UTC'),
      ticketEvent(ticketRow(), 'UTC'),
      inspectionEvent(scheduleRow(), 'UTC'),
      inspectionEvent(scheduleRow(), 'UTC'),
    ]);
    expect(events.map((event) => event.id)).toEqual([
      'ticket:t-1',
      'inspection:s-1',
    ]);
  });

  it('заявка и план с одинаковым id источника — разные события', () => {
    const events = mergeEvents([
      ticketEvent(ticketRow({ id: 'same' }), 'UTC'),
      inspectionEvent(scheduleRow({ id: 'same' }), 'UTC'),
    ]);
    expect(events).toHaveLength(2);
  });

  it('порядок: со сроком по сроку, затем без срока, стабильно по типу и id', () => {
    const events = mergeEvents([
      ticketEvent(ticketRow({ id: 'u-2', plannedDueAt: null }), 'UTC'),
      inspectionEvent(
        scheduleRow({ nextDueAt: new Date('2026-10-27T07:00:00.000Z') }),
        'UTC',
      ),
      ticketEvent(ticketRow({ id: 'u-1', plannedDueAt: null }), 'UTC'),
      ticketEvent(ticketRow(), 'UTC'),
    ]);
    expect(events.map((event) => event.id)).toEqual([
      'inspection:s-1',
      'ticket:t-1',
      'ticket:u-1',
      'ticket:u-2',
    ]);
  });
});

describe('SMA-WORK-CALENDAR-V1 resources', () => {
  const idle: CalendarPerson = {
    id: 'u-idle',
    firstName: 'Олег',
    lastName: 'Аксёнов',
    companyId: OWN,
  };
  const foreign: CalendarPerson = {
    id: 'u-foreign',
    firstName: 'Чужой',
    lastName: 'Исполнитель',
    companyId: 'provider-2',
  };

  it('сотрудник без событий остаётся строкой', () => {
    const employees = buildEmployeeResources({
      actorCompanyId: OWN,
      roster: [TECH, idle],
      events: [],
      eventPeople: [],
      employeeFilter: null,
    });
    expect(employees.map((employee) => employee.id)).toEqual([
      'u-idle',
      'u-tech',
    ]);
    expect(employees[0]).toEqual({
      id: 'u-idle',
      firstName: 'Олег',
      lastName: 'Аксёнов',
      displayName: 'Аксёнов Олег',
      isOwnCompany: true,
    });
  });

  it('пустой штат и ни одного события — пустой список, а не ошибка', () => {
    expect(
      buildEmployeeResources({
        actorCompanyId: OWN,
        roster: [],
        events: [],
        eventPeople: [],
        employeeFilter: null,
      }),
    ).toEqual([]);
  });

  it('исполнитель другой компании — строкой только при видимом событии', () => {
    const event = ticketEvent(
      ticketRow({ assignedTechnician: foreign }),
      'UTC',
    );
    const withEvent = buildEmployeeResources({
      actorCompanyId: OWN,
      roster: [],
      events: [event],
      eventPeople: [foreign],
      employeeFilter: null,
    });
    expect(withEvent).toEqual([
      expect.objectContaining({ id: 'u-foreign', isOwnCompany: false }),
    ]);

    const withoutEvent = buildEmployeeResources({
      actorCompanyId: OWN,
      roster: [],
      events: [],
      eventPeople: [foreign],
      employeeFilter: null,
    });
    expect(withoutEvent).toEqual([]);
  });

  it('id из фильтра сотрудников не превращается в строку', () => {
    const employees = buildEmployeeResources({
      actorCompanyId: OWN,
      roster: [TECH],
      events: [],
      eventPeople: [],
      employeeFilter: ['u-tech', 'u-foreign'],
    });
    expect(employees.map((employee) => employee.id)).toEqual(['u-tech']);
  });

  it('фильтр сотрудников сужает и штат', () => {
    const employees = buildEmployeeResources({
      actorCompanyId: OWN,
      roster: [TECH, idle],
      events: [],
      eventPeople: [],
      employeeFilter: ['u-idle'],
    });
    expect(employees.map((employee) => employee.id)).toEqual(['u-idle']);
  });

  it('сотрудник без имени получает подпись, а не пустую строку', () => {
    const [employee] = buildEmployeeResources({
      actorCompanyId: OWN,
      roster: [{ id: 'u-x', firstName: null, lastName: '  ', companyId: OWN }],
      events: [],
      eventPeople: [],
      employeeFilter: null,
    });
    expect(employee.displayName).toBe('Без имени');
  });

  it('объекты — только с видимыми событиями и без повторов', () => {
    const other: CalendarLocation = {
      ...LOC,
      id: 'loc-2',
      name: 'Без событий',
    };
    const events = [
      ticketEvent(ticketRow(), 'UTC'),
      inspectionEvent(scheduleRow(), 'UTC'),
    ];
    expect(buildLocationResources([LOC, LOC, other], events)).toEqual([LOC]);
  });
});
