import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { xaiDiagramPlugin } from './server/xaiDiagramPlugin'

export default defineConfig({
  plugins: [react(), xaiDiagramPlugin()],
  server: {
    proxy: {
      '/api/github': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/github/, ''),
        secure: true,
      },
      '/api/azure': {
        target: 'https://dev.azure.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/azure/, ''),
        secure: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api/github': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/github/, ''),
        secure: true,
      },
      '/api/azure': {
        target: 'https://dev.azure.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/azure/, ''),
        secure: true,
      },
    },
  },
})