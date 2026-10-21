/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113C — поведенческие тесты offline-слоя.
 *
 * Запускаются встроенным тест-раннером Node по скомпилированным файлам:
 * во фронтенде тест-фреймворка нет, и задача его не заводит.
 *
 * Драйвер подменяется на хранилище в памяти. Это не обход проверки:
 * IndexedDB-драйвер намеренно сделан тонким и обязан вести себя так же,
 * а вся логика — очередь, ключи, зависимости, конфликты — живёт выше него
 * и проверяется здесь по-настоящему.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { MemoryDriver, UnavailableDriver } from './driver.js'
import { OfflineStore, isLocalId, LOCAL_ID_PREFIX } from './store.js'
import { SyncCoordinator, type SyncTransport } from './sync.js'
import { migrateLegacyQueue, LEGACY_QUEUE_KEY } from './migration.js'
import {
  classifySyncFailure,
  offlineDatabaseName,
  offlineNamespace,
  OFFLINE_SYNC_LABEL,
  syncStateOf,
} from './types.js'
import { createHttpSyncTransport, type TransportApi } from './transport.js'
import { cacheRoundSnapshot, readPendingRoundTicketItemIds, readRoundSnapshot } from './roundCache.js'
import {
  openOfflineSession,
  wipeOfflineSession,
  setOfflineDriverFactory,
  currentOfflineStore,
} from './session.js'

function makeStore(namespace = 'co-1:user-1') {
  const driver = new MemoryDriver()
  return { driver, store: new OfflineStore(driver, namespace) }
}

// ── 1. очередь переживает перезагрузку ────────────────────────────────────

test('1. очередь переживает перезагрузку', async () => {
  const driver = new MemoryDriver()
  const first = new OfflineStore(driver, 'co-1:user-1')
  const r = await first.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'текст' } })
  assert.equal(r.ok, true)

  // «Перезагрузка» — новый объект поверх того же хранилища.
  const afterReload = new OfflineStore(driver, 'co-1:user-1')
  const items = await afterReload.listQueue()
  assert.equal(items.length, 1)
  assert.equal(items[0].payload.comment, 'текст')
  assert.equal(items[0].status, 'pending')
})

// ── 2-4, 25. пространства имён, выход, смена пользователя ─────────────────

test('2. пространство имён строится из компании и пользователя', () => {
  assert.equal(offlineNamespace({ companyId: 'co-1', id: 'user-1' }), 'co-1:user-1')
  assert.equal(offlineNamespace({ companyId: 'co-1', id: '' }), null)
  assert.equal(offlineNamespace(null), null)
  assert.notEqual(
    offlineDatabaseName('co-1:user-1'),
    offlineDatabaseName('co-1:user-2'),
  )
})

test('3. выход удаляет данные пространства имён', async () => {
  const drivers = new Map<string, MemoryDriver>()
  setOfflineDriverFactory((name) => {
    if (!drivers.has(name)) drivers.set(name, new MemoryDriver())
    return drivers.get(name)!
  })

  const opened = await openOfflineSession({ companyId: 'co-1', id: 'user-1' }, { legacyStorage: null })
  await opened.store!.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  assert.equal((await opened.store!.listQueue()).length, 1)

  await wipeOfflineSession({ companyId: 'co-1', id: 'user-1' })
  const reopened = await openOfflineSession({ companyId: 'co-1', id: 'user-1' }, { legacyStorage: null })
  assert.equal((await reopened.store!.listQueue()).length, 0)
  setOfflineDriverFactory(null)
})

test('4 и 25. следующий пользователь не видит данные предыдущего', async () => {
  const drivers = new Map<string, MemoryDriver>()
  setOfflineDriverFactory((name) => {
    if (!drivers.has(name)) drivers.set(name, new MemoryDriver())
    return drivers.get(name)!
  })

  const first = await openOfflineSession({ companyId: 'co-1', id: 'user-1' }, { legacyStorage: null })
  await first.store!.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-secret' }, payload: { comment: 'приватное' } })

  // Смена пользователя без выхода: база другая.
  const second = await openOfflineSession({ companyId: 'co-1', id: 'user-2' }, { legacyStorage: null })
  assert.notEqual(second.namespace, first.namespace)
  assert.equal((await second.store!.listQueue()).length, 0)

  const seen = JSON.stringify(await second.store!.listQueue())
  assert.ok(!seen.includes('приватное'))
  assert.ok(!seen.includes('tk-secret'))
  setOfflineDriverFactory(null)
})

// ── 5-6. чек-поинты ───────────────────────────────────────────────────────

test('5. отметка чек-поинта ставится в очередь офлайн', async () => {
  const { store } = makeStore()
  const r = await store.enqueue({
    kind: 'checkpoint.update',
    target: { roundId: 'r-1', checkpointId: 'c-1' },
    payload: { value: 'PROBLEM', comment: 'подтекает' },
  })
  assert.equal(r.ok, true)
  const [item] = await store.listQueue()
  assert.equal(item.kind, 'checkpoint.update')
  assert.equal(item.payload.value, 'PROBLEM')
  assert.equal(syncStateOf(item), 'pending')
})

test('6. повторная отметка того же чек-поинта схлопывается, ключ сохраняется', async () => {
  const { store } = makeStore()
  const target = { roundId: 'r-1', checkpointId: 'c-1' }
  const first = await store.enqueue({ kind: 'checkpoint.update', target, payload: { value: 'OK' } })
  assert.equal(first.ok, true)
  const firstKey = first.ok ? first.item.idempotencyKey : ''

  await store.enqueue({ kind: 'checkpoint.update', target, payload: { value: 'PROBLEM' } })
  const last = await store.enqueue({ kind: 'checkpoint.update', target, payload: { value: 'CRITICAL' } })

  const items = await store.listQueue()
  assert.equal(items.length, 1, 'три переключения дают одну строку')
  assert.equal(items[0].payload.value, 'CRITICAL', 'побеждает последнее значение')
  assert.equal(items[0].idempotencyKey, firstKey, 'ключ не пересоздаётся при схлопывании')
  assert.equal(last.ok, true)
})

// ── 7-8. стабильность ключа идемпотентности ───────────────────────────────

test('7. у комментария стабильный ключ идемпотентности', async () => {
  const driver = new MemoryDriver()
  const store = new OfflineStore(driver, 'co-1:user-1')
  const r = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  assert.equal(r.ok, true)
  const key = r.ok ? r.item.idempotencyKey : ''
  assert.ok(key.startsWith('ticket.comment:'))

  // Перезагрузка: ключ читается из хранилища, а не создаётся заново.
  const reloaded = new OfflineStore(driver, 'co-1:user-1')
  assert.equal((await reloaded.listQueue())[0].idempotencyKey, key)

  // Два разных комментария — два разных ключа.
  const other = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'b' } })
  assert.notEqual(other.ok && other.item.idempotencyKey, key)
})

