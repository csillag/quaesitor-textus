import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Resolve workspace libs to TS source for instant cross-package HMR.
  resolve: { conditions: ['development'] },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
})
