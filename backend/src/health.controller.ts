import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { PrismaService } from './prisma/prisma.service';
import {
  DEFAULT_READINESS_CACHE_MS,
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
    const outcome = await this.probeWithCache();
    const response = buildReadinessResponse(outcome);
    res.status(response.httpStatus);
    /*
     * Готовность не кэшируется посредниками: устаревший ответ здесь хуже
     * отсутствия ответа.
     */
    res.setHeader('Cache-Control', 'no-store');
    return response.body;
  }

  private async probeWithCache(): Promise<ProbeOutcome> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < DEFAULT_READINESS_CACHE_MS) {
      return this.cached.outcome;
    }

    const outcome = await this.probeDatabase();
    this.cached = { at: Date.now(), outcome };
    return outcome;
  }

  /**
   * Одна дешёвая проверка связи с ограничением по времени.
   *
   * `SELECT 1` — чтение, ничего не создаёт и не изменяет; это самый дешёвый
   * способ убедиться, что соединение живо и база отвечает. Ограничение по
   * времени обязательно: без него недоступная по сети база заставила бы
   * проверку висеть до таймаута драйвера.
   */
  private async probeDatabase(): Promise<ProbeOutcome> {
    const timeoutMs = resolveReadinessTimeoutMs(process.env.DB_READINESS_TIMEOUT_MS);
    const startedAt = Date.now();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new ReadinessTimeoutError(timeoutMs)), timeoutMs);
    });

    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return { kind: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return classifyProbeFailure(error) === 'timeout'
        ? { kind: 'timeout', timeoutMs }
        : { kind: 'down' };
    } finally {
      // Иначе процесс держал бы висящий таймер после быстрого успеха.
      if (timer) clearTimeout(timer);
    }
  }
}