test('8. повтор после ошибки не меняет ключ', async () => {
  const { store } = makeStore()
  const r = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  const key = r.ok ? r.item.idempotencyKey : ''

  let attempts = 0
  const flaky: SyncTransport = {
    async send(item) {
      attempts += 1
      assert.equal(item.idempotencyKey, key, 'транспорт всегда получает исходный ключ')
      return attempts < 3 ? { kind: 'retry', message: 'нет сети' } : { kind: 'ok' }
    },
  }
  const sync = new SyncCoordinator(store, flaky, { useWebLocks: false })
  await sync.run()
  await sync.run()
  await sync.run()
  assert.equal(attempts, 3)
  assert.equal((await store.listQueue()).length, 0, 'после подтверждения строка удалена')
})

// ── 9-11. снимки ──────────────────────────────────────────────────────────

test('9. Blob фото заявки переживает перезагрузку', async () => {
  const driver = new MemoryDriver()
  const store = new OfflineStore(driver, 'co-1:user-1')
  const blob = new Blob(['фото'], { type: 'image/jpeg' })
  const r = await store.enqueue({ kind: 'ticket.attachment', target: { ticketId: 'tk-1' }, blob })
  assert.equal(r.ok, true)

  const reloaded = new OfflineStore(driver, 'co-1:user-1')
  const [item] = await reloaded.listQueue()
  assert.ok(item.blobId, 'строка ссылается на снимок')
  const restored = await reloaded.getBlob(item.blobId!)
  assert.ok(restored, 'снимок доступен после перезагрузки')
  assert.equal(await restored!.text(), 'фото')
})

test('10. Blob фото чек-поинта переживает перезагрузку', async () => {
  const driver = new MemoryDriver()
  const store = new OfflineStore(driver, 'co-1:user-1')
  const blob = new Blob(['чек'], { type: 'image/png' })
  await store.enqueue({ kind: 'checkpoint.attachment', target: { roundId: 'r-1', checkpointId: 'c-1' }, blob })

  const reloaded = new OfflineStore(driver, 'co-1:user-1')
  const [item] = await reloaded.listQueue()
  assert.equal(item.kind, 'checkpoint.attachment')
  assert.equal(await (await reloaded.getBlob(item.blobId!))!.text(), 'чек')
})

test('11. повтор загрузки фото не создаёт дубль и не теряет Blob до подтверждения', async () => {
  const { store } = makeStore()
  const blob = new Blob(['фото'], { type: 'image/jpeg' })
  const r = await store.enqueue({ kind: 'ticket.attachment', target: { ticketId: 'tk-1' }, blob })
  const key = r.ok ? r.item.idempotencyKey : ''
  const blobId = r.ok ? r.item.blobId! : ''

  const keys: string[] = []
  let failFirst = true
  const transport: SyncTransport = {
    async send(item, ctx) {
      keys.push(item.idempotencyKey)
      assert.ok(ctx.blob, 'снимок передан в транспорт')
      if (failFirst) { failFirst = false; return { kind: 'retry', message: 'обрыв' } }
      return { kind: 'ok' }
    },
  }
  const sync = new SyncCoordinator(store, transport, { useWebLocks: false })

  await sync.run()
  assert.ok(await store.getBlob(blobId), 'после неудачи снимок остаётся на устройстве')

  await sync.run()
  assert.deepEqual(keys, [key, key], 'обе попытки с одним ключом — сервер не создаст дубль')
  assert.equal(await store.getBlob(blobId), null, 'снимок удалён только после подтверждения')
  assert.equal((await store.listQueue()).length, 0)
})

// ── 12-13. заявка из обхода и причинный порядок ───────────────────────────

test('12. заявка из обхода ставится в очередь офлайн', async () => {
  const { store } = makeStore()
  const localTicketId = `${LOCAL_ID_PREFIX}tk-draft`
  const r = await store.enqueue({
    kind: 'ticket.fromRound',
    target: { ticketId: localTicketId, roundId: 'r-1', checkpointId: 'c-1' },
    payload: { problemText: 'течь' },
    producesTicketId: true,
  })
  assert.equal(r.ok, true)
  assert.ok(isLocalId(localTicketId))
  assert.equal((await store.listQueue())[0].producesTicketId, true)
})

test('13. зависимая операция ждёт настоящий id заявки и получает его', async () => {
  const { store } = makeStore()
  const localTicketId = `${LOCAL_ID_PREFIX}tk-draft`

  const parent = await store.enqueue({
    kind: 'ticket.fromRound',
    target: { ticketId: localTicketId, roundId: 'r-1' },
    payload: { problemText: 'течь' },
    producesTicketId: true,
  })
  assert.equal(parent.ok, true)
  await store.enqueue({
    kind: 'ticket.comment',
    target: { ticketId: localTicketId },
    payload: { comment: 'подробности' },
    dependsOnId: parent.ok ? parent.item.id : undefined,
  })

  const seen: Array<{ kind: string; ticketId?: string }> = []
  const transport: SyncTransport = {
    async send(item) {
      seen.push({ kind: item.kind, ticketId: item.target.ticketId })
      return item.kind === 'ticket.fromRound' ? { kind: 'ok', serverId: 'tk-real' } : { kind: 'ok' }
    },
  }
  await new SyncCoordinator(store, transport, { useWebLocks: false }).run()

  assert.equal(seen.length, 2)
  assert.equal(seen[0].kind, 'ticket.fromRound', 'родитель уходит первым')
  assert.equal(seen[1].kind, 'ticket.comment')
  assert.equal(seen[1].ticketId, 'tk-real', 'зависимая операция получила серверный id, а не local:')
})

test('13b. зависимая операция не уходит, пока родитель не подтверждён', async () => {
  const { store } = makeStore()
  const localTicketId = `${LOCAL_ID_PREFIX}tk-draft`
  const parent = await store.enqueue({
    kind: 'ticket.fromRound', target: { ticketId: localTicketId }, producesTicketId: true,
  })
  await store.enqueue({
    kind: 'ticket.comment', target: { ticketId: localTicketId },
    payload: { comment: 'x' }, dependsOnId: parent.ok ? parent.item.id : undefined,
  })

  const seen: string[] = []
  const transport: SyncTransport = {
    async send(item) {
      seen.push(item.kind)
      return { kind: 'retry', message: 'нет сети' }
    },
  }
  await new SyncCoordinator(store, transport, { useWebLocks: false }).run()
  assert.deepEqual(seen, ['ticket.fromRound'], 'комментарий не отправлен: родитель не подтверждён')
})

// ── 14-15. единственность координатора ────────────────────────────────────

test('14. ровно один обработчик синхронизации', async () => {
  const { store } = makeStore()
  for (let i = 0; i < 3; i += 1) {
    await store.enqueue({ kind: 'ticket.comment', target: { ticketId: `tk-${i}` }, payload: { comment: String(i) } })
  }

  let concurrent = 0
  let maxConcurrent = 0
  const transport: SyncTransport = {
    async send() {
      concurrent += 1
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((r) => setTimeout(r, 5))
      concurrent -= 1
      return { kind: 'ok' }
    },
  }
  const sync = new SyncCoordinator(store, transport, { useWebLocks: false })
  await Promise.all([sync.run(), sync.run(), sync.run()])
  assert.equal(maxConcurrent, 1, 'параллельных отправок нет')
})

