import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/** Jira Cloud site subdomain: letters, digits, hyphens. */
const SITE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

export function jiraProxyPlugin(): Plugin {
  return {
    name: 'jira-proxy',
    configureServer(server) {
      server.middlewares.use('/api/jira', createHandler())
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/jira', createHandler())
    },
  }
}

function createHandler() {
  return (req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res).catch((err) => {
      if (res.headersSent) return
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ message: err instanceof Error ? err.message : 'Jira proxy failed' }))
    })
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  let url = req.url ?? '/'
  if (url.startsWith('/api/jira/')) url = url.slice('/api/jira'.length)
  else if (url.startsWith('/api/jira')) url = url.slice('/api/jira'.length) || '/'
  const match = url.match(/^\/([^/?]+)(\/[^?]*)?(\?.*)?$/)
  if (!match) {
    json(res, 400, { message: 'Missing Jira site in /api/jira/{site}/...' })
    return
  }

  const site = match[1]
  const restPath = `${match[2] || '/'}${match[3] || ''}`
  if (!SITE_RE.test(site)) {
    json(res, 400, { message: 'Invalid Jira site. Use the Atlassian subdomain only.' })
    return
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const method = (req.method ?? 'GET').toUpperCase()

  const upstream = await fetch(`https://${site}.atlassian.net${restPath}`, {
    method,
    headers: {
      Authorization: String(req.headers.authorization ?? ''),
      Accept: String(req.headers.accept ?? 'application/json'),
      'Content-Type': String(req.headers['content-type'] ?? 'application/json'),
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
