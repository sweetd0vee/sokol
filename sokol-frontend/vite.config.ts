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
            if (!httpServer || !('requestTimeout' in httpServer)) {
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
      // Bind IPv4 only: on Windows+WSL, `localhost` often resolves to ::1 and
      // hangs (ERR_CONNECTION_TIMED_OUT) while 127.0.0.1 works.
      host: env.VITE_DEV_SERVER_HOST || '127.0.0.1',
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
