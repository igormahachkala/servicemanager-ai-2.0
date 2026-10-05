export type PersistentStorageResult = 'granted' | 'denied' | 'unsupported'

type PersistentStorageApi = {
  persist?: () => Promise<boolean>
  persisted?: () => Promise<boolean>
}

/**
 * Запрашивается во всех браузерах через feature detection. Отказ не означает,
 * что IndexedDB недоступна: хранилище остаётся best-effort и проверяется
 * обычными результатами записи.
 */
export async function requestPersistentStorage(
  storage: PersistentStorageApi | null | undefined =
    typeof navigator === 'undefined' ? null : navigator.storage,
): Promise<PersistentStorageResult> {
  if (!storage) return 'unsupported'

  try {
    if (await storage.persisted?.()) return 'granted'
    if (!storage.persist) return 'unsupported'
    return (await storage.persist()) ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}