test('15. повторное событие online не создаёт второй обработчик', async () => {
  const { store } = makeStore()
  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })

  let sends = 0
  const transport: SyncTransport = {
    async send() { sends += 1; await new Promise((r) => setTimeout(r, 10)); return { kind: 'ok' } },
  }
  const sync = new SyncCoordinator(store, transport, { useWebLocks: false })

  const first = sync.run()
  const second = await sync.run()
  assert.equal(second.alreadyRunning, true, 'второй запуск отклонён')
  await first
  assert.equal(sends, 1, 'операция отправлена один раз')
})

// ── 16. взаимодействие с realtime 112A ────────────────────────────────────

test('16. переподключение realtime не запускает вторую синхронизацию', async () => {
  const { store } = makeStore()
  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })

  let sends = 0
  const transport: SyncTransport = {
    async send() { sends += 1; await new Promise((r) => setTimeout(r, 10)); return { kind: 'ok' } },
  }
  const sync = new SyncCoordinator(store, transport, { useWebLocks: false })

  // Сокет 112A при восстановлении связи дёргает тот же координатор, а не
  // свой: второго менеджера и второй очереди не заводится.
  const running = sync.run()
  const realtimeReconnect = await sync.run()
  assert.equal(realtimeReconnect.alreadyRunning, true)
  await running
  assert.equal(sends, 1)
})

// ── 17-20. конфликты ──────────────────────────────────────────────────────

test('17. IDEMPOTENCY_KEY_CONFLICT уводит в «Требует внимания»', async () => {
  const { store } = makeStore()
  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  const transport: SyncTransport = {
    async send() { return classifySyncFailure({ status: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' }) },
  }
  await new SyncCoordinator(store, transport, { useWebLocks: false }).run()

  const [item] = await store.listQueue()
  assert.equal(item.status, 'attention')
  assert.equal(syncStateOf(item), 'attention')
  assert.match(item.attentionReason || '', /уже выполнялась/)
})

test('18. IDEMPOTENCY_IN_PROGRESS — это ожидание, а не ошибка', async () => {
  const outcome = classifySyncFailure({ status: 409, code: 'IDEMPOTENCY_IN_PROGRESS' })
  assert.equal(outcome.kind, 'retry')

  const { store } = makeStore()
  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  const transport: SyncTransport = { async send() { return outcome } }
  await new SyncCoordinator(store, transport, { useWebLocks: false }).run()

  const [item] = await store.listQueue()
  assert.equal(item.status, 'pending', 'строка остаётся в очереди и будет повторена')
  assert.equal(item.attempts, 1)
})

test('19. IDEMPOTENCY_RESULT_GONE не повторяется вслепую', async () => {
  const { store } = makeStore()
  await store.enqueue({ kind: 'ticket.attachment', target: { ticketId: 'tk-1' }, blob: new Blob(['x']) })
  const transport: SyncTransport = {
    async send() { return classifySyncFailure({ status: 410, code: 'IDEMPOTENCY_RESULT_GONE' }) },
  }
  await new SyncCoordinator(store, transport, { useWebLocks: false }).run()

  const [item] = await store.listQueue()
  assert.equal(item.status, 'attention')
  assert.match(item.attentionReason || '', /не помнит результат/)
  assert.ok(await store.getBlob(item.blobId!), 'снимок сохранён — работа не потеряна')
})

test('20. 403 и 404 сохраняют локальную работу', async () => {
  for (const status of [403, 404]) {
    const { store } = makeStore()
    await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'важное' } })
    const transport: SyncTransport = { async send() { return classifySyncFailure({ status }) } }
    await new SyncCoordinator(store, transport, { useWebLocks: false }).run()

    const items = await store.listQueue()
    assert.equal(items.length, 1, `${status}: строка не удалена`)
    assert.equal(items[0].status, 'attention')
    assert.equal(items[0].payload.comment, 'важное', `${status}: содержимое сохранено`)
  }
})

// ── 21-22. отказы хранилища ───────────────────────────────────────────────

test('21. переполнение квоты не выдаётся за успешное сохранение', async () => {
  const { driver, store } = makeStore()
  driver.failNextWrite = { ok: false, reason: 'quota', message: 'Недостаточно места на устройстве' }

  const r = await store.enqueue({ kind: 'ticket.attachment', target: { ticketId: 'tk-1' }, blob: new Blob(['x']) })
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.quota, true)
  assert.equal((await store.listQueue()).length, 0, 'строки нет — и интерфейс не скажет «сохранено»')
})

test('22. недоступная IndexedDB честно отказывает', async () => {
  const store = new OfflineStore(new UnavailableDriver(), 'co-1:user-1')
  assert.equal(store.available, false)
  const r = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  assert.equal(r.ok, false)
  assert.equal((await store.listQueue()).length, 0)
})

test('22b. сирота-Blob не остаётся, если строка очереди не записалась', async () => {
  const { driver, store } = makeStore()
  let writes = 0
  const originalPut = driver.put.bind(driver)
  driver.put = async (s, k, v) => {
    writes += 1
    // Первая запись — Blob, она проходит. Вторая — строка очереди, отказ.
    if (writes === 2) return { ok: false, reason: 'failed', message: 'сбой' }
    return originalPut(s, k, v)
  }
  const r = await store.enqueue({ kind: 'ticket.attachment', target: { ticketId: 'tk-1' }, blob: new Blob(['x']) })
  assert.equal(r.ok, false)
  driver.put = originalPut
  assert.deepEqual(await store.listBlobIds(), [], 'снимок удалён вместе с неудавшейся строкой')
})

// ── 23. перенос из localStorage ───────────────────────────────────────────

test('23. очередь из localStorage переносится и не дублируется', async () => {
  const { store } = makeStore()
  const legacy = [
    { id: 'l1', type: 'comment', ticketId: 'tk-1', payload: { comment: 'старый' }, status: 'pending', createdAt: '2026-09-01T00:00:00Z' },
    { id: 'l2', type: 'status', ticketId: 'tk-2', payload: { status: 'IN_PROGRESS' }, status: 'failed', createdAt: '2026-09-01T00:01:00Z' },
    { id: 'l3', type: 'comment', ticketId: 'tk-3', payload: { comment: 'уже ушёл' }, status: 'synced', createdAt: '2026-09-01T00:02:00Z' },
  ]
  let removed = false
  const storage = {
    getItem: (k: string) => (k === LEGACY_QUEUE_KEY && !removed ? JSON.stringify(legacy) : null),
    removeItem: () => { removed = true },
  }

  const first = await migrateLegacyQueue(store, storage)
  assert.equal(first.migrated, 2, 'перенесены незавершённые')
  assert.equal(first.skipped, 1, 'уже отправленная пропущена')
  assert.equal(removed, true, 'исходный ключ очищен после успешного переноса')

  const items = await store.listQueue()
  assert.equal(items.length, 2)
  assert.ok(items.every((i) => i.idempotencyKey), 'перенесённым строкам выдан ключ идемпотентности')
  assert.equal(items.find((i) => i.kind === 'ticket.status')?.status, 'failed')

  // Повторный запуск ничего не дублирует.
  const second = await migrateLegacyQueue(store, storage)
  assert.equal(second.alreadyDone, true)
  assert.equal((await store.listQueue()).length, 2)
})

