const DYNAMIC_IMPORT_FAILURE = [
  /importing a module script failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /chunkloaderror/i,
  /loading chunk .* failed/i,
]

export const MOBILE_CHUNK_RECOVERY_MESSAGE =
  'Экран не удалось загрузить. Подключитесь к интернету и нажмите «Повторить».'

export function isDynamicImportFailure(error: unknown): boolean {
  const name = typeof error === 'object' && error && 'name' in error
    ? String((error as { name?: unknown }).name || '')
    : ''
  const message = error instanceof Error ? error.message : String(error || '')
  return name === 'ChunkLoadError' || DYNAMIC_IMPORT_FAILURE.some((pattern) => pattern.test(message))
}
