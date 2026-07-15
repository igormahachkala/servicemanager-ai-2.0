import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
