import { TicketStatus, UserRole } from '@prisma/client';

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
  role: UserRole.TECHNICIAN,
  isActive: true,
  isExecutor: true,
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
    companyId: OWN,
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
  it('согласованная форма: kind, source, entityId, ticketId, timing без окна', () => {
    expect(ticketEvent(ticketRow(), 'Europe/Moscow')).toEqual({
      id: 'ticket:t-1',
      kind: 'TICKET',
      source: 'TICKET',
      entityId: 't-1',
      ticketId: 't-1',
      scheduleId: null,
      companyId: 'client-a',
      clientCompanyId: 'client-a',
      locationId: 'loc-1',
      employeeId: 'u-tech',
      title: '#1042 Не работает холодильник',
      status: TicketStatus.ASSIGNED,
      timing: {
        mode: 'DUE',
        dueAt: '2026-10-27T07:00:00.000Z',
        localDate: '2026-10-27',
        startAt: null,
        endAt: null,
        hasWindow: false,
      },
      recurrence: null,
      ticket: {
        ticketNumber: 1042,
        urgency: 'NOT_URGENT',
        priority: 'NORMAL',
        slaDueAt: null,
        parentId: null,
      },
      inspection: null,
    });
  });

  it('заявка без плановой даты — timing.mode UNSCHEDULED без срока и окна', () => {
    const event = ticketEvent(
      ticketRow({ plannedDueAt: null, assignedTechnician: null }),
      'Europe/Moscow',
    );
    expect(event.timing).toEqual({
      mode: 'UNSCHEDULED',
      dueAt: null,
      localDate: null,
      startAt: null,
      endAt: null,
      hasWindow: false,
    });
    expect(event.employeeId).toBeNull();
  });

  it('срок SLA не подменяет плановую дату', () => {
    const event = ticketEvent(
      ticketRow({
        plannedDueAt: null,
        slaDueAt: new Date('2026-10-27T10:00:00.000Z'),
      }),
      'UTC',
    );
    expect(event.timing.dueAt).toBeNull();
    expect(event.ticket?.slaDueAt).toBe('2026-10-27T10:00:00.000Z');
  });
});

describe('SMA-WORK-CALENDAR-V1 событие плана обходов', () => {
  it('ссылка на план, срок — nextDueAt, recurrence из логики повторения', () => {
    const event = inspectionEvent(scheduleRow(), 'Asia/Yekaterinburg');
    expect(event).toMatchObject({
      id: 'inspection:s-1',
      kind: 'INSPECTION',
      source: 'INSPECTION_SCHEDULE',
      entityId: 's-1',
      ticketId: null,
      scheduleId: 's-1',
      companyId: OWN,
      status: 'SCHEDULED',
      timing: {
        mode: 'DUE',
        dueAt: '2026-10-28T06:00:00.000Z',
        localDate: '2026-10-28',
        startAt: null,
        endAt: null,
        hasWindow: false,
      },
      recurrence: {
        frequency: 'MONTHLY',
        intervalDays: null,
        nextDueAt: '2026-10-28T06:00:00.000Z',
        overdueAt: '2026-10-29T06:00:00.000Z',
        isOverdue: false,
        followingDueAt: '2026-11-28T06:00:00.000Z',
      },
      ticket: null,
      inspection: { templateName: 'ТО', lastRunId: null },
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
    ).toBe('SCHEDULED');
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

  it('порядок: со сроком по сроку, затем без срока, стабильно по виду и id', () => {
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

describe('SMA-WORK-CALENDAR-V1 resources.employees', () => {
  const idle: CalendarPerson = {
    id: 'u-idle',
    firstName: 'Олег',
    lastName: 'Аксёнов',
    companyId: OWN,
    role: UserRole.MASTER,
    isActive: true,
    isExecutor: true,
  };
  const foreign: CalendarPerson = {
    id: 'u-foreign',
    firstName: 'Чужой',
    lastName: 'Исполнитель',
    companyId: 'provider-2',
    role: UserRole.TECHNICIAN,
    isActive: true,
    isExecutor: true,
  };

  it('сотрудник без событий остаётся строкой с eventCount = 0', () => {
    const employees = buildEmployeeResources({
      actorCompanyId: OWN,
      roster: [TECH, idle],
      events: [ticketEvent(ticketRow(), 'UTC')],
      eventPeople: [TECH],
      employeeFilter: null,
    });
    expect(employees).toEqual([
      {
        id: 'u-idle',
        displayName: 'Аксёнов Олег',
        companyId: OWN,
        role: UserRole.MASTER,
        isActive: true,
        isExecutor: true,
        isOwnCompany: true,
        eventCount: 0,
      },
      expect.objectContaining({ id: 'u-tech', eventCount: 1 }),
    ]);
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

  it('исполнитель другой компании: без компании, роли и внутренних признаков', () => {
    const event = ticketEvent(
      ticketRow({ assignedTechnician: foreign }),
      'UTC',
    );
    expect(
      buildEmployeeResources({
        actorCompanyId: OWN,
        roster: [],
        events: [event],
        eventPeople: [foreign],
        employeeFilter: null,
      }),
    ).toEqual([
      {
        id: 'u-foreign',
        displayName: 'Исполнитель Чужой',
        companyId: null,
        role: null,
        isActive: null,
        isExecutor: null,
        isOwnCompany: false,
        eventCount: 1,
      },
    ]);
  });

  it('исполнитель другой компании без видимого события строкой не становится', () => {
    expect(
      buildEmployeeResources({
        actorCompanyId: OWN,
        roster: [],
        events: [],
        eventPeople: [foreign],
        employeeFilter: null,
      }),
    ).toEqual([]);
  });

  it('id из фильтра сотрудников не превращается в строку; фильтр сужает штат', () => {
    const employees = buildEmployeeResources({
      actorCompanyId: OWN,
      roster: [TECH, idle],
      events: [],
      eventPeople: [],
      employeeFilter: ['u-idle', 'u-foreign'],
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
    expect(employee.role).toBeNull();
  });
});

describe('SMA-WORK-CALENDAR-V1 resources.locations', () => {
  const empty: CalendarLocation = { ...LOC, id: 'loc-2', name: 'Без событий' };
  const offDirectory: CalendarLocation = {
    ...LOC,
    id: 'loc-3',
    name: 'Вне справочника',
  };

  it('справочник даёт пустые объекты, события — счётчики', () => {
    const events = [
      ticketEvent(ticketRow(), 'UTC'),
      inspectionEvent(scheduleRow(), 'UTC'),
    ];
    expect(
      buildLocationResources({
        directory: [LOC, empty],
        eventLocations: [LOC, LOC],
        events,
        locationFilter: null,
      }),
    ).toEqual([
      { ...empty, eventCount: 0 },
      { ...LOC, eventCount: 2 },
    ]);
  });

  it('без справочника — только объекты видимых событий', () => {
    const events = [ticketEvent(ticketRow(), 'UTC')];
    expect(
      buildLocationResources({
        directory: [],
        eventLocations: [LOC, offDirectory],
        events,
        locationFilter: null,
      }).map((location) => location.id),
    ).toEqual(['loc-1']);
  });

  it('фильтр объектов сужает и справочник', () => {
    expect(
      buildLocationResources({
        directory: [LOC, empty],
        eventLocations: [],
        events: [],
        locationFilter: ['loc-2', 'loc-foreign'],
      }).map((location) => location.id),
    ).toEqual(['loc-2']);
  });
});
