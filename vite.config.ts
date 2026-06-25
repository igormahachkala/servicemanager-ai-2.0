import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Dev-only proxy: браузер ходит на свой origin (localhost:5173), Vite проксирует
  // на стейдж-бэкенд → CORS не возникает, серверный CORS_ALLOWED_ORIGINS не трогаем.
  // Активен, когда VITE_API_BASE пуст (same-origin). Цель задаётся через VITE_API_PROXY.
  server: {
    proxy: {
      '/auth': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/tickets': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/technicians': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/timeline': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/uploads': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/locations': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/problem-categories': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/inspection': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/equipment': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
      '/analytics': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
})
