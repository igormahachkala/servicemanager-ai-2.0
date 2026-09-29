import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * SMA-NOTIFICATION-SELF-SCOPE-REGRESSION-HARDENING-110.
 *
 * Четыре личных маршрута уведомлений отдают строго свои уведомления:
 * личность берётся из токена и ниоткуда больше.
 *
 * До этой регрессии свойство держалось только кодом. Существующий набор
 * проверял метаданные @Roles — кого пускают на маршрут, — и ни один тест
 * не проверял, ЧЬИ уведомления маршрут возвращает. Подмена req.user.id
 * на (req.query?.userId as string) || req.user.id оставляла весь набор
 * зелёным, а означала бы чтение уведомлений коллеги по своей компании:
 * выборка идёт по { companyId, userId }, и companyId у них общий.
 *
 * Свойство стало несущим после того, как в эти маршруты допустили
 * CLIENT_ADMIN, поэтому здесь же проверяется и он.
 *
 * Проверяется поведение, а не разметка: контроллер зовётся с враждебными
 * query, body и params, сервис работает на складе с двумя пользователями
 * одной компании.
 */

const COMPANY = 'company-1';
const ACTOR = 'user-actor';
const NEIGHBOUR = 'user-neighbour';
const OTHER_COMPANY = 'company-2';

type Row = {
  id: string;
  companyId: string;
  userId: string;
  readAt: Date | null;
  createdAt: Date;
};

function makeRows(): Row[] {
  const createdAt = new Date('2026-09-29T10:00:00.000Z');
  return [
    { id: 'n-actor-unread', companyId: COMPANY, userId: ACTOR, readAt: null, createdAt },
    { id: 'n-actor-read', companyId: COMPANY, userId: ACTOR, readAt: createdAt, createdAt },
    { id: 'n-neighbour-unread', companyId: COMPANY, userId: NEIGHBOUR, readAt: null, createdAt },
    { id: 'n-neighbour-read', companyId: COMPANY, userId: NEIGHBOUR, readAt: createdAt, createdAt },
    { id: 'n-foreign-company', companyId: OTHER_COMPANY, userId: ACTOR, readAt: null, createdAt },
  ];
}

/** Разбор where в объёме, который использует сервис: скалярное равенство, включая null. */
function matches(row: Row, where: any): boolean {
  return Object.entries(where ?? {}).every(([field, cond]) => (row as any)[field] === cond);
}

function makeService() {
  const store = makeRows();

  const prisma = {
    notification: {
      findMany: jest.fn(async ({ where }: any) => store.filter((row) => matches(row, where))),
      count: jest.fn(async ({ where }: any) => store.filter((row) => matches(row, where)).length),
      findFirst: jest.fn(async ({ where }: any) => store.find((row) => matches(row, where)) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const row = store.find((item) => item.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const affected = store.filter((row) => matches(row, where));
        affected.forEach((row) => Object.assign(row, data));
        return { count: affected.length };
      }),
    },
  } as any;

  const svc = new NotificationsService(prisma, {} as any, {} as any, {} as any, {} as any);
  return { svc, store };
}

/** Контроллер со шпионом вместо сервиса: интересно, с какой личностью его зовут. */
function makeController() {
  const seen: Array<{ method: string; companyId: string; userId: string; id?: string }> = [];

  const notifications = {
    listForUser: jest.fn(async (companyId: string, userId: string) => {
      seen.push({ method: 'listForUser', companyId, userId });
      return { items: [], unreadCount: 0 };
    }),
    unreadCountForUser: jest.fn(async (companyId: string, userId: string) => {
      seen.push({ method: 'unreadCountForUser', companyId, userId });
      return 0;
    }),
    markAllRead: jest.fn(async (companyId: string, userId: string) => {
      seen.push({ method: 'markAllRead', companyId, userId });
      return { ok: true as const, updated: 0 };
    }),
    markOneRead: jest.fn(async (companyId: string, userId: string, id: string) => {
      seen.push({ method: 'markOneRead', companyId, userId, id });
      return { ok: true as const, notification: null as any };
    }),
  } as any;

  const controller = new NotificationsController(notifications, {} as any);
  return { controller, seen };
}

/** Запрос, в котором чужой id подсунут всеми доступными способами. */
function hostileReq(role: UserRole) {
  return {
    user: { id: ACTOR, companyId: COMPANY, role },
    query: { userId: NEIGHBOUR, companyId: OTHER_COMPANY, id: NEIGHBOUR },
    body: { userId: NEIGHBOUR, companyId: OTHER_COMPANY },
    params: { userId: NEIGHBOUR },
    headers: { 'x-user-id': NEIGHBOUR },
  } as any;
}

const ROLES_ON_THESE_ROUTES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT,
  UserRole.TECHNICIAN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.STAFF,
  UserRole.PLATFORM_ADMIN,
];

describe('110/1-3 личность берётся только из токена', () => {
  it.each(ROLES_ON_THESE_ROUTES)(
    'роль %s: все четыре маршрута зовут сервис с личностью из req.user',
    async (role) => {
      const { controller, seen } = makeController();
      const req = hostileReq(role);

      await controller.list(req);
      await controller.unreadCount(req);
      await controller.markAllRead(req);
      await controller.markOneRead(req, 'n-neighbour-unread');

      expect(seen).toHaveLength(4);
      for (const call of seen) {
        expect({ method: call.method, companyId: call.companyId, userId: call.userId }).toEqual({
          method: call.method,
          companyId: COMPANY,
          userId: ACTOR,
        });
      }
    },
  );

  it('2. чужой id из query, body, params и заголовка не выбирает пользователя', async () => {
    const { controller, seen } = makeController();

    await controller.list(hostileReq(UserRole.ADMIN));

    expect(seen[0].userId).toBe(ACTOR);
    expect(seen[0].userId).not.toBe(NEIGHBOUR);
    expect(seen[0].companyId).toBe(COMPANY);
    expect(seen[0].companyId).not.toBe(OTHER_COMPANY);
  });

  it('2. в сигнатурах маршрутов нет параметра выбора пользователя', () => {
    // Идентификатор из пути принимает только markOneRead — и это id уведомления.
    expect(controllerArity('list')).toBe(1);
    expect(controllerArity('unreadCount')).toBe(1);
    expect(controllerArity('markAllRead')).toBe(1);
    expect(controllerArity('markOneRead')).toBe(2);
  });
});

