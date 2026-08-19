/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { DOCX_TOOL_TIMEOUT_MS } from './src/utils/docx'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiHost = env.VITE_DEV_API_HOST || '127.0.0.1'
  const apiPort = env.VITE_DEV_API_PORT || '8800'
  const devPort = Number(env.VITE_DEV_SERVER_PORT || 5180)

  return {
    plugins: [
      react(),
      {
        name: 'long-running-docx-proxy',
        configureServer(server) {
          const apply = () => {
            const httpServer = server.httpServer
            if (!httpServer) {
              return
            }
            httpServer.requestTimeout = 0
            httpServer.headersTimeout = 0
            httpServer.timeout = 0
          }
          apply()
          server.httpServer?.on('listening', apply)
        },
      },
    ],
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
          timeout: DOCX_TOOL_TIMEOUT_MS,
          proxyTimeout: DOCX_TOOL_TIMEOUT_MS,
        },
      },
    },
  }
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiHost = env.VITE_DEV_API_HOST || '127.0.0.1'
  const apiPort = env.VITE_DEV_API_PORT || '8800'
  const devPort = Number(env.VITE_DEV_SERVER_PORT || 5180)

  return {
    plugins: [
      react(),
      {
        name: 'long-running-docx-proxy',
        configureServer(server) {
          const apply = () => {
            const httpServer = server.httpServer
            if (!httpServer) {
              return
            }
            httpServer.requestTimeout = 0
            httpServer.headersTimeout = 0
            httpServer.timeout = 0
          }
          apply()
          server.httpServer?.on('listening', apply)
        },
      },
    ],
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
          timeout: 600_000,
          proxyTimeout: 600_000,
        },
      },
    },
  }
})
