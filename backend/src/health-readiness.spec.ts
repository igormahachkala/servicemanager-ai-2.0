/**
 * SMA-DB-READINESS-P1 — проверки готовности исполнением (issue #378).
 *
 * После замечаний аудита здесь закреплены три свойства, которых прежняя
 * редакция не проверяла:
 *
 *  - single-flight: одновременные запросы дают ОДИН запрос к базе. Прежний
 *    тест ждал каждый вызов по очереди и поэтому проходил на дефекте, когда
 *    кэш заполнялся только после завершения проверки;
 *  - зависший запрос не влечёт новых SQL поверх себя;
 *  - восстановление после сбоя.
 */
import {
  DEFAULT_READINESS_TIMEOUT_MS,
  MAX_READINESS_TIMEOUT_MS,
  MIN_READINESS_TIMEOUT_MS,
  PG_QUERY_CANCELED,
  READINESS_RACE_GRACE_MS,
  ReadinessTimeoutError,
  buildReadinessResponse,
  classifyProbeFailure,
  isServerStatementTimeout,
  resolveReadinessTimeoutMs,
} from './health-readiness'
import { HealthController } from './health.controller'

function makeRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    status: jest.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    setHeader: jest.fn((name: string, value: string) => {
      res.headers[name] = value
      return res
    }),
  }
  return res
}

/**
 * Контроллер с подменённой Prisma.
 *
 * `transaction` — сценарий поведения базы: именно его вызовов должно быть
 * ровно столько, сколько раз реально пошёл SQL.
 */
function makeController(transaction: jest.Mock) {
  const prisma = {
    $transaction: transaction,
    $executeRawUnsafe: jest.fn((sql: string) => sql),
    $queryRaw: jest.fn(() => 'SELECT 1'),
  }
  return { controller: new HealthController(prisma as any), prisma }
}

/** Промис, которым управляет тест. */
function deferred<T = unknown>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const savedTimeout = process.env.DB_READINESS_TIMEOUT_MS

afterEach(() => {
  if (savedTimeout === undefined) delete process.env.DB_READINESS_TIMEOUT_MS
  else process.env.DB_READINESS_TIMEOUT_MS = savedTimeout
  jest.clearAllMocks()
})

