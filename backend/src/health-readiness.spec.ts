/**
 * SMA-DB-READINESS-P1 — проверки готовности исполнением (issue #378).
 *
 * Каждое правило проверяется поведением: и чистая классификация, и сам
 * endpoint с подменённой Prisma. Отдельно закреплено, что в тело ответа не
 * попадают ни текст ошибки, ни строка подключения.
 */
import {
  DEFAULT_READINESS_TIMEOUT_MS,
  MAX_READINESS_TIMEOUT_MS,
  MIN_READINESS_TIMEOUT_MS,
  ReadinessTimeoutError,
  buildReadinessResponse,
  classifyProbeFailure,
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

function makeController(queryRaw: jest.Mock) {
  return new HealthController({ $queryRaw: queryRaw } as any)
}

describe('resolveReadinessTimeoutMs — таймаут всегда ограничен', () => {
  it('без настройки — значение по умолчанию', () => {
    expect(resolveReadinessTimeoutMs(undefined)).toBe(DEFAULT_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('   ')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
  })

  it('мусор и ноль не снимают ограничение', () => {
    expect(resolveReadinessTimeoutMs('abc')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('0')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('-5000')).toBe(DEFAULT_READINESS_TIMEOUT_MS)
  })

  it('слишком большое и слишком малое зажимаются', () => {
    expect(resolveReadinessTimeoutMs('999999')).toBe(MAX_READINESS_TIMEOUT_MS)
    expect(resolveReadinessTimeoutMs('1')).toBe(MIN_READINESS_TIMEOUT_MS)
  })

  it('разумное значение принимается как есть', () => {
    expect(resolveReadinessTimeoutMs('1500')).toBe(1500)
  })
})

describe('buildReadinessResponse — коды и тело', () => {
  it('база доступна → 200 ready', () => {
    const r = buildReadinessResponse({ kind: 'up', latencyMs: 7 })
    expect(r.httpStatus).toBe(200)
    expect(r.body).toEqual({ status: 'ready', database: 'up', latencyMs: 7 })
  })

  it('база недоступна → 503 not_ready', () => {
    const r = buildReadinessResponse({ kind: 'down' })
    expect(r.httpStatus).toBe(503)
    expect(r.body).toEqual({ status: 'not_ready', database: 'down' })
  })

  it('таймаут → 503 и видно, какой предел сработал', () => {
    const r = buildReadinessResponse({ kind: 'timeout', timeoutMs: 2000 })
    expect(r.httpStatus).toBe(503)
    expect(r.body).toEqual({ status: 'not_ready', database: 'timeout', timeoutMs: 2000 })
  })

  it('сбой никогда не даёт 200', () => {
    expect(buildReadinessResponse({ kind: 'down' }).httpStatus).not.toBe(200)
    expect(buildReadinessResponse({ kind: 'timeout', timeoutMs: 100 }).httpStatus).not.toBe(200)
  })
})

describe('classifyProbeFailure — без утечки текста', () => {
  it('таймаут распознаётся по маркеру', () => {
    expect(classifyProbeFailure(new ReadinessTimeoutError(2000))).toBe('timeout')
  })

  it('любая другая ошибка — недоступность', () => {
    expect(classifyProbeFailure(new Error('connect ECONNREFUSED 10.0.0.5:5432'))).toBe('down')
    expect(classifyProbeFailure('boom')).toBe('down')
    expect(classifyProbeFailure(null)).toBe('down')
  })
})

describe('GET /health — liveness не изменён', () => {
  it('отвечает ok без обращения к базе', () => {
    const queryRaw = jest.fn()
    const controller = makeController(queryRaw)

    expect(controller.ok()).toEqual({ status: 'ok' })
    // Совместимость: прежний контракт и ни одного запроса к базе.
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('отвечает ok даже когда база недоступна', async () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const controller = makeController(queryRaw)

    expect(controller.ok()).toEqual({ status: 'ok' })
    expect(queryRaw).not.toHaveBeenCalled()
  })
})

describe('GET /health/ready — readiness', () => {
  const savedTimeout = process.env.DB_READINESS_TIMEOUT_MS

  afterEach(() => {
    if (savedTimeout === undefined) delete process.env.DB_READINESS_TIMEOUT_MS
    else process.env.DB_READINESS_TIMEOUT_MS = savedTimeout
    jest.clearAllMocks()
  })

  it('база доступна → READY (200)', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '1': 1 }])
    const controller = makeController(queryRaw)
    const res = makeRes()

    const body = await controller.ready(res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(body.status).toBe('ready')
    expect(body.database).toBe('up')
    expect(typeof body.latencyMs).toBe('number')
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  it('база недоступна → NOT READY (503)', async () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'))
    const controller = makeController(queryRaw)
    const res = makeRes()

    const body = await controller.ready(res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(body).toEqual({ status: 'not_ready', database: 'down' })
  })

  it('таймаут базы → NOT READY (503), а не ожидание до бесконечности', async () => {
    process.env.DB_READINESS_TIMEOUT_MS = '100'
    // Запрос «висит» дольше таймаута.
    const queryRaw = jest.fn(
      () => new Promise((resolve) => setTimeout(() => resolve([{ '1': 1 }]), 1000)),
    )
    const controller = makeController(queryRaw as any)
    const res = makeRes()

    const startedAt = Date.now()
    const body = await controller.ready(res)
    const elapsed = Date.now() - startedAt

    expect(res.status).toHaveBeenCalledWith(503)
    expect(body.status).toBe('not_ready')
    expect(body.database).toBe('timeout')
    expect(body.timeoutMs).toBe(100)
    // Ответ пришёл по таймауту, а не после завершения запроса.
    expect(elapsed).toBeLessThan(900)
  })

  it('в ответе нет ни credentials, ни строки подключения, ни текста ошибки', async () => {
    const leaky = new Error(
      'Can\'t reach database server at postgres:5432 — user=sma_user password=SuperSecret db=sma_prod_db',
    )
    const queryRaw = jest.fn().mockRejectedValue(leaky)
    const controller = makeController(queryRaw)
    const res = makeRes()

    const body = await controller.ready(res)
    const serialized = JSON.stringify(body)

    for (const secret of ['SuperSecret', 'sma_user', 'password', 'postgres:5432', 'sma_prod_db']) {
      expect(serialized).not.toContain(secret)
    }
    // Наружу уходит только категория сбоя.
    expect(Object.keys(body).sort()).toEqual(['database', 'status'])
  })

  it('проверка не выполняет разрушительных операций: только чтение', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '1': 1 }])
    const controller = makeController(queryRaw)

    await controller.ready(makeRes())

    // Единственный запрос — SELECT 1 через $queryRaw; других методов нет.
    expect(queryRaw).toHaveBeenCalledTimes(1)
    const sql = JSON.stringify(queryRaw.mock.calls[0])
    expect(sql).toContain('SELECT 1')
    for (const forbidden of ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER']) {
      expect(sql.toUpperCase()).not.toContain(forbidden)
    }
  })

  it('частые обращения не создают лишней нагрузки на базу', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '1': 1 }])
    const controller = makeController(queryRaw)

    for (let i = 0; i < 20; i += 1) await controller.ready(makeRes())

    // Кэш на секунду: двадцать обращений — один запрос к базе.
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  it('ответ не кэшируется посредниками', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '1': 1 }])
    const controller = makeController(queryRaw)
    const res = makeRes()

    await controller.ready(res)

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })
})