test('23b. при отказе записи исходная очередь не удаляется', async () => {
  const { driver, store } = makeStore()
  const legacy = [{ id: 'l1', type: 'comment', ticketId: 'tk-1', payload: { comment: 'важное' }, status: 'pending' }]
  let removed = false
  const storage = {
    getItem: () => (removed ? null : JSON.stringify(legacy)),
    removeItem: () => { removed = true },
  }
  driver.failNextWrite = { ok: false, reason: 'quota', message: 'нет места' }

  const report = await migrateLegacyQueue(store, storage)
  assert.equal(report.migrated, 0)
  assert.equal(report.sourceKept, true)
  assert.equal(removed, false, 'работа техника не осиротела')
})

// ── 24. оболочка приложения офлайн ────────────────────────────────────────

test('24. Service Worker кэширует оболочку и не кэширует API', async () => {
  const { readFileSync } = await import('node:fs')
  const sw = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8')

  assert.match(sw, /addEventListener\('fetch'/, 'обработчик fetch добавлен')
  assert.match(sw, /APP_SHELL_CACHE/, 'есть отдельный кэш оболочки')
  // Оболочка отдаётся из кэша только для навигации: всё остальное выходит
  // из обработчика раньше, чем дойдёт до кэша.
  assert.match(sw, /request\.mode !== 'navigate'/, 'кэшируется только навигация')
  assert.match(sw, /request\.method !== 'GET'/, 'мутации не кэшируются')
  assert.match(sw, /\/uploads\//, 'защищённая раздача исключена явно')
  // Ответы API в кэш не кладутся. Записей в кэш ровно две, и обе безопасны:
  // сама оболочка и сборочный файл, отобранный isBuildAsset. 113D добавил
  // вторую — без неё экран, который техник не открывал до потери связи,
  // не открывался вовсе.
  const puts = sw.match(/cache\.put\([^)]*\)/g) ?? []
  assert.equal(puts.length, 2, `в кэш пишутся только оболочка и сборочный файл, найдено: ${puts.length}`)
  assert.ok(puts.some((p) => /APP_SHELL_URL/.test(p)), 'оболочка сохраняется')
  assert.ok(puts.some((p) => /\(request, copy\)/.test(p)), 'сборочный файл сохраняется по своему запросу')

  // Отбор сборочных файлов ограничен каталогом сборки и известными
  // расширениями: под него не должен попасть ни один ответ с данными.
  assert.match(sw, /function isBuildAsset/, 'отбор сборочных файлов выделен явно')
  assert.match(sw, /url\.pathname\.startsWith\('\/assets\/'\)/, 'только каталог /assets/')
})

// ── дополнительные инварианты ─────────────────────────────────────────────

test('русские подписи состояний заданы одним словарём', () => {
  assert.equal(OFFLINE_SYNC_LABEL.savedLocally, 'Сохранено на устройстве')
  assert.equal(OFFLINE_SYNC_LABEL.pending, 'Ожидает отправки')
  assert.equal(OFFLINE_SYNC_LABEL.syncing, 'Синхронизация')
  assert.equal(OFFLINE_SYNC_LABEL.synced, 'Синхронизировано')
  assert.equal(OFFLINE_SYNC_LABEL.attention, 'Требует внимания')
  assert.equal(OFFLINE_SYNC_LABEL.failed, 'Ошибка отправки')
})

test('успех сервера не показывается до подтверждения', async () => {
  const { store } = makeStore()
  const r = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  assert.equal(r.ok && r.item.status, 'pending')
  assert.notEqual(r.ok && syncStateOf(r.item), 'synced')
})

test('в хранилище не попадают токены и пароли', async () => {
  const { driver, store } = makeStore()
  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  await store.cacheTicket({ id: 'tk-1', title: 'Заявка' })
  const dump = JSON.stringify(await Promise.all([
    driver.getAll('queue'), driver.getAll('tickets'), driver.getAll('meta'),
  ]))
  for (const forbidden of ['token', 'accessToken', 'password', 'Authorization']) {
    assert.ok(!dump.toLowerCase().includes(forbidden.toLowerCase()), `в хранилище не должно быть ${forbidden}`)
  }
})

test('рабочий пакет кэшируется и читается офлайн', async () => {
  const { store } = makeStore()
  await store.cacheLocation({ id: 'loc-1', name: 'Фудзияма' })
  await store.cacheTicket({ id: 'tk-1', problemText: 'течь' })
  await store.cacheRound({ id: 'r-1', title: 'Обход' })
  await store.cacheCheckpoint({ id: 'c-1', roundId: 'r-1', title: 'Насос' })

  assert.equal((await store.readLocation<{ name: string }>('loc-1'))!.name, 'Фудзияма')
  assert.equal((await store.readTicket<{ problemText: string }>('tk-1'))!.problemText, 'течь')
  assert.equal((await store.readRound<{ title: string }>('r-1'))!.title, 'Обход')
  assert.equal((await store.readCheckpoints()).length, 1)
})

test('счётчики для интерфейса', async () => {
  const { store } = makeStore()
  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'a' } })
  const second = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-2' }, payload: { comment: 'b' } })
  if (second.ok) await store.setStatus(second.item.id, 'attention', { attentionReason: 'доступ отозван' })

  assert.equal(await store.pendingCount(), 1)
  assert.equal(await store.attentionCount(), 1)
})

test('сессия не открывается без пользователя', async () => {
  setOfflineDriverFactory(() => new MemoryDriver())
  const result = await openOfflineSession(null, { legacyStorage: null })
  assert.equal(result.store, null)
  assert.equal(result.available, false)
  assert.equal(currentOfflineStore(), null)
  setOfflineDriverFactory(null)
})

// ══ SMA-MOBILE-OFFLINE-INTEGRATION-113D ═══════════════════════════════════
//
// Тесты настоящего транспорта. Транспорт принимает набор функций API
// параметром, поэтому проверяется именно он — тот код, который поедет на
// устройство, — а не его тестовая копия.

type ApiCall = { fn: string; key?: string; replyToId?: string; args: unknown[] }

/**
 * 121G: ключ идемпотентности у создающих операций передаётся либо строкой,
 * либо в объекте параметров вместе с replyToId — `lib/api` принимает оба вида.
 * Фейк разбирает оба, чтобы прежние проверки ключа остались в силе.
 *
 * 122B: разбор двух видов относится только к addTicketComment. Расширенную
 * форму принимает в `lib/api` она одна: её четвёртый параметр объявлен как
 * `string | AddTicketCommentOptions`. У uploadTicketAttachment четвёртый
 * параметр — `idempotencyKey?: string`, и он уходит прямо в заголовок
 * Idempotency-Key. Объект там дал бы заголовок `[object Object]`, то есть
 * повтор снимка сервер счёл бы новой операцией. Поэтому у фейка загрузки
 * параметр остаётся строгой позиционной строкой, а не `unknown`: иначе
 * расширение транспорта прошло бы мимо тестов.
 */
function readSendOptions(value: unknown): { key?: string; replyToId?: string } {
  if (typeof value === 'string') return { key: value }
  const options = (value || {}) as { idempotencyKey?: string; replyToId?: string }
  return { key: options.idempotencyKey, replyToId: options.replyToId }
}

