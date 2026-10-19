/**
 * SMA-DB-READINESS-P1 — разделение liveness и readiness (issue #378).
 *
 * Чистый модуль: ни Prisma, ни Nest, ни сети. Сюда вынесены решения о том,
 * что считать готовностью, какой отдавать код ответа и что именно попадает в
 * тело, — чтобы проверять это исполнением, а не чтением.
 *
 * Зачем вообще отдельная готовность. `/health` отвечает `{status:'ok'}`
 * безусловно и к базе не обращается. Это корректный liveness: процесс жив,
 * его не надо перезапускать. Но тот же `/health` используется как проверка
 * приёмки в канонических скиллах выкладки (sma-deploy-prod, sma-deploy-stage
 * ожидают 200), и значит выкладка проходила даже при недоступной базе.
 * `/health` не меняется — он остаётся дешёвым и нужен как liveness, —
 * а готовность получает отдельный маршрут.
 *
 * Тело ответа НИКОГДА не содержит текста ошибки, строки подключения, хоста,
 * имени базы и учётных данных: endpoint публичный, как и `/health`.
 *
 * ── Об отмене запроса (проверено исполнением на PostgreSQL 16) ─────────────
 *
 * Prisma 5.22 не предоставляет отмены: у возвращаемого PrismaPromise есть
 * только then/catch/finally/requestTransaction — ни cancel, ни abort, ни
 * signal. Поэтому `Promise.race` НЕ отменяет SQL: он лишь прекращает
 * ожидание, а запрос продолжает занимать соединение пула. Это и была причина
 * замечания аудита о накоплении зависших запросов.
 *
 * Реальная отмена есть на стороне сервера: `SET LOCAL statement_timeout`
 * внутри транзакции. Замер: pg_sleep(3) при statement_timeout = 200 мс
 * прерван через 213 мс с SQLSTATE 57014 (Prisma отдаёт P2010), и после
 * транзакции statement_timeout в соединении снова 0 — SET LOCAL ограничен
 * транзакцией и пул не загрязняет.
 *
 * Серверный таймаут действует с момента, когда сервер начал исполнять
 * оператор. Если до сервера дело не дошло — обрыв TCP, исчерпан пул, —
 * отменять нечего, и границу даёт клиентская гонка как подстраховка плюс
 * запрет запускать новый SQL поверх незавершённого (см. kind: 'stalled').
 */

/**
 * Таймаут проверки по умолчанию.
 *
 * Две секунды: проверка должна успеть ответить раньше, чем её оборвёт
 * probe-клиент, и при этом не висеть, когда база недоступна по сети.
 */
export const DEFAULT_READINESS_TIMEOUT_MS = 2000

/** Границы таймаута: ошибка в конфигурации не должна снимать ограничение. */
export const MIN_READINESS_TIMEOUT_MS = 100
export const MAX_READINESS_TIMEOUT_MS = 10_000

/**
 * Запас клиентской гонки над серверным таймаутом.
 *
 * Клиентская гонка — подстраховка, а не основной предел. Запас нужен, чтобы
 * в обычном случае успевал отработать серверный statement_timeout: тогда
 * запрос действительно отменён, соединение освобождено, и классификация
 * честная. Если гонка срабатывает раньше, мы знаем только то, что ответа
 * нет, а запрос, возможно, ещё исполняется.
 */
export const READINESS_RACE_GRACE_MS = 250

/**
 * Срок жизни кэша результата.
 *
 * Endpoint публичный, поэтому его можно опрашивать сколь угодно часто. Кэш на
 * секунду превращает любую частоту обращений в не более одного запроса к базе
 * в секунду — это и есть «без лишней нагрузки на базу». Цена — результат
 * может отставать от реальности не более чем на секунду, что для проверки
 * готовности несущественно.
 */
export const DEFAULT_READINESS_CACHE_MS = 1000

export type ProbeOutcome =
  | { kind: 'up'; latencyMs: number }
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'down' }
  /**
   * Предыдущая проверка ещё не завершилась.
   *
   * Новый SQL поверх незавершённого не запускается — иначе зависшая база
   * набирала бы запросы с каждой проверкой и исчерпала пул соединений.
   * Это не «готов» и не «неизвестно»: для вызывающего — 503.
   */
  | { kind: 'stalled' }

