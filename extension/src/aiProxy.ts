import {
  ANALYSIS_SYSTEM_PROMPT,
  IMPACT_SYSTEM_PROMPT,
  TESTPLAN_SYSTEM_PROMPT,
  INSTRUCTION_SYSTEM_PROMPT,
  REQUIREMENTS_SYSTEM_PROMPT,
  SAD_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  completeAnalysis,
  completeDiagram,
  completeImpact,
  completeTestPlan,
  completeInstruction,
  completeRequirements,
  completeSad,
  verifyProviderKey,
  type AiProviderId,
  type EngineRequest,
} from './aiEngines'
import { completeViaVsCodeLm, isCopilotLanguageModelAvailable } from './agent'

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
  { id: 'copilot', label: 'GitHub Copilot', envKey: 'GITHUB_TOKEN', envModel: 'COPILOT_MODEL', defaultModel: 'openai/gpt-4o' },
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
        return await handleStatus()
      case 'verify':
        return handleVerify(body ?? {})
      case 'diagram':
        return handleDiagram(body ?? {})
      case 'analyze':
        return handleAnalyze(body ?? {})
      case 'impact':
        return handleImpact(body ?? {})
      case 'testplan':
        return handleTestPlan(body ?? {})
      case 'instruct':
        return handleInstruct(body ?? {})
      case 'requirements':
        return handleRequirements(body ?? {})
      case 'sad':
        return handleSad(body ?? {})
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

async function handleStatus(): Promise<AiApiResult> {
  const copilotReady = await isCopilotLanguageModelAvailable()
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
          envValue(provider.envKey) ||
            (provider.id === 'gemini' ? envValue('GOOGLE_API_KEY') : '') ||
            (provider.id === 'copilot' && (copilotReady || githubToken())),
        ),
        recommended: provider.recommended,
      })),
    },
  }
}

function githubToken(): string {
  return envValue('GITHUB_COPILOT_TOKEN') || envValue('GITHUB_TOKEN') || envValue('GH_TOKEN')
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
  if (provider.id === 'copilot') return githubToken()
  return envValue(provider.envKey) || (provider.id === 'gemini' ? envValue('GOOGLE_API_KEY') : '')
}

async function completeCopilotInVsCode(request: {
  provider: AiProviderId
  prompt: string
  context?: string
  images?: EngineRequest['images']
  systemPrompt: string
}): Promise<string | null> {
  if (request.provider !== 'copilot') return null
  if (request.images?.length) return null
  try {
    return await completeViaVsCodeLm({
      systemPrompt: request.systemPrompt,
      prompt: request.prompt,
      context: request.context,
    })
  } catch {
    return null
  }
}

