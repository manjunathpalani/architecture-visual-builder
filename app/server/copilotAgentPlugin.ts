import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

let clientPromise: Promise<unknown> | null = null

export function copilotAgentPlugin(): Plugin {
  return {
    name: 'copilot-agent-proxy',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '')
      server.middlewares.use('/api/agent', createHandler(env))
    },
    configurePreviewServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '')
      server.middlewares.use('/api/agent', createHandler(env))
    },
  }
}

function createHandler(env: Record<string, string>) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? '/'
    if (req.method === 'GET' && (url === '/status' || url === '/status/')) {
      handleStatus(res, env)
      return
    }
    if (req.method === 'POST' && (url === '/run' || url === '/run/')) {
      void handleRun(req, res, env)
      return
    }
    next()
  }
}

function envValue(env: Record<string, string>, name: string): string {
  return (process.env[name] || env[name] || '').trim()
}

function handleStatus(res: ServerResponse, env: Record<string, string>) {
  const workspace = envValue(env, 'COPILOT_WORKSPACE')
  const cliPath = envValue(env, 'COPILOT_CLI_PATH')
  json(res, 200, {
    available: Boolean(workspace || cliPath),
    workspace: workspace || undefined,
    cliPath: cliPath || undefined,
  })
}

async function handleRun(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let body: {
    prompt?: string
    gitHubToken?: string
    owner?: string
    repo?: string
    branch?: string
    workingDirectory?: string
  }
  try {
    body = JSON.parse(await readBody(req)) as typeof body
  } catch {
    json(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const prompt = body.prompt?.trim() ?? ''
  if (!prompt) {
    json(res, 400, { error: 'Agent instruction is empty.' })
    return
  }
  if (prompt.length > 80_000) {
    json(res, 400, { error: 'Agent instruction is too large to send in one pass.' })
    return
  }

  const workspace = body.workingDirectory?.trim() || envValue(env, 'COPILOT_WORKSPACE')
  const token = body.gitHubToken?.trim() || envValue(env, 'GITHUB_TOKEN') || envValue(env, 'GH_TOKEN')
  const owner = body.owner?.trim()
  const repo = body.repo?.trim()
  const branch = body.branch?.trim() || 'main'

  try {
    const { CopilotClient, approveAll } = await import('@github/copilot-sdk')
    if (!clientPromise) {
      const client = new CopilotClient({
        gitHubToken: token || undefined,
        workingDirectory: workspace || undefined,
        logLevel: 'error',
      })
      clientPromise = client.start().then(() => client)
    }
    const client = (await clientPromise) as InstanceType<typeof CopilotClient>
    const session = await client.createSession({
      model: 'auto',
      gitHubToken: token || undefined,
      workingDirectory: workspace || undefined,
      onPermissionRequest: approveAll,
      ...(owner && repo
        ? { cloud: { repository: { owner, name: repo, branch } } }
        : {}),
    })

    let remoteUrl: string | undefined
    session.on('session.info', (event: { data?: { infoType?: string; url?: string } }) => {
      if (event.data?.infoType === 'remote' && event.data.url) remoteUrl = event.data.url
    })

    await session.send({ prompt })
    json(res, 200, {
      sessionId: session.sessionId,
      url: remoteUrl,
      started: true,
    })
  } catch (err) {
    clientPromise = null
    json(res, 503, {
      error:
        err instanceof Error
          ? err.message
          : 'Copilot agent could not start. Install GitHub Copilot CLI or set COPILOT_CLI_PATH.',
    })
  }
}

function json(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
