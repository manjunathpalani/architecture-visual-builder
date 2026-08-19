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
      "type": "saas|aws|azure|cloud|onpremise|middleware|database|external|diagram|note|group",
      "label": "Display name",
      "category": "SaaS|AWS|Azure|Cloud|On-Premise|Middleware|Database|External|Software Engineering",
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
- Use real product names when the user names them (Salesforce, SAP, MuleSoft, AWS API Gateway, etc.).
- Do not invent credentials or secrets.
- If the user is refining an existing architecture, keep stable ids when the same systems remain.
- If images are attached, treat them as the source of truth: read every box, label, connector, and grouping, then recreate that landscape. Use the text prompt only to clarify or adjust what you see.`

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
        { role: 'system', content: SYSTEM_PROMPT },
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
      system: SYSTEM_PROMPT,
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
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
      { role: 'system', content: SYSTEM_PROMPT },
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

async function postJson(
  url: string,
  options: { headers: Record<string, string>; body: unknown; label: string },
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(180000),
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
  try {
    return JSON.parse(raw)
  } catch {
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