/**
 * 122B: строгость позиционной строки проверяется в runtime, а не типом.
 * Фейк доходит до транспорта через `as unknown as TransportApi` — двойное
 * приведение стирает проверку типов, и сузить параметр недостаточно.
 * Эта стража — то, что действительно роняет набор, если отправка вложения
 * когда-нибудь начнёт передавать объект параметров.
 */
const POSITIONAL_KEY_VIOLATION = 'ключ идемпотентности передан не строкой'

function positionalKey(fn: string, value?: string): string | undefined {
  if (value === undefined || typeof value === 'string') return value
  throw new Error(`${POSITIONAL_KEY_VIOLATION}: ${fn} получила ${typeof value}`)
}

function makeFakeApi(behaviour: Partial<Record<string, () => unknown>> = {}) {
  const calls: ApiCall[] = []
  const run = (fn: string, key: string | undefined, args: unknown[], replyToId?: string) => {
    calls.push({ fn, key, replyToId, args })
    const impl = behaviour[fn]
    return impl ? impl() : ({} as unknown)
  }
  const fake = {
    async addTicketComment(id: string, comment: string, scope?: unknown, keyOrOptions?: unknown) {
      const sent = readSendOptions(keyOrOptions)
      return run('addTicketComment', sent.key, [id, comment, scope], sent.replyToId) as { ok: boolean }
    },
    async uploadTicketAttachment(id: string, file: unknown, scope?: unknown, key?: string) {
      return run('uploadTicketAttachment', positionalKey('uploadTicketAttachment', key), [id, file, scope])
    },
    async updateTicketStatus(id: string, input: unknown, scope?: unknown) {
      return run('updateTicketStatus', undefined, [id, input, scope])
    },
    async updateInspectionRunItem(runId: string, itemId: string, input: unknown) {
      return run('updateInspectionRunItem', undefined, [runId, itemId, input])
    },
    async uploadInspectionRunItemAttachment(runId: string, itemId: string, file: unknown, key?: string) {
      return run('uploadInspectionRunItemAttachment', key, [runId, itemId, file])
    },
    async createTicketFromInspectionItem(runId: string, itemId: string, input: unknown, key?: string) {
      return run('createTicketFromInspectionItem', key, [runId, itemId, input]) as { ticket?: { id: string } }
    },
  }
  return { calls, api: fake as unknown as TransportApi }
}

test('113D-1. транспорт передаёт ключ идемпотентности во все создающие операции', async () => {
  const { calls, api } = makeFakeApi()
  const transport = createHttpSyncTransport(api)
  const { store } = makeStore()

  const comment = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'а' } })
  const photo = await store.enqueue({
    kind: 'ticket.attachment', target: { ticketId: 'tk-1' }, payload: {}, blob: new Blob(['x']),
  })
  const checkpointPhoto = await store.enqueue({
    kind: 'checkpoint.attachment', target: { roundId: 'r-1', checkpointId: 'c-1' }, payload: {}, blob: new Blob(['x']),
  })
  const fromRound = await store.enqueue({
    kind: 'ticket.fromRound',
    target: { roundId: 'r-1', checkpointId: 'c-1', ticketId: `${LOCAL_ID_PREFIX}r-1:c-1` },
    payload: { problemText: 'течь' },
    producesTicketId: true,
  })
  assert.ok(comment.ok && photo.ok && checkpointPhoto.ok && fromRound.ok)

  for (const created of [comment, photo, checkpointPhoto, fromRound]) {
    if (!created.ok) throw new Error('строка не сохранилась')
    const blob = created.item.blobId ? await store.getBlob(created.item.blobId) : null
    const outcome = await transport.send(created.item, { blob })
    assert.equal(outcome.kind, 'ok', `${created.item.kind} должна уйти успешно`)
  }

  assert.equal(calls.length, 4)
  for (const call of calls) {
    assert.ok(call.key, `${call.fn} обязана получить Idempotency-Key`)
  }
  // Ключи разных операций не совпадают: иначе сервер счёл бы их повтором одной.
  assert.equal(new Set(calls.map((c) => c.key)).size, 4)
})

test('113D-2. обновление чек-поинта идёт без ключа: оно идемпотентно само по себе', async () => {
  const { calls, api } = makeFakeApi()
  const transport = createHttpSyncTransport(api)
  const { store } = makeStore()

  const created = await store.enqueue({
    kind: 'checkpoint.update', target: { roundId: 'r-1', checkpointId: 'c-1' }, payload: { value: 'OK' },
  })
  if (!created.ok) throw new Error('строка не сохранилась')

  assert.equal((await transport.send(created.item, { blob: null })).kind, 'ok')
  assert.equal(calls[0].fn, 'updateInspectionRunItem')
  assert.equal(calls[0].key, undefined)
})

test('113D-3. повтор после обрыва связи уходит с тем же ключом — дубля не будет', async () => {
  let attempt = 0
  const { calls, api } = makeFakeApi({
    addTicketComment: () => {
      attempt += 1
      if (attempt === 1) throw new Error('Failed to fetch')
      return { ok: true }
    },
  })
  const { store } = makeStore()
  const coordinator = new SyncCoordinator(store, createHttpSyncTransport(api), { useWebLocks: false })

  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'а' } })

  const first = await coordinator.run()
  assert.equal(first.failed, 1, 'обрыв связи — повторяемая неудача, не «требует внимания»')
  assert.equal((await store.listQueue()).length, 1, 'работа остаётся на устройстве')

  const second = await coordinator.run()
  assert.equal(second.synced, 1)
  assert.equal((await store.listQueue()).length, 0, 'подтверждённая работа уходит из очереди')

  assert.equal(calls.length, 2)
  assert.equal(calls[0].key, calls[1].key, 'ключ обязан пережить повтор')
})

test('121G. ответ переживает очередь и повтор: тот же ключ и та же цель', async () => {
  let attempt = 0
  const { calls, api } = makeFakeApi({
    addTicketComment: () => {
      attempt += 1
      if (attempt === 1) throw new Error('Failed to fetch')
      return { ok: true }
    },
  })
  const { store } = makeStore()
  const coordinator = new SyncCoordinator(store, createHttpSyncTransport(api), { useWebLocks: false })

  // Ровно то тело, которое кладёт экран: прежние поля плюс цель ответа.
  await store.enqueue({
    kind: 'ticket.comment',
    target: { ticketId: 'tk-1' },
    payload: { comment: 'ответ', replyToId: 'tc-42' },
  })

  await coordinator.run()
  const second = await coordinator.run()

  assert.equal(second.synced, 1)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].replyToId, 'tc-42', 'цель ответа уходит с первой попытки')
  assert.equal(calls[1].replyToId, 'tc-42', 'цель ответа переживает повтор')
  assert.equal(calls[0].key, calls[1].key, 'ключ идемпотентности при повторе тот же')
  assert.equal((await store.listQueue()).length, 0)
})

test('121G. обычный комментарий из очереди уходит без цели ответа', async () => {
  const { calls, api } = makeFakeApi()
  const { store } = makeStore()
  const coordinator = new SyncCoordinator(store, createHttpSyncTransport(api), { useWebLocks: false })

  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'обычный' } })
  await coordinator.run()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].replyToId, undefined, 'у обычного комментария цели нет')
  assert.ok(calls[0].key, 'ключ идемпотентности остаётся')
})

