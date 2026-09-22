import { describe, expect, it } from 'vitest'

import {
  isDynamicImportFailure,
  MOBILE_CHUNK_RECOVERY_MESSAGE,
} from './lazyRouteFailure'

describe('mobile lazy route recovery', () => {
  it.each([
    new TypeError('Importing a module script failed.'),
    new TypeError('Failed to fetch dynamically imported module: /assets/MobileTicketPage-abc.js'),
    new Error('Error loading dynamically imported module'),
    Object.assign(new Error('Loading chunk 17 failed'), { name: 'ChunkLoadError' }),
  ])('recognizes Safari and bundler chunk failures', (error) => {
    expect(isDynamicImportFailure(error)).toBe(true)
  })

  it('does not hide ordinary application errors', () => {
    expect(isDynamicImportFailure(new Error('HTTP 403'))).toBe(false)
  })

  it('provides a clear Russian recovery message', () => {
    expect(MOBILE_CHUNK_RECOVERY_MESSAGE).toBe(
      'Экран не удалось загрузить. Подключитесь к интернету и нажмите «Повторить».',
    )
  })
})
