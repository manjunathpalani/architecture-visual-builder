export type AiProviderId = 'spacexai' | 'openai' | 'anthropic' | 'gemini' | 'azure-openai'

export interface EngineImage {
  mimeType: 'image/jpeg' | 'image/png'
  dataUrl: string
}

export interface EngineRequest {
  provider: AiProviderId
  prompt: string
  context?: string
  images?: EngineImage[]
  apiKey: string
  model: string
  azureEndpoint?: string
  azureDeployment?: string
  /** Override the diagram-drawing system prompt (e.g. capability analysis). */
  systemPrompt?: string
}

const SYSTEM_PROMPT = `You are an enterprise integration architect inside Architecture Visual Builder.
Return ONLY valid JSON for an architecture diagram. No markdown, no commentary, no code fences.

JSON shape:
{
  "metadata": {
    "name": "short architecture name",
    "description": "1-2 sentence explanation of the landscape",
    "version": "1.0.0"
  },
  "systems": [
    {
      "id": "kebab-case-id",
      "type": "saas|aws|azure|powerplatform|cloud|onpremise|middleware|database|external|diagram|note|group",
      "label": "Display name",
      "category": "SaaS|AWS|Azure|Power Platform|Cloud|On-Premise|Middleware|Database|External|Software Engineering",
      "position": { "x": 80, "y": 80 },
      "properties": {
        "vendor": "optional",
        "service": "optional cloud service name",
        "environment": "Production|Cloud|On-Premise",
        "description": "what this component does",
        "componentType": "api if this is an API/gateway/interface",
        "shape": "process|interface|component|c4-system|c4-container when type is diagram"
      }
    }
  ],
  "integrations": [
    {
      "id": "int-kebab-id",
      "source": "system-id",
      "target": "system-id",
      "label": "flow name",
      "direction": "outbound|inbound|bidirectional",
      "protocol": "REST API|SOAP|GraphQL|SFTP|Kafka|MQTT|Webhook|ODBC/JDBC|File Transfer|Custom",
      "frequency": "real-time|near-real-time|batch|event-driven|scheduled",
      "dataFormat": "JSON|XML|CSV|Avro|EDI",
      "description": "what data moves and why"
    }
  ]
}

Rules:
- 6 to 16 systems unless the user asks for fewer or more (hard cap 20).
- Every integration source and target MUST be an existing system id.
- Prefer left-to-right flow: channels/SaaS -> middleware/API -> cloud services -> on-premise/systems of record -> data.
- Give every system a useful description.
- If the user mentions APIs, mark those systems with properties.componentType = "api".
- Use real product names when the user names them (Salesforce, SAP, MuleSoft, AWS API Gateway, Power Apps, Dataverse, etc.).
- Power Platform products (Power Apps, Power Automate, Power BI, Power Pages, Dataverse, Copilot Studio, AI Builder, data gateway) use type "powerplatform".
- For GenAI / RAG / agent / MLOps diagrams use real building blocks (orchestrator, vector index, LLM gateway, feature store, MCP tools) and type "cloud", "middleware", or "database" as appropriate.
- Do not invent credentials or secrets.
- If the user is refining an existing architecture, keep stable ids when the same systems remain.
- If images are attached, treat them as the source of truth: read every box, label, connector, and grouping, then recreate that landscape. Use the text prompt only to clarify or adjust what you see.`

export const ANALYSIS_SYSTEM_PROMPT = `You are an enterprise architect reviewing a capability and integration landscape.
Return ONLY valid JSON. No markdown, no commentary, no code fences.

JSON shape:
{
  "title": "short review title",
  "summary": "3-5 sentence executive assessment of the landscape",
  "verdict": "strong" | "balanced" | "at-risk",
  "capabilities": [
    {
      "name": "capability or component name",
      "related": ["system labels this covers"],
      "assessment": "one sentence on fitness for purpose",
      "pros": ["concrete strength", "another strength"],
      "cons": ["concrete weakness, risk, or gap"]
    }
  ],
  "risks": ["cross-cutting risk"],
  "recommendations": ["specific next action"]
}

Rules:
- Group the architecture into 4 to 8 capabilities (not one card per box unless the diagram is tiny).
- Every capability MUST have at least 2 pros and 2 cons. Be specific to the named systems, protocols, and flows — no generic filler.
- Pros are strengths of the current design. Cons are gaps, coupling, single points of failure, cost, security, or operational burden.
- If the user names a focus lens (security, integration, cost, data, AI, resilience), weight the review toward that lens but still cover the landscape.
- If they name a system to emphasize, give that system (or the capability it belongs to) a dedicated card.
- verdict: strong = sound with minor gaps; balanced = workable with material tradeoffs; at-risk = serious gaps or fragility.
- Do not invent systems that are not in the architecture. Do not invent credentials.`

function activeSystemPrompt(request: EngineRequest): string {
  return request.systemPrompt?.trim() || SYSTEM_PROMPT
}

export function userMessage(prompt: string, context?: string, hasImages = false): string {
  const instruction = prompt.trim()
    || (hasImages
      ? 'Recreate the attached architecture image as systems and integrations. Preserve names, flow direction, and grouping.'
      : '')
  return context?.trim()
    ? `Existing architecture context:\n${context.trim()}\n\nUser request:\n${instruction}`
    : instruction
}

function rawBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

export async function completeDiagram(request: EngineRequest): Promise<string> {
  switch (request.provider) {
    case 'spacexai':
      return completeSpaceXAI(request)
    case 'openai':
      return completeOpenAI(request)
    case 'anthropic':
      return completeAnthropic(request)
    case 'gemini':
      return completeGemini(request)
    case 'azure-openai':
      return completeAzureOpenAI(request)
    default:
      throw new Error('Unknown AI engine')
  }
}

export const INSTRUCTION_SYSTEM_PROMPT = `You write implementation instructions for a coding agent (Grok, Cursor, Copilot, Claude Code).
Return markdown only. No JSON, no wrapping code fence around the whole answer, no preamble.

The instruction must be self-contained: an engineer or agent can implement the change without seeing the architecture diagram.

Required sections:
- Title and one-sentence goal
- Scope (this component only) and out of scope
- Context (what the component is, integrations, linked repo/path if any)
- Concrete implementation steps
- Files or areas to inspect (use the linked path when present; otherwise guess from the component name and mark guesses)
- Acceptance checks
- Constraints (do not touch unrelated services, do not invent secrets)

Be specific to the named component and the feature. Do not invent systems that are not in the context.`

export async function completeAnalysis(request: EngineRequest): Promise<string> {
  return completeDiagram({ ...request, systemPrompt: ANALYSIS_SYSTEM_PROMPT })
}

export async function completeInstruction(request: EngineRequest): Promise<string> {
  return completeDiagram({ ...request, systemPrompt: INSTRUCTION_SYSTEM_PROMPT })
}

