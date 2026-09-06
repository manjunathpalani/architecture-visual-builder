import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { xaiDiagramPlugin } from './server/xaiDiagramPlugin'
import { jiraProxyPlugin } from './server/jiraProxyPlugin'
import { saasProxyPlugin } from './server/saasProxyPlugin'
import { oauthConfigPlugin } from './server/oauthConfigPlugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['MS_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'VITE_MS_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID']) {
    if (env[key] && process.env[key] === undefined) process.env[key] = env[key]
  }

  return {
  plugins: [react(), xaiDiagramPlugin(), jiraProxyPlugin(), saasProxyPlugin(), oauthConfigPlugin()],
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
      '/api/graph': {
        target: 'https://graph.microsoft.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graph/, ''),
        secure: true,
      },
      '/api/ms-oauth': {
        target: 'https://login.microsoftonline.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ms-oauth/, ''),
        secure: true,
      },
      '/api/gapi': {
        target: 'https://www.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gapi/, ''),
        secure: true,
      },
      '/api/google-oauth': {
        target: 'https://oauth2.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google-oauth/, ''),
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
      '/api/graph': {
        target: 'https://graph.microsoft.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graph/, ''),
        secure: true,
      },
      '/api/ms-oauth': {
        target: 'https://login.microsoftonline.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ms-oauth/, ''),
        secure: true,
      },
      '/api/gapi': {
        target: 'https://www.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gapi/, ''),
        secure: true,
      },
      '/api/google-oauth': {
        target: 'https://oauth2.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google-oauth/, ''),
        secure: true,
      },
    },
  },
  }
})