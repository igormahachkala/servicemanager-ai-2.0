import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { IdempotencyService } from '../common/idempotency/idempotency.service';

import { TicketsStatusService } from './tickets.status.service';

/**
 * SMA-TICKET-REPLY-V1-BACKEND-FOUNDATION-120H.
 *
 * Ответ на сообщение — это обычный комментарий с ссылкой на другой комментарий
 * той же заявки. Проверяется ровно это: связь пишется, доступа не даёт, и ничего
 * из прежнего поведения комментария не изменилось.
 *
 * Разграничение с соседними наборами: tickets.status.service.spec.ts проверяет
 * сам комментарий и его политику, secondary-contract-visibility.spec.ts —
 * сужение SECONDARY. Здесь — только связь ответа и её границы.
 */

const PROVIDER_ID = 'provider-1';
const CLIENT_ID = 'client-1';
const TICKET_ID = 'ticket-1';
const OTHER_TICKET_ID = 'ticket-2';
const USER_ID = 'user-1';

function makeSuite(options: { replyTarget?: any } = {}) {
  const txTicket = {
    id: TICKET_ID,
    companyId: CLIENT_ID,
    ticketNumber: 42,
    status: 'IN_PROGRESS',
    assignedTechnicianId: null,
  };

  /** Заглушка цели ответа. Ведёт себя как запрос к базе, см. findFirst ниже. */
  const ticketComment = {
    create: jest.fn(async ({ data }: any) => ({ id: 'tc-new', ...data })),
    findFirst: jest.fn(async ({ where }: any) => {
      const target = options.replyTarget;
      if (!target) return null;
      /*
       * Ведёт себя как настоящий запрос: применяется только то условие,
       * которое в where действительно есть. Если бы заглушка сверяла все три
       * поля всегда, она сама закрывала бы дыру — убранное из сервиса сужение
       * по ticketId или companyId всё равно давало бы «не найдено», и
       * отрицательный контроль ничего бы не показал.
       */
      for (const field of ['id', 'ticketId', 'companyId'] as const) {
        if (field in where && where[field] !== undefined && where[field] !== target[field]) return null;
      }
      return { id: target.id };
    }),
  };

  const tx = {
    ticket: { findFirst: jest.fn().mockResolvedValue(txTicket) },
    ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    ticketComment,
  };

  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ isExecutor: false }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  } as any;

  const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }) };
  const notifications = { scheduleTicketCommentAdded: jest.fn() };

  const svc = new TicketsStatusService(prisma, timeline as any, {} as any, notifications as any);

  return { svc, prisma, tx, ticketComment, timeline, notifications };
}

/**
 * Доступ подменяется на уровне модуля: внутренний метод вызывает
 * resolveTicketOperationAccess напрямую, и без подмены набор потребовал бы
 * настоящих контрактов. Отказ доступа моделируется отдельным тестом ниже.
 */
