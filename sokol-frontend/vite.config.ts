/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiHost = env.VITE_DEV_API_HOST || '127.0.0.1'
  const apiPort = env.VITE_DEV_API_PORT || '8800'
  const devPort = Number(env.VITE_DEV_SERVER_PORT || 5180)

  return {
    plugins: [react()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
    server: {
      port: devPort,
      proxy: {
        '/api': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
