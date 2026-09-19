import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { completeAnalysis, completeDiagram, completeInstruction, completeRequirements, completeSad, verifyProviderKey, type AiProviderId } from './aiEngines'

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
  { id: 'copilot', label: 'GitHub Copilot', envKey: 'GITHUB_TOKEN', envModel: 'COPILOT_MODEL', defaultModel: 'openai/gpt-4o' },
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
    if (req.method === 'POST' && (url === '/analyze' || url === '/analyze/')) {
      void handleAnalyze(req, res, env)
      return
    }
    if (req.method === 'POST' && (url === '/instruct' || url === '/instruct/')) {
      void handleInstruct(req, res, env)
      return
    }
    if (req.method === 'POST' && (url === '/requirements' || url === '/requirements/')) {
      void handleRequirements(req, res, env)
      return
    }
    if (req.method === 'POST' && (url === '/sad' || url === '/sad/')) {
      void handleSad(req, res, env)
      return
    }
    if (req.method === 'POST' && (url === '/verify' || url === '/verify/')) {
      void handleVerify(req, res, env)
      return
    }
    next()
  }
}

function envValue(env: Record<string, string>, name: string): string {
  return (process.env[name] || env[name] || '').trim()
}

function copilotToken(env: Record<string, string>): string {
  return envValue(env, 'GITHUB_COPILOT_TOKEN') || envValue(env, 'GITHUB_TOKEN') || envValue(env, 'GH_TOKEN')
}

function engineApiKey(
  env: Record<string, string>,
  provider: { id: AiProviderId; envKey: string },
  pasted?: string,
): string {
  return (
    pasted?.trim() ||
    envValue(env, provider.envKey) ||
    (provider.id === 'gemini' ? envValue(env, 'GOOGLE_API_KEY') : '') ||
    (provider.id === 'copilot' ? copilotToken(env) : '')
  )
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
        envValue(env, provider.envKey) ||
          (provider.id === 'gemini' ? envValue(env, 'GOOGLE_API_KEY') : '') ||
          (provider.id === 'copilot' && copilotToken(env)),
      ),
      recommended: provider.recommended,
    })),
  })
}