test('122B. отправка вложения передаёт ключ позиционной строкой, а не объектом', async () => {
  const { calls, api } = makeFakeApi()
  const { store } = makeStore()
  const coordinator = new SyncCoordinator(store, createHttpSyncTransport(api), { useWebLocks: false })

  const created = await store.enqueue({
    kind: 'ticket.attachment', target: { ticketId: 'tk-1' }, payload: {}, blob: new Blob(['x']),
  })
  if (!created.ok) throw new Error('строка не сохранилась')
  await coordinator.run()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].fn, 'uploadTicketAttachment')
  // Именно строка: uploadTicketAttachment кладёт этот параметр прямо
  // в заголовок Idempotency-Key, объект дал бы там «[object Object]».
  assert.equal(typeof calls[0].key, 'string')
  assert.equal(calls[0].key, created.item.idempotencyKey)
  assert.equal(calls[0].replyToId, undefined, 'у вложения цели ответа нет и быть не может')
})

/**
 * 122B, отрицательный контроль к проверке выше.
 *
 * Без него сужение параметра было бы украшением: двойное приведение фейка
 * к TransportApi стирает типы, и объект вместо строки прошёл бы молча.
 * Здесь объект подаётся намеренно — набор обязан упасть.
 */
test('122B, контроль. объект вместо ключа у отправки вложения роняет набор', async () => {
  const { calls, api } = makeFakeApi()

  await assert.rejects(
    () => api.uploadTicketAttachment(
      'tk-1',
      new Blob(['x']),
      undefined,
      { idempotencyKey: 'key-1' } as unknown as string,
    ),
    (error: unknown) => {
      assert.match((error as Error).message, new RegExp(POSITIONAL_KEY_VIOLATION))
      return true
    },
    'расширенная форма параметров у uploadTicketAttachment обязана быть отказом',
  )

  // Строка — единственная принимаемая форма, и она отказом не становится.
  await api.uploadTicketAttachment('tk-1', new Blob(['x']), undefined, 'key-2')
  assert.equal(calls.at(-1)?.key, 'key-2')

  // У addTicketComment расширенная форма, напротив, остаётся рабочей:
  // контроль сужает ровно одну функцию, а не весь фейк.
  await api.addTicketComment('tk-1', 'ответ', undefined, { idempotencyKey: 'key-3', replyToId: 'tc-42' })
  assert.equal(calls.at(-1)?.key, 'key-3')
  assert.equal(calls.at(-1)?.replyToId, 'tc-42')
})

test('113D-4. заявка из обхода отдаёт реальный id, и зависимые операции идут в неё', async () => {
  const { calls, api } = makeFakeApi({
    createTicketFromInspectionItem: () => ({ ticket: { id: 'tk-real' } }),
  })
  const { store } = makeStore()
  const coordinator = new SyncCoordinator(store, createHttpSyncTransport(api), { useWebLocks: false })

  const localId = `${LOCAL_ID_PREFIX}r-1:c-1`
  await store.enqueue({
    kind: 'ticket.fromRound',
    target: { roundId: 'r-1', checkpointId: 'c-1', ticketId: localId },
    payload: { problemText: 'течь' },
    producesTicketId: true,
  })
  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: localId }, payload: { comment: 'подробности' } })

  const report = await coordinator.run()
  assert.equal(report.synced, 2)

  const commentCall = calls.find((c) => c.fn === 'addTicketComment')!
  assert.equal(commentCall.args[0], 'tk-real', 'комментарий обязан уйти в настоящую заявку')
  assert.ok(!isLocalId(String(commentCall.args[0])))
})

test('113D-5. ответы 113B разбираются по смыслу, а не по факту ошибки', async () => {
  const cases: Array<[string, 'attention' | 'retry']> = [
    ['IDEMPOTENCY_KEY_CONFLICT', 'attention'],
    ['IDEMPOTENCY_RESULT_GONE', 'attention'],
    ['IDEMPOTENCY_IN_PROGRESS', 'retry'],
    ['HTTP 403', 'attention'],
    ['HTTP 500', 'retry'],
    ['Failed to fetch', 'retry'],
  ]
  for (const [message, expected] of cases) {
    const { api } = makeFakeApi({ addTicketComment: () => { throw new Error(message) } })
    const transport = createHttpSyncTransport(api)
    const { store } = makeStore()
    const created = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'а' } })
    if (!created.ok) throw new Error('строка не сохранилась')
    const outcome = await transport.send(created.item, { blob: null })
    assert.equal(outcome.kind, expected, `${message} → ${expected}`)
  }
})

test('113D-6. пропавший снимок не выдаётся за отправленный', async () => {
  const { calls, api } = makeFakeApi()
  const transport = createHttpSyncTransport(api)
  const { store } = makeStore()
  const created = await store.enqueue({
    kind: 'ticket.attachment', target: { ticketId: 'tk-1' }, payload: {}, blob: new Blob(['x']),
  })
  if (!created.ok) throw new Error('строка не сохранилась')

  const outcome = await transport.send(created.item, { blob: null })
  assert.equal(outcome.kind, 'attention')
  assert.equal(calls.length, 0, 'пустой файл на сервер не уходит')
})

test('113D-7. экран очереди располагает подписью для каждого состояния', async () => {
  const { store } = makeStore()
  const pending = await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'а' } })
  if (!pending.ok) throw new Error('строка не сохранилась')

  const seen: string[] = []
  for (const status of ['pending', 'syncing', 'failed', 'attention', 'synced'] as const) {
    await store.setStatus(pending.item.id, status)
    const item = (await store.listQueue()).find((i) => i.id === pending.item.id)
      ?? { ...pending.item, status }
    seen.push(OFFLINE_SYNC_LABEL[syncStateOf(item)])
  }

  assert.deepEqual(seen, [
    'Ожидает отправки',
    'Синхронизация',
    'Ошибка отправки',
    'Требует внимания',
    'Синхронизировано',
  ])
  assert.equal(OFFLINE_SYNC_LABEL.savedLocally, 'Сохранено на устройстве')
})

test('113D-8. оболочка не подменяется страницей ошибки и регистрируется без push', async () => {
  const { readFileSync } = await import('node:fs')
  const sw = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8')
  // Кэш оболочки обновляется только успешным ответом: иначе страница 502 от
  // упавшего прокси осталась бы в кэше и после починки сервера.
  assert.match(sw, /response\.ok/, 'в кэш идёт только успешный ответ')

  // Пути от скомпилированного файла к исходникам: тест читает то, что поедет.
  const appShell = readFileSync(new URL('../../../src/mobile/offline/appShell.ts', import.meta.url), 'utf8')
  assert.match(appShell, /navigator\.serviceWorker\.register/, 'оболочка регистрирует SW сама')
  assert.doesNotMatch(appShell, /Notification|pushManager/, 'регистрация не зависит от разрешения на уведомления')

  const shell = readFileSync(new URL('../../../src/mobile/MobileShell.tsx', import.meta.url), 'utf8')
  assert.match(shell, /registerAppShellServiceWorker\(\)/, 'мобильная оболочка вызывает регистрацию')
})

