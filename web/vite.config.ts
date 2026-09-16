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
    exclude: ['**/node_modules/**', '**/dist/**', '**/offline/offline.test.ts'],
  },
  build: {
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
