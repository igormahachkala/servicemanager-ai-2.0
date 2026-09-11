/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113C.
 *
 * Драйвер хранилища. Слой очереди и кэшей говорит только с этим интерфейсом,
 * а не с IndexedDB напрямую.
 *
 * Причина не в тестируемости, хотя она и получается бесплатно. Настоящая
 * причина — обязательное требование «никогда не говорить технику, что работа
 * сохранена, если сохранить не удалось». Чтобы это соблюдать, нужен один
 * узкий шов, через который проходят все записи и на котором отказ хранилища
 * превращается в явный результат, а не в исключение где-то в глубине.
 *
 * Отсюда же второе: браузер без IndexedDB (приватный режим Safari, выключённое
 * хранилище) получает драйвер, который честно отвечает «не сохранил», вместо
 * тихого падения на localStorage. Молчаливый откат на localStorage был бы
 * хуже отказа: техник считал бы работу сохранённой.
 */

export type StoreName =
  | 'queue'
  | 'tickets'
  | 'rounds'
  | 'checkpoints'
  | 'locations'
  | 'blobs'
  | 'meta'

export const STORE_NAMES: StoreName[] = [
  'queue',
  'tickets',
  'rounds',
  'checkpoints',
  'locations',
  'blobs',
  'meta',
]

/** Запись всегда возвращает результат, а не бросает: отказ — это состояние. */
export type WriteResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unavailable' | 'failed'; message: string }

export interface OfflineDriver {
  readonly available: boolean
  get<T>(store: StoreName, key: string): Promise<T | null>
  getAll<T>(store: StoreName): Promise<T[]>
  put(store: StoreName, key: string, value: unknown): Promise<WriteResult>
  delete(store: StoreName, key: string): Promise<WriteResult>
  clear(store: StoreName): Promise<WriteResult>
  /** Полное удаление пространства имён — используется при выходе. */
  destroy(): Promise<void>
}

function classifyWriteError(error: unknown): WriteResult {
  const name = (error as { name?: string })?.name || ''
  const message = (error as { message?: string })?.message || String(error)
  // Переполнение квоты у разных браузеров называется по-разному.
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(message)) {
    return { ok: false, reason: 'quota', message: 'Недостаточно места на устройстве' }
  }
  return { ok: false, reason: 'failed', message }
}

/**
 * Драйвер-заглушка для среды без IndexedDB. Ничего не хранит и не притворяется,
 * что хранит: каждая запись — честный отказ.
 */
export class UnavailableDriver implements OfflineDriver {
  readonly available = false
  private readonly reason: string

  constructor(reason = 'Хранилище недоступно в этом браузере') {
    this.reason = reason
  }

  async get<T>(): Promise<T | null> {
    return null
  }
  async getAll<T>(): Promise<T[]> {
    return []
  }
  async put(): Promise<WriteResult> {
    return { ok: false, reason: 'unavailable', message: this.reason }
  }
  async delete(): Promise<WriteResult> {
    return { ok: false, reason: 'unavailable', message: this.reason }
  }
  async clear(): Promise<WriteResult> {
    return { ok: false, reason: 'unavailable', message: this.reason }
  }
  async destroy(): Promise<void> {
    /* нечего удалять */
  }
}

/**
 * Драйвер в памяти. Применяется в тестах и как поведенческий эталон:
 * IndexedDB-драйвер обязан вести себя так же.
 */
export class MemoryDriver implements OfflineDriver {
  readonly available = true
  private data = new Map<StoreName, Map<string, unknown>>()
  /** Для проверки поведения при переполнении: следующая запись отказывает. */
  failNextWrite: WriteResult | null = null

  private bucket(store: StoreName) {
    let b = this.data.get(store)
    if (!b) {
      b = new Map()
      this.data.set(store, b)
    }
    return b
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    return (this.bucket(store).get(key) as T) ?? null
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    return Array.from(this.bucket(store).values()) as T[]
  }

  async put(store: StoreName, key: string, value: unknown): Promise<WriteResult> {
    if (this.failNextWrite) {
      const r = this.failNextWrite
      this.failNextWrite = null
      return r
    }
    this.bucket(store).set(key, value)
    return { ok: true }
  }

  async delete(store: StoreName, key: string): Promise<WriteResult> {
    this.bucket(store).delete(key)
    return { ok: true }
  }

  async clear(store: StoreName): Promise<WriteResult> {
    this.bucket(store).clear()
    return { ok: true }
  }

  async destroy(): Promise<void> {
    this.data.clear()
  }
}

/** Драйвер поверх IndexedDB. Тонкий: вся логика живёт выше. */
export class IndexedDbDriver implements OfflineDriver {
  readonly available = true
  private dbPromise: Promise<IDBDatabase> | null = null

  private readonly dbName: string
  private readonly version: number

  constructor(dbName: string, version = 1) {
    this.dbName = dbName
    this.version = version
  }

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      request.onupgradeneeded = () => {
        const db = request.result
        for (const store of STORE_NAMES) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB заблокирована другой вкладкой'))
    })
    return this.dbPromise
  }

  private async run<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    const db = await this.open()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode)
      const request = fn(tx.objectStore(store))
      request.onsuccess = () => resolve(request.result as T)
      request.onerror = () => reject(request.error)
      tx.onabort = () => reject(tx.error)
    })
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    try {
      const value = await this.run<T>(store, 'readonly', (s) => s.get(key))
      return value ?? null
    } catch {
      return null
    }
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    try {
      return (await this.run<T[]>(store, 'readonly', (s) => s.getAll())) ?? []
    } catch {
      return []
    }
  }

  async put(store: StoreName, key: string, value: unknown): Promise<WriteResult> {
    try {
      await this.run(store, 'readwrite', (s) => s.put(value, key))
      return { ok: true }
    } catch (error) {
      return classifyWriteError(error)
    }
  }

  async delete(store: StoreName, key: string): Promise<WriteResult> {
    try {
      await this.run(store, 'readwrite', (s) => s.delete(key))
      return { ok: true }
    } catch (error) {
      return classifyWriteError(error)
    }
  }

  async clear(store: StoreName): Promise<WriteResult> {
    try {
      await this.run(store, 'readwrite', (s) => s.clear())
      return { ok: true }
    } catch (error) {
      return classifyWriteError(error)
    }
  }

  async destroy(): Promise<void> {
    try {
      const db = await this.open()
      db.close()
    } catch {
      /* база могла не открыться — удаляем всё равно */
    }
    this.dbPromise = null
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(this.dbName)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }
}

/** Выбор драйвера. Отсутствие IndexedDB не маскируется под успех. */
export function createDriver(dbName: string): OfflineDriver {
  try {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      return new UnavailableDriver()
    }
    return new IndexedDbDriver(dbName)
  } catch (error) {
    return new UnavailableDriver((error as Error)?.message)
  }
}
