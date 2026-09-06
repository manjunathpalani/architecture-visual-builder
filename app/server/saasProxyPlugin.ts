import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const PROVIDERS = new Set(['dynamics', 'salesforce'])

const HOST_RULES: Record<string, RegExp> = {
  dynamics: /^[a-z0-9][a-z0-9.-]*\.dynamics\.com$/i,
  salesforce: /^[a-z0-9][a-z0-9.-]*\.(salesforce|force|cloudforce)\.com$/i,
}

export function saasProxyPlugin(): Plugin {
  return {
    name: 'saas-proxy',
    configureServer(server) {
      server.middlewares.use('/api/saas', createHandler())
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/saas', createHandler())
    },
  }
}

function createHandler() {
  return (req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res).catch((err) => {
      if (res.headersSent) return
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ message: err instanceof Error ? err.message : 'SaaS proxy failed' }))
    })
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  let url = req.url ?? '/'
  if (url.startsWith('/api/saas/')) url = url.slice('/api/saas'.length)
  else if (url.startsWith('/api/saas')) url = url.slice('/api/saas'.length) || '/'

  const match = url.match(/^\/([^/?]+)\/([^/?]+)(\/[^?]*)?(\?.*)?$/)
  if (!match) {
    json(res, 400, { message: 'Use /api/saas/{provider}/{host}/...' })
    return
  }

  const provider = match[1].toLowerCase()
  const host = decodeURIComponent(match[2])
  const restPath = `${match[3] || '/'}${match[4] || ''}`
  const rule = HOST_RULES[provider]

  if (!PROVIDERS.has(provider) || !rule) {
    json(res, 400, { message: 'Unsupported SaaS provider' })
    return
  }
  if (!rule.test(host)) {
    json(res, 400, { message: `Invalid ${provider} host` })
    return
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const method = (req.method ?? 'GET').toUpperCase()

  const upstream = await fetch(`https://${host}${restPath}`, {
    method,
    headers: {
      Authorization: String(req.headers.authorization ?? ''),
      Accept: String(req.headers.accept ?? 'application/json'),
      'Content-Type': String(req.headers['content-type'] ?? 'application/json'),
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Prefer: String(req.headers.prefer ?? 'odata.include-annotations="*"'),
      'User-Agent': 'Architecture-Visual-Builder',
    },
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  })

  res.statusCode = upstream.status
  const contentType = upstream.headers.get('content-type')
  if (contentType) res.setHeader('Content-Type', contentType)
  res.end(Buffer.from(await upstream.arrayBuffer()))
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