async function handleVerify(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let body: {
    provider?: string
    apiKey?: string
    useServer?: boolean
    azureEndpoint?: string
    azureDeployment?: string
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
    json(res, 400, { ok: false, error: 'Unknown AI engine' })
    return
  }

  const provided = body.apiKey?.trim() ?? ''
  const apiKey = provided || (body.useServer ? engineApiKey(env, provider) : '')
  if (!apiKey) {
    json(res, 400, {
      ok: false,
      error: `No ${provider.label} key to test. Paste a key or configure ${provider.envKey}.`,
    })
    return
  }

  const azureEndpoint = body.azureEndpoint?.trim() || envValue(env, 'AZURE_OPENAI_ENDPOINT')
  const azureDeployment = body.azureDeployment?.trim() || envValue(env, 'AZURE_OPENAI_DEPLOYMENT')

  const result = await verifyProviderKey({
    provider: providerId,
    apiKey,
    azureEndpoint,
    azureDeployment,
  })
  json(res, 200, {
    ok: result.ok,
    message: result.message,
    error: result.ok ? undefined : result.message,
    provider: providerId,
    source: provided ? 'browser' : 'server',
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

  const apiKey = engineApiKey(env, provider, body.apiKey)
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

async function handleAnalyze(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let body: {
    prompt?: string
    context?: string
    provider?: string
    apiKey?: string
    model?: string
    azureEndpoint?: string
    azureDeployment?: string
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

  const context = body.context?.trim() ?? ''
  if (!context) {
    json(res, 400, { error: 'Add systems to the canvas before running capability analysis.' })
    return
  }
  if (context.length > 20000) {
    json(res, 400, { error: 'Architecture context is too large to analyze in one pass.' })
    return
  }

  const prompt = (body.prompt?.trim() || 'Analyze this architecture as enterprise capabilities. Show pros and cons.').slice(0, 4000)

  const apiKey = engineApiKey(env, provider, body.apiKey)
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
    const text = await completeAnalysis({
      provider: providerId,
      prompt,
      context,
      apiKey,
      model,
      azureEndpoint,
      azureDeployment,
    })
    json(res, 200, { text, model, provider: providerId })
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 502
    json(res, Number.isFinite(status) && status >= 400 ? status : 502, {
      error: err instanceof Error ? err.message : `${provider.label} analysis failed`,
    })
  }
}

async function handleInstruct(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let body: {
    prompt?: string
    context?: string
    provider?: string
    apiKey?: string
    model?: string
    azureEndpoint?: string
    azureDeployment?: string
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

  const context = body.context?.trim() ?? ''
  if (!context) {
    json(res, 400, { error: 'Add a component and design context before generating an instruction.' })
    return
  }
  if (context.length > 24000) {
    json(res, 400, { error: 'Design context is too large to generate in one pass.' })
    return
  }

  const prompt = (
    body.prompt?.trim() ||
    'Write a self-contained coding-agent instruction for this component, including code path, where to add, and where to update.'
  ).slice(0, 4000)

  const apiKey = engineApiKey(env, provider, body.apiKey)
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
    const text = await completeInstruction({
      provider: providerId,
      prompt,
      context,
      apiKey,
      model,
      azureEndpoint,
      azureDeployment,
    })
    json(res, 200, { text, model, provider: providerId })
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 502
    json(res, Number.isFinite(status) && status >= 400 ? status : 502, {
      error: err instanceof Error ? err.message : `${provider.label} instruction failed`,
    })
  }
}

async function handleRequirements(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let body: {
    prompt?: string
    context?: string
    provider?: string
    apiKey?: string
    model?: string
    azureEndpoint?: string
    azureDeployment?: string
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

  const context = body.context?.trim() ?? ''
  if (!context) {
    json(res, 400, { error: 'Add a feature definition or architecture context before generating requirements.' })
    return
  }
  if (context.length > 24000) {
    json(res, 400, { error: 'Design context is too large to generate in one pass.' })
    return
  }

  const prompt = (
    body.prompt?.trim() ||
    'Write functional and non-functional requirements for this feature.'
  ).slice(0, 4000)

  const apiKey = engineApiKey(env, provider, body.apiKey)
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
    const text = await completeRequirements({
      provider: providerId,
      prompt,
      context,
      apiKey,
      model,
      azureEndpoint,
      azureDeployment,
    })
    json(res, 200, { text, model, provider: providerId })
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 502
    json(res, Number.isFinite(status) && status >= 400 ? status : 502, {
      error: err instanceof Error ? err.message : `${provider.label} requirements failed`,
    })
  }
}

async function handleSad(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let body: {
    prompt?: string
    context?: string
    provider?: string
    apiKey?: string
    model?: string
    azureEndpoint?: string
    azureDeployment?: string
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

  const context = body.context?.trim() ?? ''
  if (!context) {
    json(res, 400, { error: 'Add systems to the canvas before writing a SAD.' })
    return
  }
  if (context.length > 28000) {
    json(res, 400, { error: 'Architecture context is too large to write a SAD in one pass.' })
    return
  }

  const prompt = (
    body.prompt?.trim() ||
    'Write SAD narrative, non-functional requirements, and sequence flows for every diagram including nested views.'
  ).slice(0, 4000)

  const apiKey = engineApiKey(env, provider, body.apiKey)
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
    const text = await completeSad({
      provider: providerId,
      prompt,
      context,
      apiKey,
      model,
      azureEndpoint,
      azureDeployment,
    })
    json(res, 200, { text, model, provider: providerId })
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 502
    json(res, Number.isFinite(status) && status >= 400 ? status : 502, {
      error: err instanceof Error ? err.message : `${provider.label} SAD writing failed`,
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
