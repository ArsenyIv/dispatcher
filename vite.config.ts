import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const mock = process.env.MOCK_URL ?? 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
    server: {
    proxy: {
      '/api': mock,
      '/debug': mock,
      '/ws': { target: mock.replace(/^http/, 'ws'), ws: true },
    },
  }})
