import { defineConfig } from 'vite'
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
