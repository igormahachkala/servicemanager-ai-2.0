# workCalendar.contract.json

Contract fixture GET `/work-calendar` для тестов календаря работ (web).

Ответы не написаны руками. Их вернул настоящий `WorkCalendarService.getCalendar`
из backend PR #453 (ветка `feat/work-calendar`, коммит в поле `source.commit`).
Выборки Prisma, scope заявок и права подменены той же обвязкой, что
в `backend/src/work-calendar/work-calendar.service.spec.ts`. Планы обходов
фильтруются по `[from, to)`, как это делает настоящий `listForCalendar`.

## Как пересобрать после изменения backend

1. Создать дерево backend на нужном коммите:
   `git worktree add --detach ~/.cursor/worktrees/wt-work-calendar-contract <commit>`;
   в `backend/`: `npm ci && npx prisma generate`.
2. Создать `backend/src/work-calendar/zz-contract-fixture.spec.ts`:
   - сначала скопировать начало `work-calendar.service.spec.ts` до строки `afterEach(...)` включительно;
   - затем дописать код ниже.
3. Запустить:
   `WC_FIXTURE_OUT=/tmp/wc.json npx jest src/work-calendar/zz-contract-fixture.spec.ts`.
4. Положить в этот файл `{ source: {...}, cases: <содержимое /tmp/wc.json> }`.
5. Прогнать `npx vitest run src/lib/workCalendar.contract.test.ts`.

Файл генератора в backend не коммитится: он обвязка, а не тест бэкенда.