export type ReadinessBody = {
  status: 'ready' | 'not_ready'
  database: 'up' | 'down' | 'timeout' | 'stalled'
  /** Задержка проверки в миллисекундах. Только при успехе. */
  latencyMs?: number
  /** Какой таймаут был применён. Только при его срабатывании. */
  timeoutMs?: number
}

export type ReadinessResponse = {
  /** 200 — готов, 503 — не готов. Иной код не предусмотрен. */
  httpStatus: 200 | 503
  body: ReadinessBody
}

/**
 * Привести таймаут из конфигурации к допустимому.
 *
 * Непарсящееся значение, ноль, отрицательное и отсутствующее дают значение по
 * умолчанию; слишком большое и слишком малое — зажимаются. Неограниченного
 * таймаута получить нельзя ни при какой конфигурации. Результат всегда целое
 * число: он подставляется в SET LOCAL statement_timeout.
 */
export function resolveReadinessTimeoutMs(raw: string | undefined): number {
  const parsed = Number.parseInt((raw || '').trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_READINESS_TIMEOUT_MS
  if (parsed < MIN_READINESS_TIMEOUT_MS) return MIN_READINESS_TIMEOUT_MS
  if (parsed > MAX_READINESS_TIMEOUT_MS) return MAX_READINESS_TIMEOUT_MS
  return parsed
}

/**
 * Ответ по результату проверки.
 *
 * Недоступность, таймаут и незавершённая предыдущая проверка различаются в
 * поле `database`, но все дают 503: для probe-клиента это одинаково «не
 * готов», а различие нужно дежурному, чтобы понимать, что происходит.
 */
export function buildReadinessResponse(outcome: ProbeOutcome): ReadinessResponse {
  if (outcome.kind === 'up') {
    return {
      httpStatus: 200,
      body: { status: 'ready', database: 'up', latencyMs: outcome.latencyMs },
    }
  }

  if (outcome.kind === 'timeout') {
    return {
      httpStatus: 503,
      body: { status: 'not_ready', database: 'timeout', timeoutMs: outcome.timeoutMs },
    }
  }

  if (outcome.kind === 'stalled') {
    return { httpStatus: 503, body: { status: 'not_ready', database: 'stalled' } }
  }

  return { httpStatus: 503, body: { status: 'not_ready', database: 'down' } }
}

/** SQLSTATE отмены оператора сервером по statement_timeout. */
export const PG_QUERY_CANCELED = '57014'

/**
 * Отменил ли оператор сам сервер по нашему statement_timeout.
 *
 * Prisma оборачивает это в P2010 и кладёт исходный код в meta.code.
 * Проверяется и вложенный код, и строковое представление: форма ошибки
 * зависит от драйвера, а пропустить этот случай значит назвать отменённый
 * по таймауту запрос недоступностью базы.
 */
export function isServerStatementTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const meta = (error as { meta?: { code?: unknown } }).meta
  if (meta && typeof meta === 'object' && String((meta as { code?: unknown }).code) === PG_QUERY_CANCELED) {
    return true
  }
  const code = (error as { code?: unknown }).code
  return String(code) === PG_QUERY_CANCELED
}

/**
 * Классифицировать сбой проверки.
 *
 * Текст ошибки сюда не попадает и наружу не уходит: сообщения драйвера и
 * Prisma содержат хост, имя базы, а иногда и пользователя. Наружу уходит
 * только категория.
 */
export function classifyProbeFailure(error: unknown): 'timeout' | 'down' {
  if (
    error &&
    typeof error === 'object' &&
    (error as { isReadinessTimeout?: unknown }).isReadinessTimeout === true
  ) {
    return 'timeout'
  }
  // Сервер отменил оператор по нашему же пределу — это таймаут, не отказ базы.
  if (isServerStatementTimeout(error)) return 'timeout'
  return 'down'
}

/** Маркер клиентской гонки. Наружу не отдаётся, нужен только для классификации. */
export class ReadinessTimeoutError extends Error {
  readonly isReadinessTimeout = true

  constructor(readonly timeoutMs: number) {
    super('readiness probe timed out')
    this.name = 'ReadinessTimeoutError'
  }
}
