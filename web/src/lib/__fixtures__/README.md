# Contract fixture календаря работ

Два файла, оба — ответы настоящего `WorkCalendarService.getCalendar`
из backend PR #453, а не данные, написанные руками.

## work-calendar.response.v1.json

Побайтовая копия `backend/src/work-calendar/__fixtures__/work-calendar.response.v1.json`.
Бэкенд держит этот файл тестом «ответ совпадает с contract fixture»
(`work-calendar.service.spec.ts`). Обновляется только у бэкенда, командой
`UPDATE_WORK_CALENDAR_FIXTURE=1 npx jest work-calendar.service`, затем копируется сюда.

`workCalendar.contract.test.ts` сверяет копию с файлом бэкенда побайтово,
когда оба лежат в одном дереве (после влития #453 и #454). В ветке
`feat/work-calendar-web` файла бэкенда нет — проверка помечается
пропущенной, а не проходит молча.

## workCalendar.scenarios.json

Двенадцать сценариев, которых нет в эталоне:
- день, неделя, месяц;
- `includeCompleted`, `statuses=DONE` без флага, `eventTypes`, `assigned`;
- переход часов в New York;
- нет LOCATIONS_VIEW;
- restricted-empty;
- обрезка планов;
- техник.

Коммит бэкенда — в поле `source.commit`. Выборки Prisma, scope заявок и права
подменены обвязкой из `work-calendar.service.spec.ts`. Планы фильтруются
по `[from, to)` и `assigned`, как это делает настоящий `listForCalendar`.

### Как пересобрать после изменения бэкенда

1. Дерево бэкенда на нужном коммите:
   `git worktree add --detach ~/.cursor/worktrees/wt-work-calendar-contract <commit>`,
   в `backend/` выполнить `npm ci && npx prisma generate`.
2. Создать `backend/src/work-calendar/zz-contract-fixture.spec.ts`:
   сначала начало `work-calendar.service.spec.ts` до блока `afterEach(...)`
   включительно, затем код ниже.
3. Запустить `WC_FIXTURE_OUT=/tmp/wc.json npx jest src/work-calendar/zz-contract-fixture.spec.ts`.
4. Положить в `workCalendar.scenarios.json` объект `{ source: {...}, cases: <содержимое /tmp/wc.json> }`.
5. Прогнать `npx vitest run src/lib/workCalendar.contract.test.ts`.

Генератор в бэкенде не коммитится: это обвязка, а не тест бэкенда.

```ts

/*
 * Генератор сценариев contract fixture для web (PR #454). Не коммитится.
 * Ответы — настоящий WorkCalendarService.getCalendar на подменённых выборках
 * (обвязка выше — начало work-calendar.service.spec.ts до afterEach).
 */
import { resolveCalendarRange, resolveCalendarTimeZone } from './work-calendar-range';

const OUT = process.env.WC_FIXTURE_OUT as string;
const TECH2 = person('44444444-4444-4444-8444-444444444444', 'Анна', 'Смирнова', PROVIDER);
const CONTRACTOR = person('55555555-5555-4555-8555-555555555555', 'Артём', 'Субподрядов', 'provider-secondary');
const LOC_EMPTY = { id: 'loc-a3', name: 'А3 без работ', city: 'Уфа', address: 'ул. Пустая, 1', clientCompanyId: CLIENT_A };
const fixtures: Record<string, { actor: unknown; query: unknown; response: unknown }> = {};

async function capture(name: string, actor: any, query: any, options: SuiteOptions) {
  // Как настоящий listForCalendar: план попадает, только если nextDueAt в [from, to)
  // и проходит фильтры исполнителя (assigned / employeeIds).
  const range = resolveCalendarRange({ from: query.from, to: query.to, timeZone: resolveCalendarTimeZone(query.timezone, 'Europe/Moscow') });
  const schedules = (options.schedules ?? []).filter(
    (s: any) =>
      s.nextDueAt >= range.from &&
      s.nextDueAt < range.to &&
      (query.assigned !== 'assigned' || s.assignedToUserId) &&
      (query.assigned !== 'unassigned' || !s.assignedToUserId),
  );
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(new Date('2026-10-22T09:00:00.000Z'));
  const { svc } = makeSuite({ ...options, schedules, fetchedSchedules: options.fetchedSchedules });
  const response: any = await svc.getCalendar(actor, query);
  expectReferencesResolve(response);
  fixtures[name] = { actor: { role: actor.role, companyId: actor.companyId }, query, response: JSON.parse(JSON.stringify(response)) };
  jest.restoreAllMocks();
  jest.useRealTimers();
}

describe('contract fixture scenarios', () => {
  it('generate', async () => {
    const weekTickets = [
      ticket({ id: 't-assigned', ticketNumber: 101, problemText: 'Не работает кондиционер', plannedDueAt: new Date('2026-10-27T07:00:00.000Z') }),
      // 22:30 UTC 27-го — уже 28-е по Москве.
      ticket({ id: 't-late', ticketNumber: 102, problemText: 'Протечка ночью', plannedDueAt: new Date('2026-10-27T22:30:00.000Z'), assignedTechnicianId: TECH2.id, assignedTechnician: TECH2 }),
      ticket({ id: 't-unassigned', ticketNumber: 103, problemText: 'Замена ламп', plannedDueAt: new Date('2026-10-29T09:00:00.000Z'), assignedTechnicianId: null, assignedTechnician: null, location: LOC_A2, locationId: LOC_A2.id }),
      ticket({ id: 't-done', ticketNumber: 104, status: TicketStatus.DONE, problemText: 'Проверка щитовой', plannedDueAt: new Date('2026-10-30T10:00:00.000Z') }),
      ticket({ id: 't-canceled', ticketNumber: 105, status: TicketStatus.CANCELED, problemText: 'Отменённая заявка', plannedDueAt: new Date('2026-10-30T11:00:00.000Z'), assignedTechnicianId: null, assignedTechnician: null }),
      ticket({ id: 't-contractor', ticketNumber: 106, problemText: 'Работа подрядчика', plannedDueAt: new Date('2026-10-31T08:00:00.000Z'), assignedTechnicianId: CONTRACTOR.id, assignedTechnician: CONTRACTOR }),
      ticket({ id: 't-unscheduled', ticketNumber: 107, status: TicketStatus.NEW, problemText: 'Заявка без даты', plannedDueAt: null, assignedTechnicianId: null, assignedTechnician: null }),
      ticket({ id: 't-unscheduled-done', ticketNumber: 108, status: TicketStatus.DONE, problemText: 'Закрытая без даты', plannedDueAt: null }),
    ];
    const weekSchedules = [
      schedule({ id: 's-planned', name: 'Ежемесячное ТО', nextDueAt: new Date('2026-10-28T06:00:00.000Z') }),
      schedule({ id: 's-overdue', name: 'Еженедельный обход', frequency: InspectionFrequency.WEEKLY, nextDueAt: new Date('2026-10-26T06:00:00.000Z'), overdueAt: new Date('2026-10-26T06:00:00.000Z'), isOverdue: true, assignedTo: null, assignedToUserId: null, location: LOC_A2 }),
      schedule({ id: 's-running', name: 'Обход в работе', nextDueAt: new Date('2026-10-29T06:00:00.000Z'), lastRun: { id: 'run-1', status: 'IN_PROGRESS', dueAt: new Date('2026-10-29T06:00:00.000Z') } }),
    ];
    const users = [TECH, IDLE, TECH2];
    const directory = [LOC_A1, LOC_A2, LOC_EMPTY];
    const base = { tickets: weekTickets, schedules: weekSchedules, users, directory };
    const ctx = { ...WEEK, linkedClientCompanyId: CLIENT_A };

    await capture('dispatcherWeek', dispatcher, ctx, base);
    await capture('dispatcherWeekCompleted', dispatcher, { ...ctx, includeCompleted: 'true' }, base);
    await capture('dispatcherWeekDoneWithoutFlag', dispatcher, { ...ctx, statuses: 'DONE' }, base);
    await capture('dispatcherWeekTickets', dispatcher, { ...ctx, eventTypes: 'TICKET' }, base);
    await capture('dispatcherWeekUnassigned', dispatcher, { ...ctx, assigned: 'unassigned' }, base);
    await capture('dispatcherMonth', dispatcher, { from: '2026-10-01', to: '2026-11-01', timezone: 'Europe/Moscow', linkedClientCompanyId: CLIENT_A }, base);
    await capture('dispatcherDay', dispatcher, { from: '2026-10-27', to: '2026-10-28', timezone: 'Europe/Moscow', linkedClientCompanyId: CLIENT_A }, base);
    // Переход на зимнее время в Нью-Йорке 1 ноября: 04:30Z 2 ноября — 23:30 EST 1 ноября.
    await capture('newYorkDstWeek', dispatcher, { from: '2026-10-26', to: '2026-11-02', timezone: 'America/New_York', linkedClientCompanyId: CLIENT_A }, {
      tickets: [
        ticket({ id: 't-dst', ticketNumber: 201, problemText: 'Поздний срок после перевода часов', plannedDueAt: new Date('2026-11-02T04:30:00.000Z') }),
        ticket({ id: 't-before-dst', ticketNumber: 202, problemText: 'Срок до перевода часов', plannedDueAt: new Date('2026-10-31T03:30:00.000Z') }),
      ],
      users,
      directory,
    });
    await capture('noLocationsView', dispatcher, ctx, { ...base, locationViewGranted: false });
    await capture('restrictedEmpty', dispatcher, WEEK, { ...base, scope: { where: null }, locationScopes: { [CLIENT_A]: { mode: 'restricted_empty', locationIds: [] } } });
    await capture('truncatedInspections', dispatcher, ctx, { ...base, fetchedSchedules: 5001 });
    await capture('technicianWeek', technician, WEEK, {
      ...base,
      tickets: weekTickets.filter((t: any) => t.assignedTechnicianId === UUID_TECH),
      schedules: weekSchedules.filter((s: any) => s.assignedToUserId === UUID_TECH),
      scope: { technicianCompanyIds: [CLIENT_A] },
    });

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(fixtures, null, 2) + '\n');
    expect(Object.keys(fixtures).length).toBe(12);
  });
});
```