jest.mock('./ticket-access.utils', () => {
  const actual = jest.requireActual('./ticket-access.utils');
  return {
    ...actual,
    resolveTicketOperationAccess: jest.fn(async () => ({
      ticket: { id: 'ticket-1', companyId: 'client-1' },
      visibilityMode: 'provider_primary',
      operationCompanyId: 'provider-1',
    })),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const accessUtils = require('./ticket-access.utils');

const ACTOR = { id: USER_ID };
const DTO = { comment: 'Проверил компрессор, нужна замена.' };

function resetAccess() {
  accessUtils.resolveTicketOperationAccess.mockImplementation(async () => ({
    ticket: { id: TICKET_ID, companyId: CLIENT_ID },
    visibilityMode: 'provider_primary',
    operationCompanyId: PROVIDER_ID,
  }));
}

describe('120H ответ на сообщение заявки', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAccess();
  });

  // ── 1. обычный комментарий не изменился ──────────────────────────────────

  it('1. комментарий без ответа пишется как прежде и связи не получает', async () => {
    const { svc, tx, ticketComment } = makeSuite();

    await expect(
      svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, DTO),
    ).resolves.toEqual({ ok: true });

    // Цель ответа не спрашивали вовсе.
    expect(ticketComment.findFirst).not.toHaveBeenCalled();
    expect(ticketComment.create).toHaveBeenCalledTimes(1);
    expect(ticketComment.create.mock.calls[0][0].data.replyToId).toBeNull();
    // Прежние следы комментария остались на месте.
    expect(tx.ticketStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it('1. пустой комментарий по-прежнему отказ, и до записи не доходит', async () => {
    const { svc, ticketComment } = makeSuite();

    await expect(
      svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { comment: '   ' }),
    ).rejects.toThrow('comment is required');
    expect(ticketComment.create).not.toHaveBeenCalled();
  });

  // ── 2. допустимый ответ ──────────────────────────────────────────────────

  it('2. ответ сохраняет ссылку на исходное сообщение', async () => {
    const { svc, ticketComment } = makeSuite({
      replyTarget: { id: 'tc-original', ticketId: TICKET_ID, companyId: CLIENT_ID },
    });

    await expect(
      svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-original' }),
    ).resolves.toEqual({ ok: true });

    const data = ticketComment.create.mock.calls[0][0].data;
    expect(data.replyToId).toBe('tc-original');
    expect(data.ticketId).toBe(TICKET_ID);
    expect(data.companyId).toBe(CLIENT_ID);
    expect(data.authorUserId).toBe(USER_ID);
    expect(data.body).toBe(DTO.comment);
  });

  it('2. цель ищется только внутри этой заявки и этой компании', async () => {
    const { svc, ticketComment } = makeSuite({
      replyTarget: { id: 'tc-original', ticketId: TICKET_ID, companyId: CLIENT_ID },
    });

    await svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-original' });

    // Ни одно из трёх условий не приходит от клиента.
    expect(ticketComment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tc-original', ticketId: TICKET_ID, companyId: CLIENT_ID },
      }),
    );
  });

  // ── 3-6. границы цели ────────────────────────────────────────────────────

  it('3. сообщение другой заявки целью быть не может', async () => {
    const { svc, ticketComment, tx } = makeSuite({
      replyTarget: { id: 'tc-foreign', ticketId: OTHER_TICKET_ID, companyId: CLIENT_ID },
    });

    await expect(
      svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-foreign' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(ticketComment.create).not.toHaveBeenCalled();
    expect(tx.ticketStatusHistory.create).not.toHaveBeenCalled();
  });

  it('4. сообщение другого арендатора целью быть не может', async () => {
    const { svc, ticketComment } = makeSuite({
      replyTarget: { id: 'tc-other-tenant', ticketId: TICKET_ID, companyId: 'client-999' },
    });

    await expect(
      svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-other-tenant' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ticketComment.create).not.toHaveBeenCalled();
  });

  it('6. неизвестная цель — отказ без подсказок', async () => {
    const { svc, ticketComment } = makeSuite({ replyTarget: null });

    await expect(
      svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-nope' }),
    ).rejects.toThrow(new NotFoundException('Reply target not found'));
    expect(ticketComment.create).not.toHaveBeenCalled();
  });

  // ── 5, 7. порядок: доступ раньше цели ────────────────────────────────────

  it('5, 7. отказ доступа к заявке случается раньше любого обращения к цели', async () => {
    const { svc, ticketComment, prisma } = makeSuite({
      replyTarget: { id: 'tc-original', ticketId: TICKET_ID, companyId: CLIENT_ID },
    });
    // Так ведёт себя SECONDARY вне делегированного охвата и чужой арендатор:
    // канонический решатель доступа отказывает до всего остального.
    accessUtils.resolveTicketOperationAccess.mockImplementation(async () => {
      throw new NotFoundException('Ticket not found');
    });

    await expect(
      svc.addComment(PROVIDER_ID, ACTOR, UserRole.TECHNICIAN, TICKET_ID, { ...DTO, replyToId: 'tc-original' }),
    ).rejects.toThrow(new NotFoundException('Ticket not found'));

    // Транзакция не открывалась, цель не запрашивалась, строк не появилось.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(ticketComment.findFirst).not.toHaveBeenCalled();
    expect(ticketComment.create).not.toHaveBeenCalled();
  });

  // ── 10-11. журнал и уведомление ──────────────────────────────────────────

  it('10. COMMENT_ADDED пишется ровно один раз и для ответа тоже', async () => {
    const { svc, timeline } = makeSuite({
      replyTarget: { id: 'tc-original', ticketId: TICKET_ID, companyId: CLIENT_ID },
    });

    await svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-original' });

    expect(timeline.recordTx).toHaveBeenCalledTimes(1);
    expect(timeline.recordTx.mock.calls[0][1]).toMatchObject({
      event: 'COMMENT_ADDED',
      payload: { source: 'manual_comment' },
    });
  });

  it('11. уведомление остаётся обычным уведомлением о комментарии', async () => {
    const { svc, notifications } = makeSuite({
      replyTarget: { id: 'tc-original', ticketId: TICKET_ID, companyId: CLIENT_ID },
    });

    await svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-original' });

    // Ровно тот же вызов, что и у комментария без ответа: второго пути нет.
    expect(notifications.scheduleTicketCommentAdded).toHaveBeenCalledTimes(1);
    expect(notifications.scheduleTicketCommentAdded.mock.calls[0][0]).toMatchObject({
      ticketId: TICKET_ID,
      summary: DTO.comment,
      actorUserId: USER_ID,
    });
    expect(Object.keys(notifications)).toEqual(['scheduleTicketCommentAdded']);
  });
});

// ── 8-9. идемпотентность ───────────────────────────────────────────────────

describe('120H идемпотентность ответа', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAccess();
  });

  it('8. повтор с тем же ключом создаёт один комментарий', async () => {
    const { svc, ticketComment } = makeSuite({
      replyTarget: { id: 'tc-original', ticketId: TICKET_ID, companyId: CLIENT_ID },
    });

    // Канонический механизм: первый вызов исполняет, второй отдаёт сохранённое.
    const store = new Map<string, { fingerprint: string; entityId: string }>();
    const idempotency = {
      run: jest.fn(async (scope: any, fingerprint: string, handlers: any) => {
        const key = `${scope.companyId}|${scope.userId}|${scope.operationType}|${scope.key}`;
        const existing = store.get(key);
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            throw new ConflictException({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
          }
          return { result: await handlers.replay(existing.entityId), executed: false };
        }
        const done = await handlers.execute({ noteStorageKey: async () => undefined });
        store.set(key, { fingerprint, entityId: done.entityId });
        return { result: done.result, executed: true };
      }),
    };
    (svc as any).idempotency = idempotency;
    (svc as any).prisma.domainEvent = { findUnique: jest.fn().mockResolvedValue({ id: 'ev-1' }) };

    const dto = { ...DTO, replyToId: 'tc-original' };
    await svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, dto, undefined, 'key-1');
    await svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, dto, undefined, 'key-1');

    expect(idempotency.run).toHaveBeenCalledTimes(2);
    expect(ticketComment.create).toHaveBeenCalledTimes(1);
  });

  it('9. тот же ключ с другой целью ответа — конфликт, а не подмена связи', async () => {
    const { svc, ticketComment } = makeSuite({
      replyTarget: { id: 'tc-original', ticketId: TICKET_ID, companyId: CLIENT_ID },
    });

    const store = new Map<string, { fingerprint: string; entityId: string }>();
    const idempotency = {
      run: jest.fn(async (scope: any, fingerprint: string, handlers: any) => {
        const key = `${scope.companyId}|${scope.userId}|${scope.operationType}|${scope.key}`;
        const existing = store.get(key);
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            throw new ConflictException({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
          }
          return { result: await handlers.replay(existing.entityId), executed: false };
        }
        const done = await handlers.execute({ noteStorageKey: async () => undefined });
        store.set(key, { fingerprint, entityId: done.entityId });
        return { result: done.result, executed: true };
      }),
    };
    (svc as any).idempotency = idempotency;

    await svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-original' }, undefined, 'key-2');

    await expect(
      svc.addComment(PROVIDER_ID, ACTOR, UserRole.ADMIN, TICKET_ID, { ...DTO, replyToId: 'tc-other' }, undefined, 'key-2'),
    ).rejects.toBeInstanceOf(ConflictException);

    // Второй раз связь не записана — именно это конфликт и защищает.
    expect(ticketComment.create).toHaveBeenCalledTimes(1);
  });

  it('9. отпечаток различает цель ответа', () => {
    const a = IdempotencyService.fingerprint({ ticketId: TICKET_ID, comment: DTO.comment, replyToId: 'tc-a' });
    const b = IdempotencyService.fingerprint({ ticketId: TICKET_ID, comment: DTO.comment, replyToId: 'tc-b' });
    const none = IdempotencyService.fingerprint({ ticketId: TICKET_ID, comment: DTO.comment, replyToId: null });

    expect(a).not.toBe(b);
    expect(a).not.toBe(none);
    expect(b).not.toBe(none);
  });
});
