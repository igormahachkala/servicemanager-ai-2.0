/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113C.
 *
 * Координатор синхронизации. Ровно один на приложение.
 *
 * Почему это отдельная забота, а не «просто цикл по очереди»: событие `online`
 * приходит пачками. Браузер шлёт его при смене сети, при выходе из сна, при
 * переподключении сокета 112A. Если на каждое запускать обработчик, одна и та
 * же строка уйдёт на сервер дважды. Ключ идемпотентности 113B защитит от дубля
 * в базе, но не от гонки за состояние строки и не от лишнего трафика с фото.
 * Поэтому единственность обеспечивается здесь, до сети.
 *
 * Единственность двухуровневая: флаг в модуле закрывает повторный запуск
 * внутри вкладки, Web Locks (когда есть) — между вкладками. Второй уровень
 * нужен, потому что техник открывает /m и в браузере, и как PWA.
 *
 * Отправкой занимается переданный транспорт. Своего HTTP-клиента здесь нет,
 * как нет и второго менеджера сокета: realtime остаётся за 112A.
 */

import type { OfflineStore } from './store.js'
import {
  classifySyncFailure,
  queueItemOwner,
  DRAIN_CANCELLED_REASON,
  NO_IDENTITY_REASON,
  OWNER_MISMATCH_REASON,
  type OfflineQueueItem,
  type SyncOutcome,
} from './types.js'
import { isLocalId } from './store.js'

export type SyncTransport = {
  /**
   * Отправка одной операции. Реализация обязана передать ключ
   * идемпотентности заголовком `Idempotency-Key` (контракт 113B).
   */
  send(item: OfflineQueueItem, ctx: { blob: Blob | null; ticketId?: string }): Promise<SyncOutcome>
}

export type SyncReport = {
  processed: number
  synced: number
  failed: number
  attention: number
  skipped: number
  /** true, если запуск отклонён: обработчик уже идёт. */
  alreadyRunning?: boolean
  /**
   * 005: круг оборван до сети. Строки остались нетронутыми — ни одна не ушла
   * и ни одна не удалена. Причина по-русски, её показывает интерфейс.
   */
  stoppedReason?: string
}

/**
 * SMA-OFFLINE-QUEUE-OWNER-IDENTITY-HARDENING-005.
 *
 * Кто предъявляется серверу прямо сейчас — в виде `companyId:userId`.
 *
 * Значение берётся из того же токена, которым уйдёт запрос, поэтому сверка
 * «чья работа» и «от чьего имени отправляем» смотрит на одно и то же.
 * `null` означает «личности нет»: без сессии отправлять не от кого.
 *
 * Резолвер асинхронный намеренно: слой очереди собирается отдельным узким
 * tsconfig и подключает `lib/api` лениво — как это уже делает транспорт.
 */
export type LiveIdentityResolver = () => Promise<string | null> | string | null

/** Сколько раз пытаемся автоматически, прежде чем показать «Ошибка отправки». */
const MAX_AUTO_ATTEMPTS = 5

export type SyncCoordinatorOptions = {
  lockName?: string
  useWebLocks?: boolean
  /**
   * 005: личность, предъявляемая серверу. Если резолвер не передан, сверка
   * владельца не выполняется — так остаются рабочими узкие тесты координатора,
   * которые сети не касаются вовсе. Боевая сборка резолвер передаёт всегда.
   */
  resolveIdentity?: LiveIdentityResolver
  /** 005: внешний признак отмены — смена сессии, выход, размонтирование. */
  isCancelled?: () => boolean
}

export class SyncCoordinator {
  private running = false
  private rerunRequested = false

  private readonly store: OfflineStore
  private readonly transport: SyncTransport
  private readonly options: SyncCoordinatorOptions
  /** 005: круг, начатый до отмены, дальше текущей строки не идёт. */
  private cancelled = false

  constructor(
    store: OfflineStore,
    transport: SyncTransport,
    options: SyncCoordinatorOptions = {},
  ) {
    this.store = store
    this.transport = transport
    this.options = options
  }

