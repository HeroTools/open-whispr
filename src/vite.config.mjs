import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Use relative paths for file:// protocol in Electron
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    port: 5174,
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
})
