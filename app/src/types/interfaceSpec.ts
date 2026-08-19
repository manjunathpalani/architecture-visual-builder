export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface ApiEndpoint {
  method: HttpMethod
  path: string
  summary?: string
  description?: string
  requestSchema?: string
  responseSchema?: string
  tags?: string[]
  operationId?: string
}

export interface InterfaceSpec {
  title: string
  version: string
  baseUrl?: string
  description?: string
  specFormat: 'simple' | 'openapi'
  endpoints: ApiEndpoint[]
  rawOpenApi?: string
}

export interface OpenApiTag {
  name: string
  description?: string
}

export interface ParsedOpenApi {
  title: string
  version: string
  description?: string
  baseUrl?: string
  endpoints: ApiEndpoint[]
  tags: OpenApiTag[]
  raw: string
}

export const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]

const HTTP_METHOD_SET = new Set<string>(HTTP_METHODS)
const PATH_ITEM_SKIP = new Set(['summary', 'description', 'servers', 'parameters', '$ref'])

export function createDefaultInterfaceSpec(title = 'API Interface'): InterfaceSpec {
  return {
    title,
    version: '1.0.0',
    baseUrl: 'https://api.example.com',
    description: '',
    specFormat: 'simple',
    endpoints: [
      { method: 'GET', path: '/health', summary: 'Health check' },
    ],
  }
}

export function parseInterfaceSpec(json?: string): InterfaceSpec | null {
  if (!json?.trim()) return null
  try {
    const parsed = JSON.parse(json) as InterfaceSpec
    if (parsed.title && Array.isArray(parsed.endpoints)) return parsed
    if (parsed.rawOpenApi) return { ...parsed, endpoints: extractOpenApiEndpoints(parsed.rawOpenApi) }
    return null
  } catch {
    return null
  }
}

export function serializeInterfaceSpec(spec: InterfaceSpec): string {
  return JSON.stringify(spec, null, 2)
}

export function extractOpenApiEndpoints(raw: string): ApiEndpoint[] {
  try {
    return parseOpenApiDocument(raw).endpoints
  } catch {
    return []
  }
}

export function parseOpenApiDocument(raw: string): ParsedOpenApi {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('Spec is empty')
  if (looksLikeYaml(trimmed)) {
    throw new Error('YAML specs are not supported. Use the JSON endpoint (for example /openapi.json or /v3/api-docs).')
  }

  let doc: Record<string, unknown>
  try {
    doc = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    throw new Error('Invalid JSON. Paste OpenAPI 3.x or Swagger 2.0 JSON.')
  }

  if (!doc || typeof doc !== 'object') {
    throw new Error('Not a Swagger/OpenAPI document')
  }

  const hasPaths = Boolean(doc.paths && typeof doc.paths === 'object')
  if (!doc.openapi && !doc.swagger && !hasPaths) {
    throw new Error('Not a Swagger/OpenAPI document (missing openapi, swagger, or paths)')
  }

  const info = (doc.info ?? {}) as { title?: string; version?: string; description?: string }
  const endpoints = extractEndpointsFromDoc(doc)

  return {
    title: info.title?.trim() || 'API',
    version: info.version?.trim() || '1.0.0',
    description: info.description,
    baseUrl: extractBaseUrl(doc),
    endpoints,
    tags: collectTags(doc, endpoints),
    raw: trimmed,
  }
}

export function parsedOpenApiToInterfaceSpec(parsed: ParsedOpenApi, title?: string): InterfaceSpec {
  return {
    title: title ?? parsed.title,
    version: parsed.version,
    baseUrl: parsed.baseUrl,
    description: parsed.description,
    specFormat: 'openapi',
    endpoints: parsed.endpoints,
    rawOpenApi: parsed.raw,
  }
}

export function getSpecFromProperties(properties: Record<string, string | undefined>): InterfaceSpec | null {
  return parseInterfaceSpec(properties.interfaceSpec)
}

export function uniqueMethods(endpoints: ApiEndpoint[]): HttpMethod[] {
  const seen = new Set<HttpMethod>()
  const methods: HttpMethod[] = []
  for (const ep of endpoints) {
    if (!seen.has(ep.method)) {
      seen.add(ep.method)
      methods.push(ep.method)
    }
  }
  return methods
}

export function methodColor(method: HttpMethod): string {
  const colors: Record<HttpMethod, string> = {
    GET: '#0ea5e9',
    POST: '#22c55e',
    PUT: '#f59e0b',
    PATCH: '#8b5cf6',
    DELETE: '#ef4444',
    HEAD: '#64748b',
    OPTIONS: '#94a3b8',
  }
  return colors[method]
}

function looksLikeYaml(raw: string): boolean {
  const first = raw.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith('#'))
  if (!first) return false
  if (first.startsWith('{') || first.startsWith('[')) return false
  return /^(openapi|swagger)\s*:/.test(first)
}

