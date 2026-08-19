import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { completeDiagram, type AiProviderId } from './aiEngines'

const PROVIDERS: Array<{
  id: AiProviderId
  label: string
  recommended?: boolean
  envKey: string
  envModel?: string
  defaultModel: string
  extraEnv?: Array<'endpoint' | 'deployment'>
}> = [
  { id: 'spacexai', label: 'SpaceXAI', recommended: true, envKey: 'XAI_API_KEY', envModel: 'XAI_MODEL', defaultModel: 'grok-4.6' },
  { id: 'openai', label: 'OpenAI', envKey: 'OPENAI_API_KEY', envModel: 'OPENAI_MODEL', defaultModel: 'gpt-4o' },
  { id: 'anthropic', label: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', envModel: 'ANTHROPIC_MODEL', defaultModel: 'claude-sonnet-4-5' },
  { id: 'gemini', label: 'Gemini', envKey: 'GEMINI_API_KEY', envModel: 'GEMINI_MODEL', defaultModel: 'gemini-2.5-flash' },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    envKey: 'AZURE_OPENAI_API_KEY',
    envModel: 'AZURE_OPENAI_DEPLOYMENT',
    defaultModel: 'gpt-4o',
    extraEnv: ['endpoint', 'deployment'],
  },
]

const PROVIDER_IDS = new Set(PROVIDERS.map((p) => p.id))

export function xaiDiagramPlugin(): Plugin {
  return {
    name: 'xai-diagram-proxy',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '')
      server.middlewares.use('/api/ai', createHandler(env))
    },
    configurePreviewServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '')
      server.middlewares.use('/api/ai', createHandler(env))
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
    if (req.method === 'POST' && (url === '/diagram' || url === '/diagram/')) {
      void handleDiagram(req, res, env)
      return
    }
    next()
  }
}

function envValue(env: Record<string, string>, name: string): string {
  return (process.env[name] || env[name] || '').trim()
}

function handleStatus(res: ServerResponse, env: Record<string, string>) {
  json(res, 200, {
    available: true,
    defaultProvider: 'spacexai',
    providers: PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      model: envValue(env, provider.envModel ?? '') || provider.defaultModel,
      configured: Boolean(
        envValue(env, provider.envKey) || (provider.id === 'gemini' ? envValue(env, 'GOOGLE_API_KEY') : ''),
      ),
      recommended: provider.recommended,
    })),
  })
}

async function handleDiagram(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let body: {
    prompt?: string
    context?: string
    provider?: string
    apiKey?: string
    model?: string
    azureEndpoint?: string
    azureDeployment?: string
    images?: Array<{ mimeType?: string; dataUrl?: string; name?: string }>
  }
  try {
    body = JSON.parse(await readBody(req)) as typeof body
  } catch {
    json(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const providerId = (body.provider ?? 'spacexai') as AiProviderId
  const provider = PROVIDERS.find((p) => p.id === providerId)
  if (!provider || !PROVIDER_IDS.has(providerId)) {
    json(res, 400, { error: 'Unknown AI engine' })
    return
  }

  const prompt = body.prompt?.trim() ?? ''
  const images = sanitizeImages(body.images)
  if (!prompt && images.length === 0) {
    json(res, 400, { error: 'Enter a prompt or attach an architecture image' })
    return
  }
  if (prompt.length > 8000) {
    json(res, 400, { error: 'Prompt is too long (max 8000 characters)' })
    return
  }

  const apiKey =
    envValue(env, provider.envKey) ||
    (provider.id === 'gemini' ? envValue(env, 'GOOGLE_API_KEY') : '') ||
    body.apiKey?.trim() ||
    ''
  if (!apiKey) {
    json(res, 401, {
      error: `No ${provider.label} key configured. Set ${provider.envKey} in app/.env or paste a key in AI Engines.`,
    })
    return
  }

  const model = body.model?.trim() || envValue(env, provider.envModel ?? '') || provider.defaultModel
  const azureEndpoint = body.azureEndpoint?.trim() || envValue(env, 'AZURE_OPENAI_ENDPOINT')
  const azureDeployment = body.azureDeployment?.trim() || envValue(env, 'AZURE_OPENAI_DEPLOYMENT')

  try {
    const text = await completeDiagram({
      provider: providerId,
      prompt,
      context: body.context,
      images,
      apiKey,
      model,
      azureEndpoint,
      azureDeployment,
    })
    json(res, 200, { text, model, provider: providerId })
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 502
    json(res, Number.isFinite(status) && status >= 400 ? status : 502, {
      error: err instanceof Error ? err.message : `${provider.label} request failed`,
    })
  }
}

function sanitizeImages(
  raw?: Array<{ mimeType?: string; dataUrl?: string }>,
): Array<{ mimeType: 'image/jpeg' | 'image/png'; dataUrl: string }> {
  if (!Array.isArray(raw)) return []
  const images: Array<{ mimeType: 'image/jpeg' | 'image/png'; dataUrl: string }> = []
  for (const item of raw.slice(0, 4)) {
    const dataUrl = item.dataUrl?.trim() ?? ''
    if (!dataUrl.startsWith('data:image/')) continue
    const mimeType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
    if (dataUrl.length > 3_500_000) continue
    images.push({ mimeType, dataUrl })
  }
  return images
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 12 * 1024 * 1024) {
        reject(new Error('Request is too large'))
        req.destroy()
        return
      }
      chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
