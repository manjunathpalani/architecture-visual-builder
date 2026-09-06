import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'

export function oauthConfigPlugin(): Plugin {
  let env: Record<string, string> = {}
  return {
    name: 'oauth-config',
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir, '')
    },
    configureServer(server) {
      server.middlewares.use('/api/oauth/config', (_req: IncomingMessage, res: ServerResponse) => handle(res, env))
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/oauth/config', (_req: IncomingMessage, res: ServerResponse) => handle(res, env))
    },
  }
}

function handle(res: ServerResponse, env: Record<string, string>) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(
    JSON.stringify({
      microsoftClientId: (
        env.MS_CLIENT_ID ||
        env.VITE_MS_CLIENT_ID ||
        process.env.MS_CLIENT_ID ||
        process.env.VITE_MS_CLIENT_ID ||
        ''
      ).trim(),
      googleClientId: (
        env.GOOGLE_CLIENT_ID ||
        env.VITE_GOOGLE_CLIENT_ID ||
        process.env.GOOGLE_CLIENT_ID ||
        process.env.VITE_GOOGLE_CLIENT_ID ||
        ''
      ).trim(),
    }),
  )
}
