import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { IdempotencyRecordStatus, Prisma } from '@prisma/client'
import { createHash } from 'crypto'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * SMA-OFFLINE-IDEMPOTENCY-113B — make append-style endpoints safe to retry.
 *
 * The failure this exists for is ordinary on a mobile link, not exotic: the request reaches the
 * server, the server commits, and the response is lost on the way back. The client cannot tell
 * that apart from "never arrived", so it retries — and an append endpoint writes a second
 * comment, or stores a second copy of a photo.
 *
 * The contract is deliberately narrow. A caller wraps its domain write in `run()` with a stable
 * key and a fingerprint of the operation's inputs. The first call executes and records what it
 * produced; a replay with the same key and fingerprint returns that same result without
 * touching the domain; a replay with a *different* fingerprint is a client bug and is refused
 * rather than guessed at.
 *
 * What this does NOT do, on purpose: it is not an access check and never substitutes for one.
 * Callers run their normal permission and tenant resolution before reaching here, so a replayed
 * key cannot be used to reach data the caller has since lost access to.
 */

/** How long a record is worth keeping. Beyond this no client could still be retrying. */
const RETENTION_HOURS = 72

/**
 * How long an IN_PROGRESS record may sit before another attempt may take it over. Covers the
 * case where the process died between writing a file and committing the row.
 */
const STALE_TAKEOVER_MS = 2 * 60 * 1000

export type IdempotencyOutcome<T> = {
  result: T
  /** false when the stored result of an earlier identical call was returned instead. */
  executed: boolean
}

export type IdempotencyScope = {
  companyId: string
  userId: string
  operationType: string
  key: string
}

export type IdempotencyExecuteContext = {
  /**
   * Records a binary as soon as it exists, before the domain row is committed. A retry after a
   * crash in that window can then find and clean the orphan instead of storing a second copy.
   */
  noteStorageKey: (storageKey: string) => Promise<void>
}

export type IdempotencyHandlers<T> = {
  /** Performs the real domain write. Runs at most once per key. */
  execute: (ctx: IdempotencyExecuteContext) => Promise<{ result: T; entityType: string; entityId: string }>
  /** Re-reads the earlier result. Returning null means it has since been deleted. */
  replay: (entityId: string) => Promise<T | null>
  /** Optional cleanup of a binary left behind by an attempt that died mid-write. */
  discardOrphan?: (storageKey: string) => Promise<void>
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stable hash of whatever identifies this operation. Never stores the values themselves. */
  static fingerprint(input: unknown): string {
    return createHash('sha256').update(canonicalize(input)).digest('hex')
  }

  /** Normalises a client-supplied key; absent or blank means "no idempotency requested". */
  static normalizeKey(value?: string | null): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.length > 200) throw new BadRequestException('Idempotency-Key is too long')
    return trimmed
  }

  async run<T>(
    scope: IdempotencyScope,
    fingerprint: string,
    handlers: IdempotencyHandlers<T>,
  ): Promise<IdempotencyOutcome<T>> {
    const where = {
      companyId_userId_operationType_key: {
        companyId: scope.companyId,
        userId: scope.userId,
        operationType: scope.operationType,
        key: scope.key,
      },
    }

    let claimed = false
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          companyId: scope.companyId,
          userId: scope.userId,
          operationType: scope.operationType,
          key: scope.key,
          fingerprint,
          status: IdempotencyRecordStatus.IN_PROGRESS,
          expiresAt: new Date(Date.now() + RETENTION_HOURS * 3600 * 1000),
        },
      })
      claimed = true
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      // Someone else holds this key: either finished, still running, or died mid-flight.
    }

    if (!claimed) {
      const existing = await this.prisma.idempotencyRecord.findUnique({ where })
      if (!existing) {
        // Expired and swept between our insert and this read. Nothing to reuse; run again.
        return this.executeAndComplete(where, scope, fingerprint, handlers)
      }

      if (existing.fingerprint !== fingerprint) {
        // Same key, different operation. Guessing which one the client meant would be worse
        // than refusing: one of the two writes would silently not happen.
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          message: 'Этот ключ уже использован для другой операции.',
        })
      }

      if (existing.status === IdempotencyRecordStatus.COMPLETED && existing.resultEntityId) {
        const replayed = await handlers.replay(existing.resultEntityId)
        if (replayed !== null) return { result: replayed, executed: false }
        // The entity was deleted after the fact. Report rather than silently recreating it.
        throw new ConflictException({
          code: 'IDEMPOTENCY_RESULT_GONE',
          message: 'Результат предыдущей операции больше не существует.',
        })
      }

      const age = Date.now() - existing.updatedAt.getTime()
      if (age < STALE_TAKEOVER_MS) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message: 'Операция уже выполняется. Повторите позже.',
        })
      }

      // Stale: the previous attempt died. Clean anything it left behind, then take it over.
      if (existing.storageKey && handlers.discardOrphan) {
        await handlers.discardOrphan(existing.storageKey).catch(() => undefined)
      }
      await this.prisma.idempotencyRecord.update({
        where,
        data: { status: IdempotencyRecordStatus.IN_PROGRESS, storageKey: null, updatedAt: new Date() },
      })
    }

    return this.executeAndComplete(where, scope, fingerprint, handlers)
  }

  private async executeAndComplete<T>(
    where: Prisma.IdempotencyRecordWhereUniqueInput,
    scope: IdempotencyScope,
    fingerprint: string,
    handlers: IdempotencyHandlers<T>,
  ): Promise<IdempotencyOutcome<T>> {
    const ctx: IdempotencyExecuteContext = {
      noteStorageKey: async (storageKey: string) => {
        await this.prisma.idempotencyRecord
          .update({ where, data: { storageKey } })
          .catch(() => undefined)
      },
    }

    try {
      const { result, entityType, entityId } = await handlers.execute(ctx)
      await this.prisma.idempotencyRecord.update({
        where,
        data: {
          status: IdempotencyRecordStatus.COMPLETED,
          resultEntityType: entityType,
          resultEntityId: entityId,
          completedAt: new Date(),
        },
      })
      return { result, executed: true }
    } catch (error) {
      /**
       * The domain write failed, so this key was never consumed. Releasing the record lets the
       * client retry the same key; keeping it would strand the operation forever behind an
       * IN_PROGRESS that nothing will ever complete.
       */
      await this.prisma.idempotencyRecord.delete({ where }).catch(() => undefined)
      throw error
    }
  }

  /** Retention sweep. Safe to call repeatedly; deletes only records past their horizon. */
  async purgeExpired(now = new Date()): Promise<number> {
    const { count } = await this.prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: now } },
    })
    return count
  }
}

/** Key-order-independent serialisation, so an equivalent body hashes the same. */
function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
