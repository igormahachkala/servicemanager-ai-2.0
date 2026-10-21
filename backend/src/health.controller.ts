import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { PrismaService } from './prisma/prisma.service';
import {
  DEFAULT_READINESS_CACHE_MS,
  READINESS_RACE_GRACE_MS,
  ReadinessTimeoutError,
  buildReadinessResponse,
  classifyProbeFailure,
  resolveReadinessTimeoutMs,
  type ProbeOutcome,
  type ReadinessBody,
} from './health-readiness';

@Controller('health')
export class HealthController {
  /** Кэш результата проверки: см. DEFAULT_READINESS_CACHE_MS. */
  private cached: { at: number; outcome: ProbeOutcome } | null = null;

  /**
   * Текущая выполняющаяся проверка (single-flight).
   *
   * Присваивается СИНХРОННО, до первого await, иначе одновременные запросы
   * успели бы проскочить мимо и каждый запустил бы свой SQL. Именно это и
   * было замечанием аудита: кэш заполнялся только после завершения проверки,
   * поэтому двадцать параллельных запросов давали двадцать запросов к базе.
   */
  private inFlight: Promise<ProbeOutcome> | null = null;

  /**
   * Незавершённый SQL предыдущей проверки.
   *
   * Живёт дольше, чем inFlight: клиентская гонка могла уже вернуть ответ, а
   * сам запрос ещё исполняться. Пока он не завершился, новый SQL не
   * запускается — так зависшая база не набирает запросы и не исчерпывает пул.
   */
  private pendingQuery: Promise<unknown> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness. Не изменён намеренно.
   *
   * Процесс жив — перезапускать нечего. К базе не обращается, поэтому остаётся
   * дешёвым и не падает из-за внешней зависимости. На этот маршрут опираются
   * канонические скиллы выкладки, и его контракт менять нельзя.
   */
  @Get()
  ok() {
    return { status: 'ok' };
  }

  /**
   * Readiness: готово ли приложение обслуживать запросы, то есть доступна ли
   * PostgreSQL.
   *
   * 200 — готов, 503 — нет. Тело не содержит ни текста ошибки, ни строки
   * подключения, ни имени базы: endpoint публичный, как и liveness.
   */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessBody> {
    const outcome = await this.probeOnce();
    const response = buildReadinessResponse(outcome);
    res.status(response.httpStatus);
    /*
     * Готовность не кэшируется посредниками: устаревший ответ здесь хуже
     * отсутствия ответа.
     */
    res.setHeader('Cache-Control', 'no-store');
    return response.body;
  }

  /**
   * Свежий кэш → отдать; идёт проверка → присоединиться к ней; иначе →
   * запустить одну.
   *
   * Ни одна ветка не содержит await до присваивания inFlight, поэтому
   * одновременные вызовы гарантированно видят одну и ту же проверку.
   */
  private probeOnce(): Promise<ProbeOutcome> {
    const cached = this.cached;
    if (cached && Date.now() - cached.at < DEFAULT_READINESS_CACHE_MS) {
      return Promise.resolve(cached.outcome);
    }

    if (this.inFlight) return this.inFlight;

    const run = this.probeDatabase()
      .then((outcome) => {
        this.cached = { at: Date.now(), outcome };
        return outcome;
      })
      .finally(() => {
        this.inFlight = null;
      });

    this.inFlight = run;
    return run;
  }

  /**
   * Одна дешёвая проверка связи с двумя независимыми границами.
   *
   * 1. Серверная, основная: `SET LOCAL statement_timeout` внутри транзакции.
   *    Это настоящая отмена — PostgreSQL прерывает оператор сам и освобождает
   *    соединение (SQLSTATE 57014). SET LOCAL ограничен транзакцией, поэтому
   *    значение не протекает в пул.
   * 2. Клиентская, подстраховочная: гонка с запасом над серверным пределом.
   *    Нужна там, где серверный таймаут бессилен — обрыв TCP, исчерпанный
   *    пул, то есть когда сервер оператор ещё не начал. Отменой НЕ является:
   *    Prisma 5.22 отмены не предоставляет вовсе.
   *
   * `SELECT 1` — чтение, ничего не создаёт и не изменяет.
   */
  private async probeDatabase(): Promise<ProbeOutcome> {
    const timeoutMs = resolveReadinessTimeoutMs(process.env.DB_READINESS_TIMEOUT_MS);

    /*
     * Предыдущий запрос ещё не завершился: не запускаем новый поверх него.
     * Fail-closed — 503, а не «готов» и не ожидание неизвестной длительности.
     */
    if (this.pendingQuery) return { kind: 'stalled' };

    /*
     * Значение подставляется в SQL, поэтому проверяется как целое. Источник —
     * resolveReadinessTimeoutMs, который уже зажимает диапазон; проверка
     * оставлена как barrier: параметризовать SET LOCAL нельзя.
     */
    if (!Number.isInteger(timeoutMs)) return { kind: 'down' };

    const startedAt = Date.now();

    const query = this.prisma
      .$transaction([
        this.prisma.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeoutMs}`),
        this.prisma.$queryRaw`SELECT 1`,
      ])
      .finally(() => {
        // Снимается только когда SQL действительно завершился, а не когда истекла гонка.
        this.pendingQuery = null;
      });

    this.pendingQuery = query;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const race = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new ReadinessTimeoutError(timeoutMs)),
        timeoutMs + READINESS_RACE_GRACE_MS,
      );
    });

    try {
      await Promise.race([query, race]);
      return { kind: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return classifyProbeFailure(error) === 'timeout'
        ? { kind: 'timeout', timeoutMs }
        : { kind: 'down' };
    } finally {
      // Иначе процесс держал бы висящий таймер после быстрого успеха.
      if (timer) clearTimeout(timer);
      /*
       * Отказ брошенного запроса не должен всплывать как unhandledRejection:
       * гонка могла уже вернуть ответ, и тогда никто этот промис не ждёт.
       */
      void Promise.resolve(query).catch(() => undefined);
    }
  }
}