async function handleVerify(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { ok: false, error: 'Unknown AI engine' } }

  const provided = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const apiKey = resolveApiKey(provider, body.apiKey, Boolean(body.useServer) || provider.id === 'copilot')
  if (provider.id === 'copilot' && !provided) {
    if (await isCopilotLanguageModelAvailable()) {
      return {
        status: 200,
        payload: {
          ok: true,
          message: 'Verified · GitHub Copilot is signed in to this VS Code window',
          provider: provider.id,
          source: 'server',
        },
      }
    }
  }
  if (!apiKey) {
    return {
      status: 400,
      payload: {
        ok: false,
        error:
          provider.id === 'copilot'
            ? 'Sign in to GitHub Copilot in VS Code, or paste a GitHub token in AI Engines.'
            : `No ${provider.label} key to test. Paste a key in AI Engines.`,
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

  const viaLm = await completeCopilotInVsCode({
    provider: provider.id,
    prompt,
    context: stringField(body.context) || undefined,
    images,
    systemPrompt: SYSTEM_PROMPT,
  })
  if (viaLm) return { status: 200, payload: { text: viaLm, provider: provider.id } }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return missingCopilotOrKey(provider, Boolean(images.length))
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

  const prompt = (stringField(body.prompt) || 'Analyze this architecture as enterprise capabilities. Show pros and cons.').slice(0, 4000)
  const viaLm = await completeCopilotInVsCode({
    provider: provider.id,
    prompt,
    context,
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
  })
  if (viaLm) return { status: 200, payload: { text: viaLm, provider: provider.id } }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return missingCopilotOrKey(provider)
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

async function handleImpact(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { error: 'Unknown AI engine' } }

  const context = stringField(body.context)
  if (!context) {
    return { status: 400, payload: { error: 'Add feature work and code context before running impact analysis.' } }
  }

  const prompt = (stringField(body.prompt) || 'Analyze code impact of this architecture change.').slice(0, 4000)
  const viaLm = await completeCopilotInVsCode({
    provider: provider.id,
    prompt,
    context,
    systemPrompt: IMPACT_SYSTEM_PROMPT,
  })
  if (viaLm) return { status: 200, payload: { text: viaLm, provider: provider.id } }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return missingCopilotOrKey(provider)
  }

  const text = await completeImpact({
    provider: provider.id,
    prompt,
    context,
    apiKey,
    model: stringField(body.model) || envValue(provider.envModel ?? '') || provider.defaultModel,
    azureEndpoint: stringField(body.azureEndpoint) || envValue('AZURE_OPENAI_ENDPOINT'),
    azureDeployment: stringField(body.azureDeployment) || envValue('AZURE_OPENAI_DEPLOYMENT'),
  })
  return { status: 200, payload: { text, provider: provider.id } }
}

async function handleTestPlan(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { error: 'Unknown AI engine' } }

  const context = stringField(body.context)
  if (!context) {
    return { status: 400, payload: { error: 'Add systems to the canvas before generating a test plan.' } }
  }

  const prompt = (stringField(body.prompt) || 'Produce an end-to-end test plan for this architecture.').slice(0, 4000)
  const viaLm = await completeCopilotInVsCode({
    provider: provider.id,
    prompt,
    context,
    systemPrompt: TESTPLAN_SYSTEM_PROMPT,
  })
  if (viaLm) return { status: 200, payload: { text: viaLm, provider: provider.id } }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return missingCopilotOrKey(provider)
  }

  const text = await completeTestPlan({
    provider: provider.id,
    prompt,
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

  const prompt = (
    stringField(body.prompt) ||
    'Write a self-contained coding-agent instruction for this component, including code path, where to add, and where to update.'
  ).slice(0, 4000)
  const viaLm = await completeCopilotInVsCode({
    provider: provider.id,
    prompt,
    context,
    systemPrompt: INSTRUCTION_SYSTEM_PROMPT,
  })
  if (viaLm) return { status: 200, payload: { text: viaLm, provider: provider.id } }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return missingCopilotOrKey(provider)
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

  const prompt = (
    stringField(body.prompt) ||
    'Write functional and non-functional requirements for this feature.'
  ).slice(0, 4000)
  const viaLm = await completeCopilotInVsCode({
    provider: provider.id,
    prompt,
    context,
    systemPrompt: REQUIREMENTS_SYSTEM_PROMPT,
  })
  if (viaLm) return { status: 200, payload: { text: viaLm, provider: provider.id } }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return missingCopilotOrKey(provider)
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

async function handleSad(body: Record<string, unknown>): Promise<AiApiResult> {
  const provider = resolveProvider(body.provider)
  if (!provider) return { status: 400, payload: { error: 'Unknown AI engine' } }

  const context = stringField(body.context)
  if (!context) {
    return { status: 400, payload: { error: 'Add systems to the canvas before writing a SAD.' } }
  }

  const prompt = (
    stringField(body.prompt) ||
    'Write SAD narrative, non-functional requirements, and sequence flows for every diagram including nested views.'
  ).slice(0, 4000)
  const viaLm = await completeCopilotInVsCode({
    provider: provider.id,
    prompt,
    context,
    systemPrompt: SAD_SYSTEM_PROMPT,
  })
  if (viaLm) return { status: 200, payload: { text: viaLm, provider: provider.id } }

  const apiKey = resolveApiKey(provider, body.apiKey)
  if (!apiKey) {
    return missingCopilotOrKey(provider)
  }

  const text = await completeSad({
    provider: provider.id,
    prompt: (
      stringField(body.prompt) ||
      'Write SAD narrative, non-functional requirements, and sequence flows for every diagram including nested views.'
    ).slice(0, 4000),
    context,
    apiKey,
    model: stringField(body.model) || envValue(provider.envModel ?? '') || provider.defaultModel,
    azureEndpoint: stringField(body.azureEndpoint) || envValue('AZURE_OPENAI_ENDPOINT'),
    azureDeployment: stringField(body.azureDeployment) || envValue('AZURE_OPENAI_DEPLOYMENT'),
  })
  return { status: 200, payload: { text, provider: provider.id } }
}

function missingCopilotOrKey(
  provider: { id: AiProviderId; label: string },
  images = false,
): AiApiResult {
  return {
    status: 401,
    payload: {
      error:
        provider.id === 'copilot'
          ? images
            ? 'Screenshot-to-diagram with Copilot needs a GitHub token. Sign-in Copilot in VS Code works for text prompts; attach a token for images, or use SpaceXAI.'
            : 'Sign in to GitHub Copilot in VS Code, or paste a GitHub token in Settings → AI engines.'
          : `No ${provider.label} key configured. Paste a key in Settings → AI engines.`,
    },
  }
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
