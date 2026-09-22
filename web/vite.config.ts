import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function vendorChunk(id: string) {
  if (!id.includes('node_modules')) return undefined
  if (
    id.includes('/react-dom/') ||
    id.includes('/react/') ||
    id.includes('/scheduler/') ||
    id.includes('/react-router')
  ) {
    return 'react-vendor'
  }
  if (id.includes('/@tanstack/react-query') || id.includes('/@tanstack/query-core')) {
    return 'query'
  }
  return undefined
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/offline/offline.test.ts',
      /**
       * Сборка офлайн-тестов: test:offline компилирует их сюда и запускает
       * через node --test. Vitest подбирал этот .js как свой набор и падал
       * «No test suite found» — то есть npm test ломался после test:offline,
       * хотя оба набора зелёные. Порядок команд в проверке значения иметь
       * не должен.
       */
      '**/.offline-test-build/**',
    ],
  },
  build: {
    // The Service Worker reads this manifest during install and precaches every
    // hashed route chunk. iOS may otherwise open the shell successfully and
    // fail only when a previously unopened lazy route is needed offline.
    manifest: 'asset-manifest.json',
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  server: {
    allowedHosts: [
      'servicemanagerai.ru',
      'api.servicemanagerai.ru',
      'app.servicemanagerai.ru',
      'max.servicemanagerai.ru',
      'stage.sma-assistants.ru',
    ],
  },
  preview: {
    allowedHosts: [
      'servicemanagerai.ru',
      'api.servicemanagerai.ru',
      'app.servicemanagerai.ru',
      'max.servicemanagerai.ru',
      'stage.sma-assistants.ru',
    ],
  },
})
