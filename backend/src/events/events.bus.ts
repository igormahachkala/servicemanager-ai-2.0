import { Prisma, PrismaClient } from '@prisma/client';
import { DomainEvent } from './events.types';

/**
 * Event Bus v2 (Tx/Outbox-ready)
 *
 * Главный путь: emitDomainEventTx(tx, ev) — запись события ВНУТРИ транзакции.
 * Это и есть “outbox/atomicity foundation”: изменения домена и запись события атомарны.
 *
 * Fallback: emitDomainEvent(ev) — fire-and-forget через отдельный PrismaClient
 * (оставлено для мест, где транзакции пока нет).
 *
 * Логирование:
 * - в test не логируем
 * - в dev/prod логируем только если HUBEX_EVENTS_LOG=1
 */

const prisma = new PrismaClient();

function shouldLogEvents(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  return process.env.HUBEX_EVENTS_LOG === '1';
}

function toCreateData(ev: DomainEvent, createdAt: Date) {
  return {
    companyId: ev.companyId,
    entityType: ev.entityType,
    entityId: ev.entityId,
    type: ev.type,
    actorUserId: ev.actorUserId,
    payload: ev.payload ?? undefined,
    createdAt,
  };
}

/**
 * ✅ Правильный путь: писать DomainEvent внутри транзакции.
 */
export async function emitDomainEventTx(tx: Prisma.TransactionClient, ev: DomainEvent) {
  const createdAt = ev.createdAt ?? new Date();

  await tx.domainEvent.create({
    data: toCreateData(ev, createdAt),
  });

  if (shouldLogEvents()) {
    // eslint-disable-next-line no-console
    console.log('[domain_event]', { ...ev, createdAt: createdAt.toISOString() });
  }
}

/**
 * Fallback: fire-and-forget (НЕ атомарно с доменными изменениями).
 * Оставлено для совместимости, но в бизнес-операциях лучше всегда использовать emitDomainEventTx.
 */
export function emitDomainEvent(ev: DomainEvent) {
  const createdAt = ev.createdAt ?? new Date();

  prisma.domainEvent
    .create({
      data: toCreateData(ev, createdAt),
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[domain_event][write_failed]', err);
    });

  if (shouldLogEvents()) {
    // eslint-disable-next-line no-console
    console.log('[domain_event]', { ...ev, createdAt: createdAt.toISOString() });
  }
}