export async function verifyProviderKey(request: {
  provider: AiProviderId
  apiKey: string
  azureEndpoint?: string
  azureDeployment?: string
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const key = request.apiKey.trim()
  if (!key) return { ok: false, message: 'Enter an API key to test.' }

  try {
    switch (request.provider) {
      case 'spacexai':
        await getJson('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          label: 'SpaceXAI',
        })
        return { ok: true, message: 'Verified · SpaceXAI accepted the key' }
      case 'openai':
        await getJson('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          label: 'OpenAI',
        })
        return { ok: true, message: 'Verified · OpenAI accepted the key' }
      case 'anthropic':
        await getJson('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          label: 'Anthropic',
        })
        return { ok: true, message: 'Verified · Anthropic accepted the key' }
      case 'gemini': {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
        await getJson(url, { headers: {}, label: 'Gemini' })
        return { ok: true, message: 'Verified · Gemini accepted the key' }
      }
      case 'azure-openai': {
        const endpoint = (request.azureEndpoint ?? '').replace(/\/+$/, '')
        const deployment = request.azureDeployment?.trim()
        if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
          return { ok: false, message: 'Azure OpenAI needs a valid endpoint URL.' }
        }
        if (!deployment) {
          return { ok: false, message: 'Azure OpenAI needs a deployment name.' }
        }
        const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=2024-10-21`
        await postJson(url, {
          headers: { 'api-key': key },
          body: {
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          },
          label: 'Azure OpenAI',
        })
        return { ok: true, message: `Verified · Azure deployment ${deployment} is reachable` }
      }
      default:
        return { ok: false, message: 'Unknown AI engine' }
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Key test failed',
    }
  }
}

async function completeSpaceXAI(request: EngineRequest): Promise<string> {
  const text = userMessage(request.prompt, request.context, Boolean(request.images?.length))
  const userContent = request.images?.length
    ? [
        ...request.images.map((image) => ({
          type: 'input_image',
          image_url: image.dataUrl,
          detail: 'high',
        })),
        { type: 'input_text', text },
      ]
    : text

  const payload = await postJson('https://api.x.ai/v1/responses', {
    headers: { Authorization: `Bearer ${request.apiKey}` },
    body: {
      model: request.model,
      store: false,
      input: [
        { role: 'system', content: activeSystemPrompt(request) },
        { role: 'user', content: userContent },
      ],
    },
    label: 'SpaceXAI',
  })
  const output = extractResponsesText(payload) || extractChatContent(payload)
  if (!output) throw new Error('SpaceXAI returned an empty diagram. Try a more specific prompt or a clearer image.')
  return output
}

async function completeOpenAI(request: EngineRequest): Promise<string> {
  const payload = await postJson('https://api.openai.com/v1/chat/completions', {
    headers: { Authorization: `Bearer ${request.apiKey}` },
    body: chatCompletionBody(request),
    label: 'OpenAI',
  })
  const text = extractChatContent(payload)
  if (!text) throw new Error('OpenAI returned an empty diagram. Try a more specific prompt.')
  return text
}

async function completeAnthropic(request: EngineRequest): Promise<string> {
  const payload = await postJson('https://api.anthropic.com/v1/messages', {
    headers: {
      'x-api-key': request.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: request.model,
      max_tokens: 8192,
      system: activeSystemPrompt(request),
      messages: [{ role: 'user', content: anthropicUserContent(request) }],
    },
    label: 'Anthropic',
  })
  const text = extractAnthropicText(payload)
  if (!text) throw new Error('Anthropic returned an empty diagram. Try a more specific prompt.')
  return text
}

async function completeGemini(request: EngineRequest): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey)}`
  const payload = await postJson(url, {
    headers: {},
    body: {
      system_instruction: { parts: [{ text: activeSystemPrompt(request) }] },
      contents: [{ role: 'user', parts: geminiParts(request) }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    },
    label: 'Gemini',
  })
  const text = extractGeminiText(payload)
  if (!text) throw new Error('Gemini returned an empty diagram. Try a more specific prompt.')
  return text
}

async function completeAzureOpenAI(request: EngineRequest): Promise<string> {
  const endpoint = (request.azureEndpoint ?? '').replace(/\/+$/, '')
  const deployment = request.azureDeployment?.trim()
  if (!endpoint || !deployment) {
    throw new Error('Azure OpenAI needs an endpoint and deployment name.')
  }
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=2024-10-21`
  const payload = await postJson(url, {
    headers: { 'api-key': request.apiKey },
    body: chatCompletionBody(request),
    label: 'Azure OpenAI',
  })
  const text = extractChatContent(payload)
  if (!text) throw new Error('Azure OpenAI returned an empty diagram. Try a more specific prompt.')
  return text
}

function chatCompletionBody(request: EngineRequest) {
  const text = userMessage(request.prompt, request.context, Boolean(request.images?.length))
  const content = request.images?.length
    ? [
        { type: 'text', text },
        ...request.images.map((image) => ({
          type: 'image_url',
          image_url: { url: image.dataUrl },
        })),
      ]
    : text

  return {
    model: request.model,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: activeSystemPrompt(request) },
      { role: 'user', content },
    ],
  }
}

function anthropicUserContent(request: EngineRequest) {
  const text = userMessage(request.prompt, request.context, Boolean(request.images?.length))
  if (!request.images?.length) return text
  return [
    ...request.images.map((image) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType,
        data: rawBase64(image.dataUrl),
      },
    })),
    { type: 'text', text },
  ]
}

function geminiParts(request: EngineRequest) {
  const text = userMessage(request.prompt, request.context, Boolean(request.images?.length))
  const parts: Array<Record<string, unknown>> = [{ text }]
  for (const image of request.images ?? []) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: rawBase64(image.dataUrl),
      },
    })
  }
  return parts
}

async function getJson(
  url: string,
  options: { headers: Record<string, string>; label: string },
): Promise<unknown> {
  return requestJson(url, { ...options, method: 'GET', timeoutMs: 15000 })
}

async function postJson(
  url: string,
  options: { headers: Record<string, string>; body: unknown; label: string },
): Promise<unknown> {
  return requestJson(url, { ...options, method: 'POST', timeoutMs: 180000 })
}

async function requestJson(
  url: string,
  options: {
    method: 'GET' | 'POST'
    headers: Record<string, string>
    body?: unknown
    label: string
    timeoutMs: number
  },
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      method: options.method,
      headers: {
        ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.method === 'POST' ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : `${options.label} request failed`
    throw new Error(message.includes('Timeout') ? `${options.label} timed out. Try a shorter prompt.` : message)
  }

  const raw = await response.text()
  if (!response.ok) {
    throw Object.assign(new Error(explainProviderError(options.label, response.status, raw)), {
      status: response.status,
    })
  }
  if (!raw.trim()) return {}
  try {
    return JSON.parse(raw)
  } catch {
    if (options.method === 'GET') return {}
    throw new Error(`${options.label} returned a non-JSON response`)
  }
}

function extractResponsesText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>
  if (typeof record.output_text === 'string' && record.output_text.trim()) return record.output_text

  const output = record.output
  if (!Array.isArray(output)) return ''
  const parts: string[] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    if (entry.type === 'message' && Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (!block || typeof block !== 'object') continue
        const content = block as Record<string, unknown>
        if ((content.type === 'output_text' || content.type === 'text') && typeof content.text === 'string') {
          parts.push(content.text)
        }
      }
    }
  }
  return parts.join('\n').trim()
}

function extractChatContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices
  const content = choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text?: string }).text ?? '') : ''))
      .join('')
      .trim()
  }
  return ''
}

function extractAnthropicText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const content = (payload as { content?: Array<{ type?: string; text?: string }> }).content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text ?? '')
    .join('\n')
    .trim()
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const candidates = (payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }).candidates
  const parts = candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((part) => part.text ?? '').join('').trim()
}

function explainProviderError(label: string, status: number, raw: string): string {
  let detail = ''
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string } | string
      message?: string
    }
    if (typeof parsed.error === 'string') detail = parsed.error
    else if (parsed.error?.message) detail = parsed.error.message
    else if (parsed.message) detail = parsed.message
  } catch {
    detail = raw.slice(0, 240)
  }

  if (status === 401 || status === 403) {
    return `${label} rejected the API key. Check the key for this engine.`
  }
  if (status === 429) return `${label} rate limit reached. Wait a moment and try again.`
  return detail || `${label} request failed (${status})`
}