function controllerArity(method: keyof NotificationsController): number {
  return (NotificationsController.prototype[method] as any).length;
}

describe('110/7 список отдаёт только свои', () => {
  it('7. соседа по компании и чужой компании в выдаче нет', async () => {
    const { svc } = makeService();

    const result = await svc.listForUser(COMPANY, ACTOR);

    expect(result.items.map((row: any) => row.id)).toEqual(['n-actor-unread', 'n-actor-read']);
    expect(result.items.every((row: any) => row.userId === ACTOR)).toBe(true);
    expect(result.items.every((row: any) => row.companyId === COMPANY)).toBe(true);
  });

  it('3. подстановка чужого id вернула бы чужое — значит выборка действительно по нему', async () => {
    /*
     * Обратная проверка: сервис сам по себе отдаёт то, что просят. Значит
     * единственная защита — то, что аргумент приходит из токена, и она
     * закреплена набором выше.
     */
    const { svc } = makeService();

    const neighbour = await svc.listForUser(COMPANY, NEIGHBOUR);

    expect(neighbour.items.map((row: any) => row.id)).toEqual([
      'n-neighbour-unread',
      'n-neighbour-read',
    ]);
  });
});

describe('110/6 счётчик считает только свои', () => {
  it('6. непрочитанные соседа не попадают в счётчик', async () => {
    const { svc } = makeService();

    expect(await svc.unreadCountForUser(COMPANY, ACTOR)).toBe(1);
  });

  it('6. уведомление той же учётки в другой компании не считается', async () => {
    const { svc } = makeService();

    expect(await svc.unreadCountForUser(OTHER_COMPANY, ACTOR)).toBe(1);
    expect(await svc.unreadCountForUser(COMPANY, ACTOR)).toBe(1);
  });
});

describe('110/5 «прочитать всё» трогает только свои', () => {
  it('5. непрочитанное соседа остаётся непрочитанным', async () => {
    const { svc, store } = makeService();

    const res = await svc.markAllRead(COMPANY, ACTOR);

    expect(res.updated).toBe(1);
    expect(store.find((row) => row.id === 'n-actor-unread')?.readAt).not.toBeNull();
    expect(store.find((row) => row.id === 'n-neighbour-unread')?.readAt).toBeNull();
    expect(store.find((row) => row.id === 'n-foreign-company')?.readAt).toBeNull();
  });
});

describe('110/4 одиночное чтение чужого недоступно', () => {
  it('4. чужое уведомление той же компании даёт «не найдено»', async () => {
    const { svc, store } = makeService();

    await expect(svc.markOneRead(COMPANY, ACTOR, 'n-neighbour-unread')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // И осталось нетронутым.
    expect(store.find((row) => row.id === 'n-neighbour-unread')?.readAt).toBeNull();
  });

  it('4. уведомление другой компании даёт «не найдено»', async () => {
    const { svc } = makeService();

    await expect(svc.markOneRead(COMPANY, ACTOR, 'n-foreign-company')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('4. отказ одинаков для чужого и несуществующего — существование не раскрывается', async () => {
    const { svc } = makeService();

    const foreign = await svc.markOneRead(COMPANY, ACTOR, 'n-neighbour-unread').catch((e) => e);
    const missing = await svc.markOneRead(COMPANY, ACTOR, 'does-not-exist').catch((e) => e);

    expect(foreign).toBeInstanceOf(NotFoundException);
    expect(missing).toBeInstanceOf(NotFoundException);
    expect(foreign.message).toBe(missing.message);
  });

  it('4. своё уведомление читается', async () => {
    const { svc, store } = makeService();

    const res = await svc.markOneRead(COMPANY, ACTOR, 'n-actor-unread');

    expect(res.ok).toBe(true);
    expect(store.find((row) => row.id === 'n-actor-unread')?.readAt).not.toBeNull();
  });
});

describe('110 CLIENT_ADMIN: допуск сохранён, область — своя', () => {
  it('роль остаётся допущенной к четырём маршрутам', () => {
    const { ROLES_KEY } = require('../common/roles.decorator');
    for (const method of ['list', 'unreadCount', 'markAllRead', 'markOneRead'] as const) {
      const declared = Reflect.getMetadata(ROLES_KEY, NotificationsController.prototype[method]) ?? [];
      expect(declared).toContain(UserRole.CLIENT_ADMIN);
    }
  });

  it('и при этом видит только свои уведомления', async () => {
    const { controller, seen } = makeController();

    await controller.list(hostileReq(UserRole.CLIENT_ADMIN));
    await controller.unreadCount(hostileReq(UserRole.CLIENT_ADMIN));

    expect(seen.map((call) => call.userId)).toEqual([ACTOR, ACTOR]);

    const { svc } = makeService();
    const own = await svc.listForUser(COMPANY, ACTOR);
    expect(own.items.every((row: any) => row.userId === ACTOR)).toBe(true);
  });
});
