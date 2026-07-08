import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ollamaDevRelay = {
  '/runtime/ollama': {
    target: 'http://127.0.0.1:11434',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/runtime\/ollama/, ''),
  },
} as const

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    proxy: ollamaDevRelay,
  },
  preview: {
    port: 4174,
    host: true,
    proxy: ollamaDevRelay,
  },
})
