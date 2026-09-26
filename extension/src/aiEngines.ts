export type AiProviderId = 'spacexai' | 'openai' | 'anthropic' | 'gemini' | 'azure-openai' | 'copilot'

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

export const SYSTEM_PROMPT = `You are an enterprise integration architect inside Architecture Visual Builder.
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
  "costForecast": {
    "currency": "USD",
    "monthlyLow": 0,
    "monthlyExpected": 0,
    "monthlyHigh": 0,
    "confidence": "low" | "medium" | "high",
    "basis": "one sentence on how the forecast was derived",
    "drivers": [{ "name": "service or SKU", "monthly": 0, "note": "why this costs" }]
  },
  "simplifications": [
    {
      "id": "stable-id",
      "title": "short change",
      "problem": "why this integration (or set) is wasteful",
      "action": "how to simplify it",
      "integrationIds": ["integration-id"],
      "integrationLabels": ["flow name"],
      "savingsMonthly": 0,
      "removesHops": 0,
      "effort": "low" | "medium" | "high"
    }
  ],
  "risks": ["cross-cutting risk"],
  "recommendations": ["specific next action"]
}

Rules:
- Group the architecture into 4 to 8 capabilities (not one card per box unless the diagram is tiny).
- Every capability MUST have at least 2 pros and 2 cons. Be specific to the named systems, protocols, SKUs, regions, and flows — no generic filler.
- ALWAYS return costForecast. Use declared estimatedCost and SKU/region when present. If missing, estimate typical list prices for the named cloud services and say so in basis. Confidence is high only when most components have SKU or estimatedCost.
- ALWAYS return simplifications (2 to 6). Prefer: duplicate flows between the same pair, SaaS-to-system-of-record shortcuts, high fan-out without a process API/event bus, long inner hop chains, overlapping REST+SOAP jobs. Use real integration ids from context. savingsMonthly is indicative USD/month from fewer runtimes, mappings, and SKUs.
- Pros are strengths of the current design. Cons are gaps, coupling, single points of failure, cost, security, or operational burden.
- If the user names a focus lens (security, integration, cost, simplify, data, AI, resilience), weight the review toward that lens but still cover the landscape.
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
    case 'copilot':
      return completeCopilot(request)
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
- Context (what the component is, user story if any, integrations)
- Honor feature and story functional and non-functional requirements when present
- Code path: repository, branch, and folder/file path. If a path is linked, use it exactly. If missing, infer from the component name and mark it as a guess.
- Where to add: new files, folders, modules, and registration/wiring points to create
- Where to update: existing files, functions, configs, and call sites to change (or remove, if retiring)
- Concrete implementation steps
- Acceptance checks
- Constraints (do not touch unrelated services, do not invent secrets)

Name concrete paths. Be specific to the named component and the feature. Do not invent systems that are not in the context.`

export async function completeAnalysis(request: EngineRequest): Promise<string> {
  return completeDiagram({ ...request, systemPrompt: ANALYSIS_SYSTEM_PROMPT })
}

export const IMPACT_SYSTEM_PROMPT = `You are a staff engineer reviewing planned architecture work against the current codebase.
Return ONLY valid JSON. No markdown, no commentary, no code fences.

JSON shape:
{
  "title": "short impact title",
  "summary": "2-4 sentences on what existing systems must change",
  "verdict": "contained" | "cross-cutting" | "high-risk",
  "systems": [
    {
      "systemId": "id from context",
      "systemLabel": "component name",
      "changeKind": "new" | "update" | "retire",
      "impact": "what must change in this existing system",
      "files": ["repo-relative paths likely touched"],
      "requiredChanges": ["concrete edit, add, or remove"],
      "risks": ["breakage, contract, test, or rollout risk"],
      "effort": "low" | "medium" | "high"
    }
  ],
  "integrations": [
    {
      "label": "flow name",
      "from": "source system",
      "to": "target system",
      "impact": "contract, version, mapping, or runtime change"
    }
  ],
  "missingCode": ["systems with no matching code in the snapshot"],
  "recommendedOrder": ["safe implementation order by system label"]
}

Rules:
- Ground file paths in the code snapshot. If a path is a guess, prefix it with "guess:".
- Prefer existing files over inventing new modules unless changeKind is new.
- Call out integration contract changes between systems (API, events, schema).
- verdict contained = mostly local; cross-cutting = several systems/contracts; high-risk = breaking public APIs, data, or shared libraries.
- Do not invent repositories or systems that are not in the context.`

export async function completeImpact(request: EngineRequest): Promise<string> {
  return completeDiagram({ ...request, systemPrompt: IMPACT_SYSTEM_PROMPT })
}

export const TESTPLAN_SYSTEM_PROMPT = `You write an end-to-end software test plan from an architecture diagram.
Return ONLY valid JSON. No markdown, no commentary, no code fences.

JSON shape:
{
  "title": "architecture name — end-to-end test plan",
  "objective": "one sentence",
  "scope": ["bullet"],
  "suites": [
    {
      "id": "suite-e2e-1",
      "name": "E2E — journey name",
      "kind": "e2e" | "contract" | "component" | "nfr",
      "objective": "why this suite exists",
      "cases": [
        {
          "id": "E2E-1",
          "title": "Happy path — …",
          "priority": "P0" | "P1" | "P2",
          "components": ["system labels"],
          "preconditions": ["…"],
          "steps": [{ "action": "what the tester does", "expected": "observable result" }],
          "data": "optional sample payload note"
        }
      ]
    }
  ]
}

Rules:
- Always include an e2e suite per sequence flow (happy path + one fault/injection case).
- Include contract tests for integrations and smoke tests for components.
- Turn NFRs into measurable tests (latency, authn, encryption, availability).
- Name real systems and protocols from the context. Do not invent systems.
- Keep ids like E2E-1, CT-1, CMP-1, NFR-1.`

