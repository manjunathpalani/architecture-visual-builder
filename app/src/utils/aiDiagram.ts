import type {
  ArchitectureDocument,
  Integration,
  IntegrationDirection,
  IntegrationFrequency,
  IntegrationProtocol,
  SystemNode,
  SystemType,
} from '../types'
import type { DiagramPath } from '../types/diagram'
import { documentToFlow, flowToDocument, generateId } from './jsonIO'
import { layoutFlow } from './autoLayout'
import { getDiagramView, updateDiagramAtPath } from './diagramNavigation'
import {
  getEngineApiKey,
  getProvider,
  loadAiSettings,
  type AiProviderId,
  type AiStatus,
} from './aiProviders'
import type { AiImage } from './aiImage'
import { aiFetch, aiUnreachableMessage } from './aiApi'

export type AiPlacement = 'new-tab' | 'replace' | 'merge'
export type { AiStatus } from './aiProviders'

const SYSTEM_TYPES = new Set<SystemType>([
  'saas', 'aws', 'azure', 'powerplatform', 'cloud', 'onpremise', 'middleware',
  'database', 'external', 'diagram', 'note', 'group', 'shape',
])
const DIRECTIONS = new Set<IntegrationDirection>(['inbound', 'outbound', 'bidirectional', 'none'])
const PROTOCOLS = new Set<IntegrationProtocol>([
  'REST API', 'SOAP', 'GraphQL', 'SFTP', 'Kafka', 'MQTT',
  'Webhook', 'ODBC/JDBC', 'File Transfer', 'Custom',
])
const FREQUENCIES = new Set<IntegrationFrequency>([
  'real-time', 'near-real-time', 'batch', 'event-driven', 'scheduled',
])
const COMPONENT_SHAPES = new Set([
  'actor', 'class', 'interface', 'component', 'process', 'decision', 'package',
  'datastore', 'queue', 'c4-person', 'c4-system', 'c4-container',
  'rectangle', 'rounded-rect', 'ellipse', 'diamond', 'triangle', 'hexagon',
  'cylinder', 'parallelogram',
])

export const AI_PROMPT_EXAMPLES = [
  'Retail order-to-cash: Shopify storefront, Stripe payments, MuleSoft, SAP S/4HANA, and a warehouse WMS',
  'Hospital integration: patient portal, EHR, lab, billing, FHIR API gateway, and claims clearinghouse',
  'Payments platform C4 view: mobile app, API gateway, ledger service, fraud engine, Postgres, and Kafka',
  'Add an Azure API Management front door and Event Hubs to the current diagram',
  'AWS landing zone: Route 53, CloudFront, WAF, ALB, EKS in private subnets, RDS, S3, IAM, CloudWatch',
  'Azure hub-and-spoke: Front Door, Firewall, App Gateway, AKS, SQL, Key Vault, Entra ID',
  'Power Platform: Power Apps, Power Automate, Dataverse, Power BI, and an on-premises data gateway to SQL',
  'Enterprise RAG copilot: chat UI, API gateway, prompt orchestrator, vector index, LLM gateway, and SharePoint',
  'Kubernetes platform with ingress, APIs, workers, Redis, Postgres, registry, and GitOps',
]

export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const response = await aiFetch('status')
    if (!response.ok) {
      return { available: false, defaultProvider: 'spacexai', providers: [] }
    }
    const data = (await response.json()) as AiStatus
    return {
      available: true,
      defaultProvider: data.defaultProvider ?? 'spacexai',
      providers: data.providers ?? [],
    }
  } catch {
    return { available: false, defaultProvider: 'spacexai', providers: [] }
  }
}

export async function verifyAiKey(options: {
  provider: AiProviderId
  apiKey?: string
  useServer?: boolean
  azureEndpoint?: string
  azureDeployment?: string
}): Promise<{ ok: boolean; message: string; source?: 'browser' | 'server' }> {
  try {
    const response = await aiFetch('verify', {
      method: 'POST',
      body: JSON.stringify({
        provider: options.provider,
        apiKey: options.apiKey,
        useServer: options.useServer,
        azureEndpoint: options.azureEndpoint,
        azureDeployment: options.azureDeployment,
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      message?: string
      error?: string
      source?: 'browser' | 'server'
    }
    if (!response.ok && payload.error) {
      return { ok: false, message: payload.error }
    }
    return {
      ok: Boolean(payload.ok),
      message: payload.message || payload.error || (payload.ok ? 'Verified' : 'Key test failed'),
      source: payload.source,
    }
  } catch {
    return { ok: false, message: aiUnreachableMessage() }
  }
}

export async function generateArchitectureFromPrompt(
  prompt: string,
  context?: string,
  providerId?: AiProviderId,
  images?: AiImage[],
  systemPrompt?: string,
): Promise<ArchitectureDocument> {
  const settings = loadAiSettings()
  const provider = providerId ?? settings.selectedProvider
  const info = getProvider(provider)

  let response: Awaited<ReturnType<typeof aiFetch>>
  try {
    response = await aiFetch('diagram', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        context,
        systemPrompt,
        provider,
        images: images?.map((image) => ({ mimeType: image.mimeType, dataUrl: image.dataUrl })),
        apiKey: getEngineApiKey(provider),
        azureEndpoint: settings.azureEndpoint,
        azureDeployment: settings.azureDeployment,
      }),
    })
  } catch {
    throw new Error(aiUnreachableMessage())
  }

  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `${info.label} request failed (${response.status})`)
  }
  if (!payload.text) {
    throw new Error(`${info.shortLabel} returned an empty diagram`)
  }

  return normalizeAiDocument(parseModelJson(payload.text))
}