  /**
   * 005: логическая отмена. Уже идущий круг остановится перед следующей
   * строкой — он держит свои ссылки на хранилище и транспорт, и обнулить их
   * снаружи нельзя. Ни одна строка при этом не портится: отмена случается
   * между операциями, а не внутри отправки.
   */
  cancel(): void {
    this.cancelled = true
  }

  private stopRequested(): boolean {
    return this.cancelled || this.options.isCancelled?.() === true
  }

  get isRunning(): boolean {
    return this.running
  }

  /**
   * Запуск. Повторный вызов во время работы не создаёт второй обработчик:
   * он лишь просит прогнать очередь ещё раз после текущего круга — иначе
   * операция, поставленная в очередь во время синхронизации, ждала бы
   * следующего события `online`.
   */
  async run(): Promise<SyncReport> {
    if (this.running) {
      this.rerunRequested = true
      return { processed: 0, synced: 0, failed: 0, attention: 0, skipped: 0, alreadyRunning: true }
    }

    const locks = this.options.useWebLocks === false ? null : getWebLocks()
    if (locks) {
      // Между вкладками: держатель блокировки — единственный обработчик.
      return locks.request(
        this.options.lockName || `sma-offline-sync:${this.store.namespace}`,
        { ifAvailable: true },
        async (lock: unknown) => {
          if (!lock) {
            return { processed: 0, synced: 0, failed: 0, attention: 0, skipped: 0, alreadyRunning: true }
          }
          return this.drainGuarded()
        },
      ) as Promise<SyncReport>
    }
    return this.drainGuarded()
  }

  private async drainGuarded(): Promise<SyncReport> {
    this.running = true
    const total: SyncReport = { processed: 0, synced: 0, failed: 0, attention: 0, skipped: 0 }
    try {
      // Круг повторяется, пока есть смысл. Смысл есть в двух случаях.
      //
      // Первый: во время синхронизации техник поставил новую операцию —
      // её просит прогнать rerunRequested, иначе она ждала бы следующего
      // события `online`.
      //
      // Второй: в прошлом круге что-то отправилось и при этом что-то было
      // пропущено по зависимости. Порядок в очереди не гарантирует, что
      // родитель встретится раньше потомка, и без повтора зависимая операция
      // ждала бы связи заново. Условие «был хотя бы один успех» не даёт
      // зациклиться: круг без успехов последний.
      let round = await this.drainOnce()
      for (;;) {
        total.processed += round.processed
        total.synced += round.synced
        total.failed += round.failed
        total.attention += round.attention
        total.skipped += round.skipped
        if (round.stoppedReason) total.stoppedReason = round.stoppedReason

        // 005: круг оборван — повторять его незачем и нельзя. Причина уже
        // в отчёте, а строки остались на месте.
        if (round.stoppedReason) break

        const dependenciesUnblocked = round.skipped > 0 && round.synced > 0
        if (!this.rerunRequested && !dependenciesUnblocked) break
        this.rerunRequested = false
        round = await this.drainOnce()
      }
    } finally {
      this.running = false
    }
    return total
  }

  /**
   * 005: можно ли отправлять именно эту строку прямо сейчас.
   * Возвращает причину отказа либо null, если отправка допустима.
   */
  private async assertOwnership(item: OfflineQueueItem): Promise<string | null> {
    const resolve = this.options.resolveIdentity
    if (!resolve) return null
    const live = await resolve()
    if (!live) return NO_IDENTITY_REASON
    return live === queueItemOwner(item, this.store.namespace) ? null : OWNER_MISMATCH_REASON
  }