describe('resolveReadinessTimeoutMs — таймаут всегда ограничен', () => {
  it('без настройки — значение по умолчанию', () => {
    expect(resolveReadinessTimeoutMs(undefined)).toBe(DEFAULT_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
  })

  it('мусор, ноль и отрицательное не снимают ограничение', () => {
    expect(resolveReadinessTimeoutMs('abc')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('0')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('-5000')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
  })

  it('выход за границы зажимается', () => {
    expect(resolveReadinessTimeoutMs('999999')).toBe(MAX_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('1')).toBe(MIN_READINESS_TIMEOUT_MS)
  })

  it('результат всегда целое — он подставляется в SET LOCAL', () => {
    for (const raw of ['1500', '2000.7', 'abc', '99999']) {
      expect(Number.isInteger(resolveReadinessTimeoutMs(raw))).toBe(true)
    }
  })
})

describe('buildReadinessResponse — коды и тело', () => {
  it('база доступна → 200 ready', () => {
    expect(buildReadinessResponse({ kind: 'up', latencyMs: 7 })).toEqual({
      httpStatus: 200,
      body: { status: 'ready', database: 'up', latencyMs: 7 },
    })
  })

  it('недоступна → 503, таймаут → 503, зависла → 503', () => {
    expect(buildReadinessResponse({ kind: 'down' }).httpStatus).toBe(503)
    expect(buildReadinessResponse({ kind: 'timeout', timeoutMs: 2000 }).httpStatus).toBe(503)
    expect(buildReadinessResponse({ kind: 'stalled' }).httpStatus).toBe(503)
  })

  it('ложного READY не бывает ни в одном сбойном состоянии', () => {
    for (const outcome of [
      { kind: 'down' } as const,
      { kind: 'timeout', timeoutMs: 100 } as const,
      { kind: 'stalled' } as const,
    ]) {
      const r = buildReadinessResponse(outcome)
      expect(r.httpStatus).not.toBe(200)
      expect(r.body.status).toBe('not_ready')
      expect(r.body.database).not.toBe('up')
    }
  })
})

describe('классификация сбоя — без утечки текста', () => {
  it('клиентская гонка — таймаут', () => {
    expect(classifyProbeFailure(new ReadinessTimeoutError(2000))).toBe('timeout')
  })

  it('отмена сервером по statement_timeout — тоже таймаут, а не отказ базы', () => {
    const prismaError = Object.assign(new Error('Raw query failed'), {
      code: 'P2010',
      meta: { code: PG_QUERY_CANCELED, message: 'ERROR: canceling statement due to statement timeout' },
    })
    expect(isServerStatementTimeout(prismaError)).toBe(true)
    expect(classifyProbeFailure(prismaError)).toBe('timeout')
  })

  it('прямой SQLSTATE без meta тоже распознаётся', () => {
    expect(isServerStatementTimeout({ code: PG_QUERY_CANCELED })).toBe(true)
  })

  it('любая другая ошибка — недоступность', () => {
    expect(classifyProbeFailure(new Error('connect ECONNREFUSED 10.0.0.5:5432'))).toBe('down')
    expect(classifyProbeFailure('boom')).toBe('down')
    expect(classifyProbeFailure(null)).toBe('down')
    expect(isServerStatementTimeout(new Error('x'))).toBe(false)
  })
})

describe('GET /health — liveness не изменён', () => {
  it('отвечает ok без обращения к базе', () => {
    const transaction = jest.fn()
    const { controller } = makeController(transaction)

    expect(controller.ok()).toEqual({ status: 'ok' })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('отвечает ok даже когда база недоступна', () => {
    const transaction = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const { controller } = makeController(transaction)

    expect(controller.ok()).toEqual({ status: 'ok' })
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe('GET /health/ready — основные состояния', () => {
  it('доступная БД → 200', async () => {
    const transaction = jest.fn().mockResolvedValue([0, [{ '1': 1 }]])
    const { controller } = makeController(transaction)
    const res = makeRes()

    const body = await controller.ready(res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(body.status).toBe('ready')
    expect(body.database).toBe('up')
    expect(typeof body.latencyMs).toBe('number')
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it('недоступная БД → 503', async () => {
    const transaction = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'))
    const { controller } = makeController(transaction)
    const res = makeRes()

    const body = await controller.ready(res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(body).toEqual({ status: 'not_ready', database: 'down' })
  })

  it('timeout → 503', async () => {
    process.env.DB_READINESS_TIMEOUT_MS = '100'
    // Сервер отменил оператор по нашему же statement_timeout.
    const transaction = jest.fn().mockRejectedValue(
      Object.assign(new Error('Raw query failed'), {
        code: 'P2010',
        meta: { code: PG_QUERY_CANCELED },
      }),
    )
    const { controller } = makeController(transaction)
    const res = makeRes()

    const body = await controller.ready(res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(body.database).toBe('timeout')
    expect(body.timeoutMs).toBe(100)
  })

  it('клиентская гонка срабатывает, если сервер не ответил вовсе', async () => {
    process.env.DB_READINESS_TIMEOUT_MS = '100'
    const hung = deferred()
    const transaction = jest.fn(() => hung.promise)
    const { controller } = makeController(transaction as any)
    const res = makeRes()

    const startedAt = Date.now()
    const body = await controller.ready(res)
    const elapsed = Date.now() - startedAt

    expect(res.status).toHaveBeenCalledWith(503)
    expect(body.database).toBe('timeout')
    // Ответ по гонке, с запасом над серверным пределом, а не ожидание запроса.
    expect(elapsed).toBeGreaterThanOrEqual(100)
    expect(elapsed).toBeLessThan(100 + READINESS_RACE_GRACE_MS + 400)

    hung.resolve([0, [{ '1': 1 }]])
  })

  it('серверный statement_timeout задаётся в транзакции и равен пределу', async () => {
    process.env.DB_READINESS_TIMEOUT_MS = '1500'
    const transaction = jest.fn().mockResolvedValue([0, [{ '1': 1 }]])
    const { controller, prisma } = makeController(transaction)

    await controller.ready(makeRes())

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL statement_timeout = 1500')
  })

  it('проверка только читает', async () => {
    const transaction = jest.fn().mockResolvedValue([0, [{ '1': 1 }]])
    const { controller, prisma } = makeController(transaction)

    await controller.ready(makeRes())

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sql = JSON.stringify(prisma.$queryRaw.mock.calls).toUpperCase()
    expect(sql).toContain('SELECT 1')
    for (const forbidden of ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER']) {
      expect(sql).not.toContain(forbidden)
    }
  })

  it('ответ не кэшируется посредниками', async () => {
    const transaction = jest.fn().mockResolvedValue([0, [{ '1': 1 }]])
    const { controller } = makeController(transaction)
    const res = makeRes()

    await controller.ready(res)

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })
})

describe('single-flight: одновременные запросы не множат SQL', () => {
  it('20 ПАРАЛЛЕЛЬНЫХ запросов → один запрос к базе', async () => {
    const gate = deferred()
    const transaction = jest.fn(() => gate.promise)
    const { controller } = makeController(transaction as any)

    // Все двадцать стартуют до того, как первый успел завершиться.
    const calls = Array.from({ length: 20 }, () => controller.ready(makeRes()))
    gate.resolve([0, [{ '1': 1 }]])
    const bodies = await Promise.all(calls)

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(bodies).toHaveLength(20)
    for (const body of bodies) {
      expect(body.status).toBe('ready')
      expect(body.database).toBe('up')
    }
  })

  it('20 параллельных запросов при недоступной базе → один запрос и ни одного READY', async () => {
    const gate = deferred()
    const transaction = jest.fn(() => gate.promise)
    const { controller } = makeController(transaction as any)

    const calls = Array.from({ length: 20 }, () => controller.ready(makeRes()))
    gate.reject(new Error('ECONNREFUSED'))
    const bodies = await Promise.all(calls)

    expect(transaction).toHaveBeenCalledTimes(1)
    for (const body of bodies) {
      expect(body.status).toBe('not_ready')
      expect(body.database).not.toBe('up')
    }
  })

  it('последовательные обращения в пределах кэша тоже дают один запрос', async () => {
    const transaction = jest.fn().mockResolvedValue([0, [{ '1': 1 }]])
    const { controller } = makeController(transaction)

    for (let i = 0; i < 20; i += 1) await controller.ready(makeRes())

    expect(transaction).toHaveBeenCalledTimes(1)
  })
})

describe('зависший запрос не накапливает SQL', () => {
  it('пока предыдущий SQL не завершился, новый не запускается', async () => {
    process.env.DB_READINESS_TIMEOUT_MS = '100'
    const hung = deferred()
    const transaction = jest.fn(() => hung.promise)
    const { controller } = makeController(transaction as any)

    // Первая проверка: гонка истекает, запрос продолжает «висеть».
    const first = await controller.ready(makeRes())
    expect(first.database).toBe('timeout')
    expect(transaction).toHaveBeenCalledTimes(1)

    /*
     * Обращаемся напрямую к проверке, минуя кэш: нас интересует именно
     * поведение при незавершённом запросе, а не срок жизни кэша.
     */
    for (let i = 0; i < 5; i += 1) {
      const outcome = await (controller as any).probeDatabase()
      expect(outcome.kind).toBe('stalled')
    }

    // Ни одного нового SQL поверх зависшего.
    expect(transaction).toHaveBeenCalledTimes(1)

    hung.resolve([0, [{ '1': 1 }]])
  })

  it('зависший запрос никогда не даёт READY', async () => {
    process.env.DB_READINESS_TIMEOUT_MS = '100'
    const hung = deferred()
    const transaction = jest.fn(() => hung.promise)
    const { controller } = makeController(transaction as any)

    await controller.ready(makeRes())
    const res = makeRes()
    const outcome = await (controller as any).probeDatabase()
    const body = buildReadinessResponse(outcome)

    expect(body.httpStatus).toBe(503)
    expect(body.body.database).toBe('stalled')
    expect(res.statusCode).not.toBe(503) // res не использовался — проверка прямая

    hung.resolve([0, [{ '1': 1 }]])
  })

  it('после завершения зависшего запроса проверки снова идут', async () => {
    process.env.DB_READINESS_TIMEOUT_MS = '100'
    const hung = deferred()
    const transaction = jest.fn(() => hung.promise)
    const { controller } = makeController(transaction as any)

    await controller.ready(makeRes())
    expect((await (controller as any).probeDatabase()).kind).toBe('stalled')

    // Запрос наконец завершился — блокировка снимается.
    hung.resolve([0, [{ '1': 1 }]])
    await new Promise((resolve) => setTimeout(resolve, 10))

    transaction.mockResolvedValue([0, [{ '1': 1 }]])
    const outcome = await (controller as any).probeDatabase()
    expect(outcome.kind).toBe('up')
    expect(transaction).toHaveBeenCalledTimes(2)
  })
})

describe('восстановление после ошибки', () => {
  it('после недоступности следующая проверка возвращает READY', async () => {
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue([0, [{ '1': 1 }]])
    const { controller } = makeController(transaction)

    const first = await (controller as any).probeDatabase()
    expect(first.kind).toBe('down')

    const second = await (controller as any).probeDatabase()
    expect(second.kind).toBe('up')
    expect(transaction).toHaveBeenCalledTimes(2)
  })

  it('сбой не оставляет проверку заблокированной навсегда', async () => {
    const transaction = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const { controller } = makeController(transaction)

    for (let i = 0; i < 3; i += 1) {
      const outcome = await (controller as any).probeDatabase()
      // Именно 'down', а не 'stalled': отклонённый запрос считается завершённым.
      expect(outcome.kind).toBe('down')
    }
    expect(transaction).toHaveBeenCalledTimes(3)
  })
})

describe('отсутствие утечки credentials', () => {
  it('в ответе нет пароля, пользователя, хоста и имени базы', async () => {
    const leaky = new Error(
      "Can't reach database server at postgres:5432 — user=sma_user password=SuperSecret db=sma_prod_db",
    )
    const transaction = jest.fn().mockRejectedValue(leaky)
    const { controller } = makeController(transaction)

    const body = await controller.ready(makeRes())
    const serialized = JSON.stringify(body)

    for (const secret of ['SuperSecret', 'sma_user', 'password', 'postgres:5432', 'sma_prod_db']) {
      expect(serialized).not.toContain(secret)
    }
    expect(Object.keys(body).sort()).toEqual(['database', 'status'])
  })

  it('ошибка отмены сервером тоже не раскрывает деталей', async () => {
    process.env.DB_READINESS_TIMEOUT_MS = '100'
    const transaction = jest.fn().mockRejectedValue(
      Object.assign(new Error('Raw query failed. Code: `57014`. Message: db=sma_prod_db'), {
        code: 'P2010',
        meta: { code: PG_QUERY_CANCELED, message: 'db=sma_prod_db user=sma_user' },
      }),
    )
    const { controller } = makeController(transaction)

    const body = await controller.ready(makeRes())
    const serialized = JSON.stringify(body)

    expect(serialized).not.toContain('sma_prod_db')
    expect(serialized).not.toContain('sma_user')
    expect(body.database).toBe('timeout')
  })
})