export async function completeTestPlan(request: EngineRequest): Promise<string> {
  return completeDiagram({ ...request, systemPrompt: TESTPLAN_SYSTEM_PROMPT })
}

export async function completeInstruction(request: EngineRequest): Promise<string> {
  return completeDiagram({ ...request, systemPrompt: INSTRUCTION_SYSTEM_PROMPT })
}

export const REQUIREMENTS_SYSTEM_PROMPT = `You write functional and non-functional requirements for a software feature and its user stories.
Return ONLY valid JSON. No markdown, no commentary, no code fences.

JSON shape:
{
  "functionalRequirements": "- FR-1: the system shall...\\n- FR-2: ...",
  "nonFunctionalRequirements": "- NFR-1: security/performance/reliability...\\n- NFR-2: ...",
  "stories": [
    {
      "id": "story-id-from-context",
      "functionalRequirements": "- FR-1: ...",
      "nonFunctionalRequirements": "- NFR-1: ..."
    }
  ]
}

Rules:
- functionalRequirements are capabilities, behaviors, and user-visible outcomes (what the system shall do).
- nonFunctionalRequirements are quality attributes: security, performance, reliability, observability, compliance, accessibility, operability.
- Use markdown bullet lines starting with "- ".
- Be specific to the named feature, stories, and architecture components. Do not invent systems.
- 4 to 8 functional bullets and 3 to 6 non-functional bullets at feature scope unless the feature is tiny.
- Story requirements must be a subset of the feature: tighter, testable, and scoped to that story's linked components.
- Include a "stories" array only when story ids are provided in the context. Match those ids exactly.
- If the user asked for one story only, still return top-level functionalRequirements and nonFunctionalRequirements for that story (omit stories[]).`

export async function completeRequirements(request: EngineRequest): Promise<string> {
  return completeDiagram({ ...request, systemPrompt: REQUIREMENTS_SYSTEM_PROMPT })
}

export const SAD_SYSTEM_PROMPT = `You write Solution Architecture Document (SAD) narrative for an enterprise integration landscape.
Return ONLY valid JSON. No markdown, no commentary, no code fences.

JSON shape:
{
  "purpose": "1-2 sentences on why this SAD exists",
  "executiveSummary": "4-6 sentence landscape narrative",
  "scope": ["in-scope item"],
  "assumptions": ["assumption"],
  "nonFunctionalRequirements": [
    {
      "id": "NFR-1",
      "category": "Security|Performance|Reliability|Availability|Observability|Data|Compliance|Operability",
      "requirement": "The system shall...",
      "rationale": "why this quality attribute matters here"
    }
  ],
  "sequenceFlows": [
    {
      "id": "existing-flow-id-or-new",
      "name": "short flow name",
      "viewPath": "diagram path from context",
      "summary": "what this conversation accomplishes",
      "steps": [
        { "from": "system label", "to": "system label", "message": "what is exchanged" }
      ]
    }
  ],
  "systemNarratives": [{ "id": "system-id", "explanation": "richer component narrative" }],
  "integrationNarratives": [{ "id": "integration-id", "explanation": "richer flow narrative" }],
  "observations": ["insight"],
  "risks": ["risk"],
  "recommendations": ["next action"]
}

Rules:
- Be specific to named systems, protocols, nested diagrams, and sequence flows in the context. Do not invent systems.
- Cover every nested/sub-diagram mentioned in the context: sequenceFlows must include root and nested views.
- Non-functional requirements: 6 to 10 testable quality attributes. Honor any existing feature/story NFRs in the context; extend them to architecture scope (security, performance, reliability, availability, observability, data, compliance, operability).
- Sequence flow steps must use existing system labels. Prefer the structural flows supplied in context; enrich names, summaries, and messages.
- systemNarratives and integrationNarratives must use ids from context.  Skip ids you cannot match.
- observations, risks, recommendations: 3 to 6 each, concrete, no generic filler.`

export async function completeSad(request: EngineRequest): Promise<string> {
  return completeDiagram({ ...request, systemPrompt: SAD_SYSTEM_PROMPT })
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
      case 'copilot': {
        await postJson('https://models.github.ai/inference/chat/completions', {
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: {
            model: 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          },
          label: 'GitHub Copilot',
        })
        return { ok: true, message: 'Verified · GitHub Copilot / Models accepted the token' }
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

async function completeCopilot(request: EngineRequest): Promise<string> {
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
  const model = request.model.includes('/') ? request.model : `openai/${request.model}`
  const messages = [
    { role: 'system', content: activeSystemPrompt(request) },
    { role: 'user', content },
  ]

  try {
    const payload = await postJson('https://models.github.ai/inference/chat/completions', {
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: { model, temperature: 0.3, messages },
      label: 'GitHub Copilot',
    })
    const output = extractChatContent(payload)
    if (output) return output
  } catch (modelsErr) {
    try {
      const payload = await postJson('https://api.githubcopilot.com/chat/completions', {
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          'Editor-Version': 'ArchitectureVisualBuilder/0.1.0',
          'Copilot-Integration-Id': 'vscode-chat',
        },
        body: {
          model: request.model.replace(/^openai\//, ''),
          temperature: 0.3,
          messages,
        },
        label: 'GitHub Copilot',
      })
      const output = extractChatContent(payload)
      if (output) return output
    } catch {
      throw modelsErr
    }
  }
  throw new Error('GitHub Copilot returned an empty response. Try a more specific prompt.')
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