test('113D-9. экраны не пишут в прежнюю очередь на localStorage', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const dir = new URL('../../../src/mobile/', import.meta.url)
  const screens = readdirSync(dir).filter((f) => f.endsWith('.tsx'))

  // Две очереди одновременно — это потерянная работа: счётчики читают одну,
  // отправка разбирает другую. Писать разрешено только в новый слой.
  const legacyWriters = /enqueueOfflineAction|enqueueOfflineStatusChange|retryOfflineQueue|retrySingleQueueItem/
  for (const file of screens) {
    const source = readFileSync(new URL(file, dir), 'utf8')
    assert.doesNotMatch(source, legacyWriters, `${file} обязан ставить работу через offline/runtime`)
  }
})

test('113D-10. обход открывается из копии, неотправленные отметки видны поверх неё', async () => {
  setOfflineDriverFactory(() => new MemoryDriver())
  const opened = await openOfflineSession({ id: 'user-1', companyId: 'co-1' }, { legacyStorage: null })
  const store = opened.store!
  assert.ok(store)

  await cacheRoundSnapshot({
    id: 'run-1',
    items: [
      { id: 'c-1', status: 'PENDING' },
      { id: 'c-2', status: 'PENDING' },
    ],
  })
  await store.enqueue({
    kind: 'checkpoint.update',
    target: { roundId: 'run-1', checkpointId: 'c-1' },
    payload: { status: 'ISSUE', comment: 'течь' },
  })

  const restored = await readRoundSnapshot<{ id: string; items: Array<{ id: string } & Record<string, unknown>> }>('run-1')
  assert.ok(restored, 'обход обязан открыться без сети')
  const first = restored.items.find((i) => i.id === 'c-1')!
  // Отметка лежит в очереди — экран обязан показать её, иначе техник
  // отметит чек-поинт второй раз.
  assert.equal(first.status, 'ISSUE')
  assert.equal(first.comment, 'течь')
  assert.equal(first.offlinePending, true)
  assert.equal(restored.items.find((i) => i.id === 'c-2')!.status, 'PENDING')

  await wipeOfflineSession({ id: 'user-1', companyId: 'co-1' })
  setOfflineDriverFactory(null)
})

test('113D-11. повторное создание заявки из чек-поинта не плодит вторую', async () => {
  setOfflineDriverFactory(() => new MemoryDriver())
  const opened = await openOfflineSession({ id: 'user-1', companyId: 'co-1' }, { legacyStorage: null })
  const store = opened.store!

  const target = { roundId: 'run-1', checkpointId: 'c-1', ticketId: `${LOCAL_ID_PREFIX}run-1:c-1` }
  const first = await store.enqueue({ kind: 'ticket.fromRound', target, payload: { categoryId: 'cat-1' }, producesTicketId: true })
  const second = await store.enqueue({ kind: 'ticket.fromRound', target, payload: { categoryId: 'cat-1', title: 'уточнение' }, producesTicketId: true })
  assert.ok(first.ok && second.ok)

  const queue = (await store.listQueue()).filter((i) => i.kind === 'ticket.fromRound')
  assert.equal(queue.length, 1, 'две заявки по одному чек-поинту не ставятся в очередь')
  assert.equal(queue[0].idempotencyKey, first.ok ? first.item.idempotencyKey : '', 'ключ не пересоздаётся')
  assert.equal((queue[0].payload as { title?: string }).title, 'уточнение', 'побеждает последнее описание')

  // Экран обхода узнаёт об отложенной заявке и прячет кнопку.
  const pending = await readPendingRoundTicketItemIds('run-1')
  assert.ok(pending.has('c-1'))

  await wipeOfflineSession({ id: 'user-1', companyId: 'co-1' })
  setOfflineDriverFactory(null)
})

