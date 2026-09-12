import {
  completeAnalysis,
  completeDiagram,
  completeInstruction,
  completeRequirements,
  verifyProviderKey,
  type AiProviderId,
} from './aiEngines'

const PROVIDERS: Array<{
  id: AiProviderId
  label: string
  recommended?: boolean
  envKey: string
  envModel?: string
  defaultModel: string
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
  },
]

const PROVIDER_IDS = new Set(PROVIDERS.map((provider) => provider.id))

export interface AiApiResult {
  status: number
  payload: unknown
}

export async function handleAiApi(path: string, body?: Record<string, unknown>): Promise<AiApiResult> {
  const route = path.replace(/^\/+|\/+$/g, '')
  try {
    switch (route) {
      case 'status':
        return handleStatus()
      case 'verify':
        return handleVerify(body ?? {})
      case 'diagram':
        return handleDiagram(body ?? {})
      case 'analyze':
        return handleAnalyze(body ?? {})
      case 'instruct':
        return handleInstruct(body ?? {})
      case 'requirements':
        return handleRequirements(body ?? {})
      default:
        return { status: 404, payload: { error: `Unknown AI route: ${path}` } }
    }
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 502
    return {
      status: Number.isFinite(status) && status >= 400 ? status : 502,
      payload: { error: err instanceof Error ? err.message : 'AI request failed' },
    }
  }
}

function envValue(name: string): string {
  return (process.env[name] ?? '').trim()
}

function handleStatus(): AiApiResult {
  return {
    status: 200,
    payload: {
      available: true,
      defaultProvider: 'spacexai',
      providers: PROVIDERS.map((provider) => ({
        id: provider.id,
        label: provider.label,
        model: envValue(provider.envModel ?? '') || provider.defaultModel,
        configured: Boolean(
          envValue(provider.envKey) || (provider.id === 'gemini' ? envValue('GOOGLE_API_KEY') : ''),
        ),
        recommended: provider.recommended,
      })),
    },
  }
}

function resolveProvider(raw: unknown): { id: AiProviderId; label: string; defaultModel: string; envKey: string; envModel?: string } | null {
  const id = String(raw ?? 'spacexai') as AiProviderId
  const provider = PROVIDERS.find((item) => item.id === id)
  if (!provider || !PROVIDER_IDS.has(id)) return null
  return provider
}

function resolveApiKey(provider: { id: AiProviderId; envKey: string }, provided?: unknown, useServer = true): string {
  const pasted = typeof provided === 'string' ? provided.trim() : ''
  if (pasted) return pasted
  if (!useServer) return ''
  return envValue(provider.envKey) || (provider.id === 'gemini' ? envValue('GOOGLE_API_KEY') : '')
}

async function handleVerify(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { ok: false, error: 'Unknown AI engine' } }

  const provided = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const apiKey = resolveApiKey(provider, body.apiKey, Boolean(body.useServer))
  if (!apiKey) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: `No ${provider.label} key to test. Paste a key in AI Engines.`,
      },
    }
  }

  const result = await verifyProviderKey({
    provider: provider.id,
    apiKey,
    azureEndpoint: stringField(body.azureEndpoint) || envValue('AZURE_OPENAI_ENDPOINT'),
    azureDeployment: stringField(body.azureDeployment) || envValue('AZURE_OPENAI_DEPLOYMENT'),
  })
  return {
    status: 200,
    payload: {
      ok: result.ok,
      message: result.message,
      error: result.ok ? undefined : result.message,
      provider: provider.id,
      source: provided ? 'browser' : 'server',
    },
  }
}

async function handleDiagram(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { error: 'Unknown AI engine' } }

  const prompt = stringField(body.prompt)
  const images = sanitizeImages(body.images)
  if (!prompt && images.length === 0) {
    return { status: 400, payload: { error: 'Enter a prompt or attach an architecture image' } }
  }
  if (prompt.length > 8000) {
    return { status: 400, payload: { error: 'Prompt is too long (max 8000 characters)' } }
  }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return {
      status: 401,
      payload: { error: `No ${provider.label} key configured. Paste a key in Settings → AI engines.` },
    }
  }

  const text = await completeDiagram({
    provider: provider.id,
    prompt,
    context: stringField(body.context) || undefined,
    images,
    apiKey,
    model: stringField(body.model) || envValue(provider.envModel ?? '') || provider.defaultModel,
    azureEndpoint: stringField(body.azureEndpoint) || envValue('AZURE_OPENAI_ENDPOINT'),
    azureDeployment: stringField(body.azureDeployment) || envValue('AZURE_OPENAI_DEPLOYMENT'),
  })
  return { status: 200, payload: { text, provider: provider.id } }
}