function extractBaseUrl(doc: Record<string, unknown>): string | undefined {
  const servers = doc.servers
  if (Array.isArray(servers) && servers[0] && typeof servers[0] === 'object') {
    const url = (servers[0] as { url?: string }).url
    if (url) return url
  }

  const host = typeof doc.host === 'string' ? doc.host : undefined
  if (!host) return undefined
  const schemes = doc.schemes
  const scheme = Array.isArray(schemes) && typeof schemes[0] === 'string' ? schemes[0] : 'https'
  const basePath = typeof doc.basePath === 'string' ? doc.basePath : ''
  return `${scheme}://${host}${basePath}`
}

function extractEndpointsFromDoc(doc: Record<string, unknown>): ApiEndpoint[] {
  const paths = doc.paths
  if (!paths || typeof paths !== 'object') return []

  const endpoints: ApiEndpoint[] = []
  for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== 'object' || Array.isArray(pathItem)) continue
    for (const [key, op] of Object.entries(pathItem as Record<string, unknown>)) {
      if (PATH_ITEM_SKIP.has(key)) continue
      const method = key.toUpperCase()
      if (!HTTP_METHOD_SET.has(method)) continue
      if (!op || typeof op !== 'object' || Array.isArray(op)) continue

      const operation = op as Record<string, unknown>
      endpoints.push({
        method: method as HttpMethod,
        path,
        summary: typeof operation.summary === 'string' ? operation.summary : undefined,
        description: typeof operation.description === 'string' ? operation.description : undefined,
        tags: Array.isArray(operation.tags)
          ? operation.tags.filter((t): t is string => typeof t === 'string')
          : undefined,
        operationId: typeof operation.operationId === 'string' ? operation.operationId : undefined,
        requestSchema: extractRequestSchema(operation, doc),
        responseSchema: extractResponseSchema(operation, doc),
      })
    }
  }
  return endpoints
}

function collectTags(doc: Record<string, unknown>, endpoints: ApiEndpoint[]): OpenApiTag[] {
  const fromDoc = Array.isArray(doc.tags)
    ? doc.tags
        .filter((t): t is { name: string; description?: string } =>
          Boolean(t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string'),
        )
        .map((t) => ({ name: t.name, description: t.description }))
    : []

  const seen = new Set(fromDoc.map((t) => t.name))
  const extras: OpenApiTag[] = []
  for (const ep of endpoints) {
    for (const name of ep.tags ?? []) {
      if (!seen.has(name)) {
        seen.add(name)
        extras.push({ name })
      }
    }
  }
  return [...fromDoc, ...extras]
}

function extractRequestSchema(op: Record<string, unknown>, doc: Record<string, unknown>): string | undefined {
  const requestBody = op.requestBody as { content?: Record<string, { schema?: unknown }> } | undefined
  const content = requestBody?.content
  if (content) {
    const json = content['application/json'] ?? content[Object.keys(content)[0]]
    if (json?.schema) return formatSchema(json.schema, doc)
  }

  const parameters = Array.isArray(op.parameters) ? op.parameters : []
  const body = parameters.find(
    (p): p is { in?: string; schema?: unknown } =>
      Boolean(p && typeof p === 'object' && (p as { in?: string }).in === 'body'),
  )
  if (body?.schema) return formatSchema(body.schema, doc)
  return undefined
}

function extractResponseSchema(op: Record<string, unknown>, doc: Record<string, unknown>): string | undefined {
  const responses = op.responses
  if (!responses || typeof responses !== 'object') return undefined

  const map = responses as Record<string, { content?: Record<string, { schema?: unknown }>; schema?: unknown }>
  const preferred = map['200'] ?? map['201'] ?? map['default'] ?? Object.values(map)[0]
  if (!preferred) return undefined

  const content = preferred.content
  if (content) {
    const json = content['application/json'] ?? content[Object.keys(content)[0]]
    if (json?.schema) return formatSchema(json.schema, doc)
  }
  if (preferred.schema) return formatSchema(preferred.schema, doc)
  return undefined
}

function formatSchema(schema: unknown, doc: Record<string, unknown>): string {
  try {
    return JSON.stringify(resolveRef(schema, doc, 0), null, 2)
  } catch {
    return JSON.stringify(schema, null, 2)
  }
}

function resolveRef(schema: unknown, doc: Record<string, unknown>, depth: number): unknown {
  if (!schema || typeof schema !== 'object' || depth > 4) return schema
  const ref = (schema as { $ref?: unknown }).$ref
  if (typeof ref === 'string') {
    const resolved = lookupRef(ref, doc)
    if (resolved) return resolveRef(resolved, doc, depth + 1)
  }
  return schema
}

function lookupRef(ref: string, doc: Record<string, unknown>): unknown {
  if (!ref.startsWith('#/')) return undefined
  let current: unknown = doc
  for (const part of ref.slice(2).split('/')) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}
