import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { xaiDiagramPlugin } from './server/xaiDiagramPlugin'
import { jiraProxyPlugin } from './server/jiraProxyPlugin'

export default defineConfig({
  plugins: [react(), xaiDiagramPlugin(), jiraProxyPlugin()],
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
})