export function summarizeConversationForAi(
  messages: Array<{ role: 'user' | 'assistant'; text: string }>,
): string {
  return messages
    .filter((message) => message.text.trim())
    .slice(-10)
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.text.trim()}`)
    .join('\n')
}

export function buildAiChatContext(
  messages: Array<{ role: 'user' | 'assistant'; text: string }>,
  document?: ArchitectureDocument,
): string | undefined {
  const parts: string[] = []
  const conversation = summarizeConversationForAi(messages)
  if (conversation) parts.push(`Conversation so far:\n${conversation}`)
  if (document) parts.push(`Current architecture:\n${summarizeDocumentForAi(document)}`)
  return parts.length > 0 ? parts.join('\n\n') : undefined
}

export function summarizeDocumentForAi(doc: ArchitectureDocument): string {
  const systems = doc.systems
    .map((s) => `- ${s.id}: ${s.label} (${s.type}${s.properties?.description ? ` — ${s.properties.description}` : ''})`)
    .join('\n')
  const integrations = doc.integrations
    .map((i) => `- ${i.source} -> ${i.target}: ${i.label} via ${i.protocol} (${i.frequency})`)
    .join('\n')
  return [
    `Name: ${doc.metadata.name}`,
    doc.metadata.description ? `Description: ${doc.metadata.description}` : '',
    'Systems:',
    systems || '(none)',
    'Integrations:',
    integrations || '(none)',
  ]
    .filter(Boolean)
    .join('\n')
}

export function mergeGeneratedIntoView(
  current: ArchitectureDocument,
  path: DiagramPath,
  generated: ArchitectureDocument,
): ArchitectureDocument {
  const view = getDiagramView(current, path)
  const merged = mergeGeneratedDocument(
    {
      ...current,
      systems: view.systems,
      integrations: view.integrations,
    },
    generated,
  )
  return updateDiagramAtPath(current, path, merged.systems, merged.integrations)
}

export function mergeGeneratedDocument(
  current: ArchitectureDocument,
  generated: ArchitectureDocument,
): ArchitectureDocument {
  const idMap = new Map<string, string>()
  const existingIds = new Set(current.systems.map((s) => s.id))
  const maxX = current.systems.reduce((max, s) => Math.max(max, s.position.x), 0)

  const incoming = generated.systems.map((system) => {
    const nextId = existingIds.has(system.id) ? generateId('sys') : system.id
    idMap.set(system.id, nextId)
    existingIds.add(nextId)
    return {
      ...system,
      id: nextId,
      position: { x: system.position.x + (current.systems.length ? maxX + 280 : 0), y: system.position.y },
    }
  })

  const integrations = generated.integrations
    .map((integration) => ({
      ...integration,
      id: generateId('int'),
      source: idMap.get(integration.source) ?? integration.source,
      target: idMap.get(integration.target) ?? integration.target,
    }))
    .filter((i) => existingIds.has(i.source) && existingIds.has(i.target))

  return {
    ...current,
    metadata: {
      ...current.metadata,
      description: generated.metadata.description || current.metadata.description,
      updatedAt: new Date().toISOString(),
    },
    systems: [...current.systems, ...incoming],
    integrations: [...current.integrations, ...integrations],
  }
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('The model did not return a JSON architecture. Try again with a more concrete prompt.')
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    throw new Error('Could not parse the generated architecture JSON. Try a shorter prompt.')
  }
}

function normalizeAiDocument(raw: unknown): ArchitectureDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Generated architecture is empty')
  }
  const input = raw as {
    metadata?: { name?: string; description?: string; version?: string }
    systems?: unknown[]
    integrations?: unknown[]
  }

  const aliases = new Map<string, string>()
  const systems = (input.systems ?? [])
    .map((item, index) => normalizeSystem(item, index, aliases))
    .filter((s): s is SystemNode => Boolean(s))
    .slice(0, 20)

  if (systems.length === 0) {
    throw new Error('The model returned no systems. Describe the applications and integrations you want.')
  }

  const ids = new Set(systems.map((s) => s.id))
  const integrations = (input.integrations ?? [])
    .map((item, index) => normalizeIntegration(item, index, ids, aliases))
    .filter((i): i is Integration => Boolean(i))
    .slice(0, 30)

  const draft: ArchitectureDocument = {
    metadata: {
      name: input.metadata?.name?.trim() || 'Generated Architecture',
      description: input.metadata?.description?.trim() || '',
      version: input.metadata?.version?.trim() || '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations,
  }

  return layoutGeneratedDocument(draft)
}

function normalizeSystem(raw: unknown, index: number, aliases: Map<string, string>): SystemNode | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const type = String(item.type ?? 'cloud').toLowerCase() as SystemType
  if (!SYSTEM_TYPES.has(type)) return null

  const label = String(item.label ?? `System ${index + 1}`).trim() || `System ${index + 1}`
  const rawId = String(item.id ?? label)
  const id = slugId(rawId, 'sys')
  aliases.set(rawId, id)
  aliases.set(id, id)
  aliases.set(label, id)
  aliases.set(slugId(label, 'sys'), id)
  const properties = (item.properties && typeof item.properties === 'object'
    ? item.properties
    : {}) as Record<string, unknown>

  const position = item.position && typeof item.position === 'object'
    ? item.position as { x?: unknown; y?: unknown }
    : {}

  return {
    id,
    type,
    label,
    category: String(item.category ?? defaultCategory(type)),
    position: {
      x: Number(position.x) || 80 + (index % 4) * 260,
      y: Number(position.y) || 80 + Math.floor(index / 4) * 140,
    },
    properties: {
      vendor: optionalString(properties.vendor),
      service: optionalString(properties.service),
      environment: optionalString(properties.environment),
      description: optionalString(properties.description) ?? optionalString(item.description),
      componentType: optionalString(properties.componentType),
      shape: allowedShape(properties.shape),
      owner: optionalString(properties.owner),
      zone: optionalString(properties.zone),
    },
  }
}

function normalizeIntegration(
  raw: unknown,
  index: number,
  systemIds: Set<string>,
  aliases: Map<string, string>,
): Integration | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const source = resolveRef(String(item.source ?? ''), aliases)
  const target = resolveRef(String(item.target ?? ''), aliases)
  if (!systemIds.has(source) || !systemIds.has(target) || source === target) return null

  const direction = String(item.direction ?? 'outbound') as IntegrationDirection
  const protocol = String(item.protocol ?? 'REST API') as IntegrationProtocol
  const frequency = String(item.frequency ?? 'real-time') as IntegrationFrequency

  return {
    id: slugId(String(item.id ?? `int-${index + 1}`), 'int'),
    source,
    target,
    label: String(item.label ?? 'Integration').trim() || 'Integration',
    direction: DIRECTIONS.has(direction) ? direction : 'outbound',
    protocol: PROTOCOLS.has(protocol) ? protocol : 'Custom',
    frequency: FREQUENCIES.has(frequency) ? frequency : 'real-time',
    dataFormat: String(item.dataFormat ?? 'JSON'),
    description: String(item.description ?? ''),
  }
}

function layoutGeneratedDocument(doc: ArchitectureDocument): ArchitectureDocument {
  const { nodes, edges } = documentToFlow(doc)
  const layouted = layoutFlow(nodes, edges, 'LR')
  const next = flowToDocument(layouted, edges, doc.metadata)
  return { ...next, drawings: doc.drawings }
}

function defaultCategory(type: SystemType): string {
  const map: Record<SystemType, string> = {
    saas: 'SaaS',
    aws: 'AWS',
    azure: 'Azure',
    powerplatform: 'Power Platform',
    cloud: 'Cloud',
    onpremise: 'On-Premise',
    middleware: 'Middleware',
    database: 'Database',
    external: 'External',
    diagram: 'Software Engineering',
    note: 'Drawing',
    group: 'Drawing',
    shape: 'Drawing',
  }
  return map[type]
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function allowedShape(value: unknown): string | undefined {
  const shape = optionalString(value)
  return shape && COMPONENT_SHAPES.has(shape) ? shape : undefined
}

function resolveRef(value: string, aliases: Map<string, string>): string {
  return aliases.get(value) ?? aliases.get(slugId(value, 'sys')) ?? slugId(value, 'sys')
}

function slugId(value: string, prefix: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || generateId(prefix)
}
