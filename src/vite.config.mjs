import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_DEV_SERVER_PORT = 5183

const parseDevServerPort = (rawPort) => {
  const normalizedPort = rawPort || String(DEFAULT_DEV_SERVER_PORT)
  const parsedPort = Number(normalizedPort)

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    return DEFAULT_DEV_SERVER_PORT
  }

  return parsedPort
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '..')
  const env = loadEnv(mode, envDir, '')
  const rawPort = env.VITE_DEV_SERVER_PORT || env.OPENWHISPR_DEV_SERVER_PORT
  const devServerPort = parseDevServerPort(rawPort)

  return {
    plugins: [react(), tailwindcss()],
    base: './', // Use relative paths for file:// protocol in Electron
    envDir, // Load .env from project root
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      port: devServerPort,
      strictPort: true,
      host: '127.0.0.1', // Use IP address instead of localhost for Neon Auth CORS
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        external: [
          'electron',
          'fs',
          'path',
          'child_process',
          'https',
          'http',
          'crypto',
          'os',
          'stream',
          'util',
          'zlib',
          'tar',
          'unzipper',
          '@aws-sdk/client-s3'
        ]
      }
    }
  }
})