test('113D-12. выход уносит и прежние кэши на localStorage', async () => {
  const { readFileSync } = await import('node:fs')
  const legacy = readFileSync(new URL('../../../src/mobile/offlineQueue.ts', import.meta.url), 'utf8')
  const profile = readFileSync(new URL('../../../src/mobile/MobileProfile.tsx', import.meta.url), 'utf8')

  // Доска и карточки заявок лежат там без разделения по пользователю:
  // на общем планшете следующий техник не должен увидеть чужие заявки.
  assert.match(legacy, /export function clearLegacyOfflineCaches/)
  for (const key of ['sm_mobile_offline_queue_v1', 'sm_mobile_board_cache_v1', 'sm_mobile_ticket_cache_v1']) {
    assert.ok(legacy.includes(key), `ключ ${key} обязан быть известен очистке`)
  }
  assert.match(profile, /clearLegacyOfflineCaches\(\)/, 'выход вызывает очистку')
  assert.match(profile, /wipeOfflineOnLogout\(/, 'выход стирает базу текущего пользователя')
  assert.match(profile, /hasUnsentWork\(\)/, 'о несинхронизированной работе предупреждают до удаления')
})

test('113D-13. мутации с офлайн-веткой не ставятся на паузу react-query', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const dir = new URL('../../../src/mobile/', import.meta.url)

  /*
   * react-query по умолчанию (networkMode: 'online') не вызывает mutationFn,
   * пока браузер считает себя офлайн: мутация ждёт связи. Для обычной мутации
   * это верно, но для той, что сама сохраняет работу на устройство, — гибельно:
   * офлайн-ветка внутри неё становится мёртвым кодом, отметка техника не
   * попадает ни на сервер, ни в очередь, а экран навсегда остаётся в
   * «Сохраняем…». Найдено живой приёмкой на Stage, не тестами.
   */
  const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'))
  const offenders: string[] = []

  for (const file of files) {
    const source = readFileSync(new URL(file, dir), 'utf8')
    // Каждый блок useMutation({...}) до его mutationFn.
    for (const match of source.matchAll(/useMutation\(\{([\s\S]{0,4000}?)\n  \}\)/g)) {
      const block = match[1]
      const handlesOffline = /!offline\.online|!isOnline|!getOnlineStatus\(\)|queueOffline\(|syncNow\(/.test(block)
      // Якорь на начало строки: иначе упоминание в комментарии внутри блока
      // сошло бы за объявление, и тест перестал бы что-либо проверять.
      const declared = /^\s*networkMode:\s*'always',/m.test(block)
      if (handlesOffline && !declared) {
        offenders.push(file)
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `мутации с офлайн-веткой обязаны объявить networkMode: 'always' — ${offenders.join(', ')}`,
  )
})

test('113D-14. личность для офлайна берётся из токена, когда сервер недоступен', async () => {
  const { identityFromToken } = await import('./identity.js')

  const payload = { sub: 'user-1', userId: 'user-1', companyId: 'co-1', role: 'TECHNICIAN' }
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64(payload)}.signature`

  assert.deepEqual(identityFromToken(token), { id: 'user-1', companyId: 'co-1' })
  // Без companyId пространство имён не построить — лучше отказать, чем
  // открыть общую на всех базу.
  assert.equal(identityFromToken(`${b64({})}.${b64({ sub: 'user-1' })}.s`), null)
  assert.equal(identityFromToken('мусор'), null)
  assert.equal(identityFromToken(''), null)
  assert.equal(identityFromToken(null), null)
})

test('113D-15. выход стирает открытую базу, даже если личность неизвестна', async () => {
  setOfflineDriverFactory(() => new MemoryDriver())
  const opened = await openOfflineSession({ id: 'user-1', companyId: 'co-1' }, { legacyStorage: null })
  const store = opened.store!
  await store.enqueue({ kind: 'ticket.comment', target: { ticketId: 'tk-1' }, payload: { comment: 'приватное' } })
  assert.equal((await store.listQueue()).length, 1)

  // Без сети `/auth/me` не отвечает, и выход вызывается без личности.
  // Данные предыдущего пользователя обязаны уйти всё равно.
  await wipeOfflineSession(null)

  assert.equal(currentOfflineStore(), null, 'сессия закрыта')
  assert.equal((await store.listQueue()).length, 0, 'данные стёрты, а не просто забыты')
  setOfflineDriverFactory(null)
})

test('113D-16. снимок заявки не запрещён отсутствием сети', async () => {
  const { readFileSync } = await import('node:fs')
  const page = readFileSync(new URL('../../../src/mobile/MobileTicketPage.tsx', import.meta.url), 'utf8')

  /*
   * Поля выбора файла нельзя прятать за `isOnline`. Очередь умеет принять
   * снимок без сети, но техник до неё не доберётся: у него просто нет кнопки.
   * Он стоит у неисправного оборудования в подвале — именно там снимок и
   * нужен, а вернувшись в зону покрытия, показывать уже нечего.
   * Найдено живой приёмкой на Stage.
   */
  assert.doesNotMatch(
    page,
    /canUploadTicketPhotos && isOnline/,
    'выбор файла не должен зависеть от наличия сети',
  )
  assert.match(page, /kind: 'ticket\.attachment'/, 'снимок ставится в очередь')
})

test('113D-17. неудачная попытка после возвращения связи повторяется сама', async () => {
  const { readFileSync } = await import('node:fs')
  const runtime = readFileSync(new URL('../../../src/mobile/offline/runtime.ts', import.meta.url), 'utf8')

  /*
   * Событие `online` приходит раньше, чем связь работает: первый запрос
   * падает с «Failed to fetch». Второго такого события в этот выход в зону
   * покрытия не будет. Без собственного повтора работа техника остаётся
   * на устройстве навсегда, а счётчик «Ожидает отправки» никогда не дойдёт
   * до нуля. Найдено живой приёмкой на Stage.
   */
  assert.match(runtime, /function scheduleRetry/, 'повтор назначается сам')
  assert.match(runtime, /status\.online && status\.pending > 0\) scheduleRetry\(\)/, 'повтор назначается после неудачного круга')
  assert.match(runtime, /RETRY_STEPS_MS/, 'паузы нарастают')
  // Без сети и после выхода таймер обязан сниматься, иначе он будет будить
  // разбор очереди для чужой или уже закрытой сессии.
  for (const place of [/window\.addEventListener\('offline'[\s\S]{0,220}cancelRetry\(\)/, /export function stopOffline\(\)\s*\{\s*cancelRetry\(\)/]) {
    assert.match(runtime, place)
  }
})

test('113D-18. повтор не превращается в вечный опрос сервера', async () => {
  const { readFileSync } = await import('node:fs')
  const sync = readFileSync(new URL('../../../src/mobile/offline/sync.ts', import.meta.url), 'utf8')
  // Автоповтор ограничен: после MAX_AUTO_ATTEMPTS строка уходит в «Ошибка
  // отправки» и ждёт человека. Иначе телефон в туннеле молотил бы вечно.
  assert.match(sync, /attempts >= MAX_AUTO_ATTEMPTS \? 'failed' : 'pending'/)
  const max = Number(/const MAX_AUTO_ATTEMPTS = (\d+)/.exec(sync)?.[1])
  assert.ok(max >= 2 && max <= 10, `разумный предел попыток, сейчас ${max}`)
})

test('113D-19. съёмка не выключается из-за недоступного /auth/me', async () => {
  const { readFileSync } = await import('node:fs')
  const page = readFileSync(new URL('../../../src/mobile/MobileTicketPage.tsx', import.meta.url), 'utf8')

  /*
   * Без сети `/auth/me` не отвечает, и роль из него пуста. Если разрешение
   * на съёмку считать только по нему, после перезагрузки в офлайне техник
   * увидит вкладку «Фото» без единой кнопки — при полностью рабочей очереди
   * под ней. Найдено живой приёмкой на Stage.
   *
   * Запасной источник роли — не расширение прав: сервер по-прежнему решает,
   * принять ли снимок.
   */
  const block = /const canUploadTicketPhotos = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[/.exec(page)?.[1] ?? ''
  assert.ok(block, 'блок разрешения найден')
  assert.match(block, /api\.getUserRole\(\)/, 'роль имеет запасной источник на время без сети')
})

test('113D-20. отказ сети не считается недействительной сессией', async () => {
  const { readFileSync } = await import('node:fs')
  const router = readFileSync(new URL('../../../src/router.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('../../../src/lib/api.ts', import.meta.url), 'utf8')

  /*
   * `/m` обёрнут RequireAuth. Production добавил туда проверку `/auth/me`, которая
   * стирала токен на ЛЮБОМ отказе. Для техника это разрушительно: первый запрос после
   * возвращения в зону покрытия падает штатно — радио ещё не поднялось, — и в этот
   * момент у человека с неотправленной работой пропадал токен. Очередь после этого
   * не уходит никогда: отправлять её нечем.
   *
   * Уводить на вход должен только явный отказ сервера. То же различие realtime уже
   * делает: сокет сбрасывает авторизацию на AUTH_INVALID и коде 1008.
   */
  assert.match(api, /export function isSessionRejected/, 'различие вынесено в общую функцию')
  assert.match(api, /error\.status === 401 \|\| error\.status === 403/, 'отказ сессии — это 401\/403')

  const guard = /function RequireAuth\(\{[\s\S]*?\n\}/.exec(router)?.[0] ?? ''
  assert.ok(guard, 'RequireAuth найден')
  assert.match(guard, /api\.isSessionRejected\(meQ\.error\)/, 'решение принимается по виду отказа')
  assert.match(guard, /if \(!sessionRejected\) return/, 'токен стирается только при отказе сессии')
  assert.doesNotMatch(guard, /if \(!meQ\.isError\) return/, 'любой отказ больше не стирает токен')
  /*
   * Заглушка «Проверяем доступ…» не должна показываться без сети. Живая приёмка
   * на Stage показала: `/auth/me` офлайн уходит в повторы и не отвечает никогда,
   * а экран держит техника снаружи его же сохранённой работы — она в этот момент
   * лежит на устройстве. Приложение после перезагрузки в офлайне не поднималось.
   */
  assert.match(guard, /navigator\.onLine !== false/, 'ожидание привязано к наличию связи')
  assert.match(guard, /meQ\.isPending && connected/, 'без сети оболочка рендерится сразу')
  assert.doesNotMatch(guard, /meQ\.isLoading \|\| meQ\.isError/, 'прежнее безусловное ожидание убрано')
})