async function handleAnalyze(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { error: 'Unknown AI engine' } }

  const context = stringField(body.context)
  if (!context) {
    return { status: 400, payload: { error: 'Add systems to the canvas before running capability analysis.' } }
  }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return {
      status: 401,
      payload: { error: `No ${provider.label} key configured. Paste a key in Settings → AI engines.` },
    }
  }

  const text = await completeAnalysis({
    provider: provider.id,
    prompt: (stringField(body.prompt) || 'Analyze this architecture as enterprise capabilities. Show pros and cons.').slice(0, 4000),
    context,
    apiKey,
    model: stringField(body.model) || envValue(provider.envModel ?? '') || provider.defaultModel,
    azureEndpoint: stringField(body.azureEndpoint) || envValue('AZURE_OPENAI_ENDPOINT'),
    azureDeployment: stringField(body.azureDeployment) || envValue('AZURE_OPENAI_DEPLOYMENT'),
  })
  return { status: 200, payload: { text, provider: provider.id } }
}

async function handleInstruct(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { error: 'Unknown AI engine' } }

  const context = stringField(body.context)
  if (!context) {
    return { status: 400, payload: { error: 'Add a component and design context before generating an instruction.' } }
  }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return {
      status: 401,
      payload: { error: `No ${provider.label} key configured. Paste a key in Settings → AI engines.` },
    }
  }

  const text = await completeInstruction({
    provider: provider.id,
    prompt: (
      stringField(body.prompt) ||
      'Write a self-contained coding-agent instruction for this component, including code path, where to add, and where to update.'
    ).slice(0, 4000),
    context,
    apiKey,
    model: stringField(body.model) || envValue(provider.envModel ?? '') || provider.defaultModel,
    azureEndpoint: stringField(body.azureEndpoint) || envValue('AZURE_OPENAI_ENDPOINT'),
    azureDeployment: stringField(body.azureDeployment) || envValue('AZURE_OPENAI_DEPLOYMENT'),
  })
  return { status: 200, payload: { text, provider: provider.id } }
}

async function handleRequirements(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { error: 'Unknown AI engine' } }

  const context = stringField(body.context)
  if (!context) {
    return { status: 400, payload: { error: 'Add a feature definition or architecture context before generating requirements.' } }
  }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return {
      status: 401,
      payload: { error: `No ${provider.label} key configured. Paste a key in Settings → AI engines.` },
    }
  }

  const text = await completeRequirements({
    provider: provider.id,
    prompt: (
      stringField(body.prompt) ||
      'Write functional and non-functional requirements for this feature.'
    ).slice(0, 4000),
    context,
    apiKey,
    model: stringField(body.model) || envValue(provider.envModel ?? '') || provider.defaultModel,
    azureEndpoint: stringField(body.azureEndpoint) || envValue('AZURE_OPENAI_ENDPOINT'),
    azureDeployment: stringField(body.azureDeployment) || envValue('AZURE_OPENAI_DEPLOYMENT'),
  })
  return { status: 200, payload: { text, provider: provider.id } }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeImages(raw: unknown): Array<{ mimeType: 'image/jpeg' | 'image/png'; dataUrl: string }> {
  if (!Array.isArray(raw)) return []
  const images: Array<{ mimeType: 'image/jpeg' | 'image/png'; dataUrl: string }> = []
  for (const item of raw.slice(0, 4)) {
    if (!item || typeof item !== 'object') continue
    const dataUrl = stringField((item as { dataUrl?: unknown }).dataUrl)
    if (!dataUrl.startsWith('data:image/')) continue
    const mimeType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
    if (dataUrl.length > 3_500_000) continue
    images.push({ mimeType, dataUrl })
  }
  return images
}
