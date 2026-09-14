/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113C.
 *
 * Жизненный цикл offline-сессии: открытие под конкретного пользователя,
 * смена пользователя, выход.
 *
 * Изоляция сделана на уровне базы, а не на уровне ключей: у каждой пары
 * компания+пользователь своя база IndexedDB. Так «не показать чужое»
 * перестаёт зависеть от того, что каждый запрос не забыл подставить фильтр.
 * Выход сводится к удалению базы целиком.
 *
 * Токенов и паролей здесь нет и быть не может: в хранилище уходят только
 * операционные данные. Токен живёт там же, где жил, — этот слой его не видит.
 */

import { createDriver, MemoryDriver, UnavailableDriver, type OfflineDriver } from './driver.js'
import { OfflineStore } from './store.js'
import { migrateLegacyQueue, type MigrationReport } from './migration.js'
import { offlineDatabaseName, offlineNamespace } from './types.js'

export type OfflineIdentity = { id?: string | null; companyId?: string | null } | null | undefined

export type OpenResult = {
  store: OfflineStore | null
  namespace: string | null
  available: boolean
  migration?: MigrationReport
  /** Русское объяснение, если офлайн-режим недоступен. */
  unavailableReason?: string
}

let current: { namespace: string; store: OfflineStore } | null = null

/** Подменяется в тестах: драйвер в памяти вместо IndexedDB. */
export type DriverFactory = (dbName: string) => OfflineDriver
let driverFactory: DriverFactory = createDriver

export function setOfflineDriverFactory(factory: DriverFactory | null) {
  driverFactory = factory ?? createDriver
}

export function currentOfflineStore(): OfflineStore | null {
  return current?.store ?? null
}

export function currentOfflineNamespace(): string | null {
  return current?.namespace ?? null
}

/**
 * Открыть хранилище под пользователя. Если открыт другой пользователь,
 * его хранилище сначала закрывается — данные предыдущей личности не должны
 * оказаться видны следующей.
 */
export async function openOfflineSession(
  identity: OfflineIdentity,
  options: { legacyStorage?: Pick<Storage, 'getItem' | 'removeItem'> | null } = {},
): Promise<OpenResult> {
  const namespace = offlineNamespace(identity)
  if (!namespace) {
    await closeOfflineSession()
    return { store: null, namespace: null, available: false, unavailableReason: 'Пользователь не определён' }
  }

  if (current && current.namespace !== namespace) {
    // Смена пользователя на том же устройстве.
    await closeOfflineSession()
  }

  if (!current) {
    const driver = driverFactory(offlineDatabaseName(namespace))
    current = { namespace, store: new OfflineStore(driver, namespace) }
  }

  const store = current.store
  if (!store.available) {
    return {
      store,
      namespace,
      available: false,
      unavailableReason:
        'Хранилище недоступно: работа в офлайне не сохранится. Проверьте настройки браузера.',
    }
  }

  const legacyStorage =
    options.legacyStorage !== undefined
      ? options.legacyStorage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null
  const migration = await migrateLegacyQueue(store, legacyStorage)

  return { store, namespace, available: true, migration }
}

/**
 * Закрыть сессию, не удаляя данные. Применяется при смене пользователя:
 * данные прежнего остаются в его базе и недоступны текущему.
 */
export async function closeOfflineSession(): Promise<void> {
  current = null
}

/**
 * Выход из учётной записи. Данные удаляются: на общем устройстве работа
 * предыдущего техника не должна пережить выход.
 *
 * Незавершённая очередь при этом теряется — это осознанный выбор в пользу
 * приватности. Предупредить о непереданной работе должен интерфейс, до того
 * как выход подтверждён.
 */
export async function wipeOfflineSession(identity: OfflineIdentity): Promise<void> {
  const namespace = offlineNamespace(identity)

  // Открытая сессия стирается всегда, даже если личность не передали.
  // Без сети `/auth/me` не отвечает, и вызывающий код вполне может её не
  // знать — а выход обязан унести данные предыдущего пользователя в любом
  // случае. Прежняя версия при identity === null просто забывала ссылку,
  // оставляя базу на общем планшете следующему человеку.
  if (current && (!namespace || current.namespace === namespace)) {
    await current.store.destroy()
    current = null
    if (!namespace) return
  }

  if (namespace) {
    const driver = driverFactory(offlineDatabaseName(namespace))
    await new OfflineStore(driver, namespace).destroy()
  }
  if (current) current = null
}

export { MemoryDriver, UnavailableDriver }