```ts

/*
 * Генератор contract fixture для web (PR #454). Не коммитится.
 * Ответы — настоящий WorkCalendarService.getCalendar на подменённых выборках.
 */
import * as fs from 'fs';
import * as path from 'path';
import { resolveCalendarRange, resolveCalendarTimeZone } from './work-calendar-range';

const OUT = process.env.WC_FIXTURE_OUT as string;
const TECH2 = { id: '44444444-4444-4444-8444-444444444444', firstName: 'Анна', lastName: 'Смирнова', companyId: PROVIDER };
const fixtures: Record<string, { actor: unknown; query: unknown; response: unknown }> = {};

async function capture(name: string, actor: any, query: any, options: SuiteOptions) {
  // Как настоящий listForCalendar: план попадает, только если nextDueAt в [from, to).
  const range = resolveCalendarRange({ from: query.from, to: query.to, timeZone: resolveCalendarTimeZone(query.timezone, 'Europe/Moscow') });
  const schedules = (options.schedules ?? []).filter((s: any) => s.nextDueAt >= range.from && s.nextDueAt < range.to);
  const { svc } = makeSuite({ ...options, schedules, fetchedSchedules: options.fetchedSchedules });
  const response: any = await svc.getCalendar(actor, query);
  response.meta.generatedAt = '2026-10-22T12:00:00.000Z';
  fixtures[name] = { actor: { role: actor.role }, query, response: JSON.parse(JSON.stringify(response)) };
  jest.restoreAllMocks();
}

describe('contract fixture', () => {
  it('generate', async () => {
    const weekTickets = [
      ticket({ id: 't-assigned', ticketNumber: 101, problemText: 'Не работает кондиционер', plannedDueAt: new Date('2026-10-27T07:00:00.000Z') }),
      // 22:30 UTC 27-го — уже 28-е по Москве: раскладка по localDate, а не по UTC-дате.
      ticket({ id: 't-late', ticketNumber: 102, problemText: 'Протечка ночью', plannedDueAt: new Date('2026-10-27T22:30:00.000Z'), assignedTechnicianId: TECH2.id, assignedTechnician: TECH2 }),
      ticket({ id: 't-unassigned', ticketNumber: 103, problemText: 'Замена ламп', plannedDueAt: new Date('2026-10-29T09:00:00.000Z'), assignedTechnicianId: null, assignedTechnician: null, location: LOC_A2, locationId: LOC_A2.id }),
      ticket({ id: 't-done', ticketNumber: 104, status: TicketStatus.DONE, problemText: 'Проверка щитовой', plannedDueAt: new Date('2026-10-30T10:00:00.000Z') }),
      ticket({ id: 't-canceled', ticketNumber: 105, status: TicketStatus.CANCELED, problemText: 'Отменённая заявка', plannedDueAt: new Date('2026-10-30T11:00:00.000Z'), assignedTechnicianId: null, assignedTechnician: null }),
      ticket({ id: 't-foreign-exec', ticketNumber: 106, problemText: 'Работа подрядчика', plannedDueAt: new Date('2026-10-31T08:00:00.000Z'), assignedTechnicianId: FOREIGN.id, assignedTechnician: FOREIGN }),
      ticket({ id: 't-unscheduled', ticketNumber: 107, status: TicketStatus.NEW, problemText: 'Заявка без даты', plannedDueAt: null, assignedTechnicianId: null, assignedTechnician: null }),
      ticket({ id: 't-unscheduled-done', ticketNumber: 108, status: TicketStatus.DONE, problemText: 'Закрытая без даты', plannedDueAt: null }),
    ];
    const weekSchedules = [
      schedule({ id: 's-planned', name: 'Ежемесячное ТО', nextDueAt: new Date('2026-10-28T06:00:00.000Z') }),
      schedule({ id: 's-overdue', name: 'Еженедельный обход', frequency: InspectionFrequency.WEEKLY, nextDueAt: new Date('2026-10-26T06:00:00.000Z'), overdueAt: new Date('2026-10-26T06:00:00.000Z'), isOverdue: true, assignedTo: null, assignedToUserId: null, location: LOC_A2 }),
      schedule({ id: 's-running', name: 'Обход в работе', nextDueAt: new Date('2026-10-29T06:00:00.000Z'), lastRun: { id: 'run-1', status: 'IN_PROGRESS', dueAt: new Date('2026-10-29T06:00:00.000Z') } }),
    ];
    const users = [TECH, IDLE, TECH2];

    await capture('dispatcherWeek', dispatcher, { ...WEEK, linkedClientCompanyId: CLIENT_A }, { tickets: weekTickets, schedules: weekSchedules, users });
    await capture('dispatcherWeekActiveStatuses', dispatcher, { ...WEEK, linkedClientCompanyId: CLIENT_A, statuses: 'NEW,ASSIGNED,IN_PROGRESS,AWAITING_ACCEPTANCE,FIELD_COMPLETE,PLANNED,OVERDUE' }, { tickets: weekTickets, schedules: weekSchedules, users });
    await capture('dispatcherWeekTicketsOnly', dispatcher, { ...WEEK, linkedClientCompanyId: CLIENT_A, types: 'TICKET' }, { tickets: weekTickets, schedules: weekSchedules, users });
    await capture('dispatcherMonth', dispatcher, { from: '2026-10-01', to: '2026-11-01', timezone: 'Europe/Moscow', linkedClientCompanyId: CLIENT_A }, { tickets: weekTickets, schedules: weekSchedules, users });
    await capture('dispatcherDay', dispatcher, { from: '2026-10-27', to: '2026-10-28', timezone: 'Europe/Moscow', linkedClientCompanyId: CLIENT_A }, { tickets: weekTickets, schedules: weekSchedules, users });
    // Переход на зимнее время в Нью-Йорке 1 ноября: 04:30Z 2 ноября — это 23:30 EST 1 ноября.
    await capture('newYorkDstWeek', dispatcher, { from: '2026-10-26', to: '2026-11-02', timezone: 'America/New_York', linkedClientCompanyId: CLIENT_A }, {
      tickets: [
        ticket({ id: 't-dst', ticketNumber: 201, problemText: 'Поздний срок после перевода часов', plannedDueAt: new Date('2026-11-02T04:30:00.000Z') }),
        ticket({ id: 't-before-dst', ticketNumber: 202, problemText: 'Срок до перевода часов', plannedDueAt: new Date('2026-10-31T03:30:00.000Z') }),
      ],
      users,
    });
    await capture('noLocationsView', dispatcher, { ...WEEK, linkedClientCompanyId: CLIENT_A }, { tickets: weekTickets, schedules: weekSchedules, users, locationViewGranted: false });
    await capture('restrictedEmpty', dispatcher, WEEK, { tickets: weekTickets, schedules: weekSchedules, users, scope: { where: null }, locationScopes: { [CLIENT_A]: { mode: 'restricted_empty', locationIds: [] } } });
    await capture('truncatedInspections', dispatcher, { ...WEEK, linkedClientCompanyId: CLIENT_A }, { tickets: weekTickets, schedules: weekSchedules, users, fetchedSchedules: WORK_CALENDAR_LIMITS.inspections + 1 });
    await capture('technicianWeek', technician, WEEK, { tickets: weekTickets.filter((t: any) => t.assignedTechnicianId === UUID_TECH), schedules: weekSchedules.filter((s: any) => s.assignedToUserId === UUID_TECH), users, scope: { technicianCompanyIds: [CLIENT_A] } });

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(fixtures, null, 2) + '\n');
    expect(Object.keys(fixtures).length).toBe(10);
  });
});
```