  private async drainOnce(): Promise<SyncReport> {
    const report: SyncReport = { processed: 0, synced: 0, failed: 0, attention: 0, skipped: 0 }
    const items = await this.store.listQueue()

    for (const item of items) {
      if (item.status === 'synced' || item.status === 'attention') continue

      /*
       * SMA-OFFLINE-QUEUE-OWNER-IDENTITY-HARDENING-005.
       *
       * Две проверки до сети, на каждой строке.
       *
       * Отмена: сессию закрыли, пока круг шёл. Останавливаемся здесь, между
       * операциями, — прерывать начатую отправку нельзя, сервер о ней уже
       * знает.
       *
       * Владелец: работу поставил один человек, а предъявляется другой.
       * Такого запроса быть не должно вовсе, поэтому круг обрывается целиком,
       * а не помечает строку. Строка ни в чём не виновата: когда вернётся её
       * автор, она уйдёт обычным порядком. Отмечать её «Требует внимания»
       * значило бы звать человека чинить то, что не сломано.
       *
       * Сервер при этом остаётся последней инстанцией: проверка здесь ничего
       * не разрешает, она только запрещает отправку, которую нельзя делать.
       */
      if (this.stopRequested()) {
        report.stoppedReason = DRAIN_CANCELLED_REASON
        break
      }

      const guard = await this.assertOwnership(item)
      if (guard) {
        report.stoppedReason = guard
        break
      }

      // Причинный порядок: пока родитель не подтверждён сервером, зависимую
      // операцию отправлять некуда — у заявки ещё нет настоящего id.
      if (item.dependsOnId) {
        const parent = await this.store.getQueueItem(item.dependsOnId)
        if (parent && parent.status !== 'synced') {
          report.skipped += 1
          continue
        }
      }

      // Локальный идентификатор заявки подменяется серверным, когда он уже
      // известен. Если ещё нет — операция ждёт, а не уходит с `local:`.
      //
      // Операция, которая сама создаёт заявку, из этого правила исключена:
      // `local:` — её результат, а не входные данные, и ждать сопоставления
      // ей означало бы ждать саму себя.
      let ticketId = item.target.ticketId
      if (!item.producesTicketId && isLocalId(ticketId)) {
        const resolved = await this.store.resolveTicketId(ticketId)
        if (!resolved) {
          report.skipped += 1
          continue
        }
        ticketId = resolved
      }

      const blob = item.blobId ? await this.store.getBlob(item.blobId) : null
      if (item.blobId && !blob) {
        // Снимок пропал, а строка осталась. Повторять нечем — это случай
        // «Требует внимания», а не тихое удаление.
        await this.store.setStatus(item.id, 'attention', {
          attentionReason: 'Файл не найден на устройстве. Снимок нужно сделать заново.',
        })
        report.attention += 1
        report.processed += 1
        continue
      }

      await this.store.setStatus(item.id, 'syncing')
      report.processed += 1

      let outcome: SyncOutcome
      try {
        outcome = await this.transport.send({ ...item, target: { ...item.target, ticketId } }, { blob, ticketId })
      } catch (error) {
        outcome = classifySyncFailure({ message: (error as Error)?.message })
      }

      if (outcome.kind === 'ok') {
        // Заявка из обхода отдаёт настоящий id — зависимые операции получают
        // его до того, как дойдёт их очередь.
        if (item.producesTicketId && outcome.serverId && isLocalId(item.target.ticketId)) {
          await this.store.mapLocalTicket(item.target.ticketId!, outcome.serverId)
        }
        await this.store.setStatus(item.id, 'synced', { lastError: undefined })
        await this.store.removeSynced(item.id)
        report.synced += 1
        continue
      }

      if (outcome.kind === 'attention') {
        await this.store.setStatus(item.id, 'attention', { attentionReason: outcome.reason })
        report.attention += 1
        continue
      }

      const attempts = item.attempts + 1
      await this.store.setStatus(item.id, attempts >= MAX_AUTO_ATTEMPTS ? 'failed' : 'pending', {
        attempts,
        lastError: outcome.message,
      })
      report.failed += 1
    }

    return report
  }
}

function getWebLocks(): { request: (...args: unknown[]) => unknown } | null {
  const nav = (globalThis as { navigator?: { locks?: { request: (...a: unknown[]) => unknown } } }).navigator
  return nav?.locks ?? null
}

/*
 * Подписки на `online` здесь намеренно нет.
 *
 * 113C оставлял здесь attachOnlineTrigger — никем не вызванный. 113D отдал
 * единственный слушатель offline/runtime.ts: там же живёт единственный
 * координатор. Экспортируемая функция «подключить запуск по связи» — ловушка
 * для следующего разработчика: вызвать её значит завести второй запуск
 * разбора очереди. Координатор от одновременного запуска защищён, но
 * проверять это на работающем контуре незачем.
 */
