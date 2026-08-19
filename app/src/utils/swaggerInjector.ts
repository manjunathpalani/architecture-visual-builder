import type { SystemNode } from '../types'
import {
  parseOpenApiDocument,
  serializeInterfaceSpec,
  uniqueMethods,
  type ApiEndpoint,
  type InterfaceSpec,
  type ParsedOpenApi,
} from '../types/interfaceSpec'
import { generateId } from './jsonIO'

export type SwaggerGroupMode = 'tag' | 'single'

export interface SwaggerApiComponent {
  id: string
  name: string
  description?: string
  endpoints: ApiEndpoint[]
}

export function parseSwaggerSource(raw: string): ParsedOpenApi {
  return parseOpenApiDocument(raw)
}

export function groupSwaggerComponents(
  parsed: ParsedOpenApi,
  mode: SwaggerGroupMode,
): SwaggerApiComponent[] {
  if (mode === 'single' || parsed.endpoints.length === 0) {
    return [
      {
        id: 'all',
        name: parsed.title,
        description: parsed.description,
        endpoints: parsed.endpoints,
      },
    ]
  }

  const tagDesc = new Map(parsed.tags.map((t) => [t.name, t.description]))
  const map = new Map<string, SwaggerApiComponent>()

  for (const endpoint of parsed.endpoints) {
    const names = endpoint.tags?.length ? endpoint.tags : ['default']
    for (const name of names) {
      let component = map.get(name)
      if (!component) {
        component = {
          id: slugId(name),
          name,
          description: tagDesc.get(name),
          endpoints: [],
        }
        map.set(name, component)
      }
      component.endpoints.push(endpoint)
    }
  }

  if (map.size === 0) {
    return [
      {
        id: 'all',
        name: parsed.title,
        description: parsed.description,
        endpoints: parsed.endpoints,
      },
    ]
  }

  return [...map.values()]
}

export function componentToInterfaceSpec(
  parsed: ParsedOpenApi,
  component: SwaggerApiComponent,
): InterfaceSpec {
  return {
    title: component.name,
    version: parsed.version,
    baseUrl: parsed.baseUrl,
    description: component.description ?? parsed.description,
    specFormat: 'openapi',
    endpoints: component.endpoints,
    rawOpenApi: parsed.raw,
  }
}

export function mergeComponentsToInterfaceSpec(
  parsed: ParsedOpenApi,
  components: SwaggerApiComponent[],
): InterfaceSpec {
  const seen = new Set<string>()
  const endpoints: ApiEndpoint[] = []
  for (const component of components) {
    for (const endpoint of component.endpoints) {
      const key = `${endpoint.method} ${endpoint.path}`
      if (seen.has(key)) continue
      seen.add(key)
      endpoints.push(endpoint)
    }
  }

  const title =
    components.length === 1 ? components[0].name : parsed.title

  return {
    title,
    version: parsed.version,
    baseUrl: parsed.baseUrl,
    description: parsed.description,
    specFormat: 'openapi',
    endpoints,
    rawOpenApi: parsed.raw,
  }
}

export function swaggerComponentsToSystems(
  parsed: ParsedOpenApi,
  components: SwaggerApiComponent[],
  origin: { x: number; y: number },
  style: 'api' | 'interface' = 'api',
): SystemNode[] {
  const cols = 3
  const dx = 280
  const dy = 220

  return components.map((component, index) => {
    const spec = componentToInterfaceSpec(parsed, component)
    const methods = uniqueMethods(component.endpoints)
    const height = Math.min(300, 96 + Math.min(component.endpoints.length, 6) * 22)
    const col = index % cols
    const row = Math.floor(index / cols)

    if (style === 'interface') {
      return {
        id: generateId('sys'),
        type: 'diagram' as const,
        label: component.name,
        category: 'Software Engineering',
        position: { x: origin.x + col * dx, y: origin.y + row * dy },
        properties: {
          shape: 'interface',
          componentType: 'api',
          vendor: parsed.title,
          description: component.description ?? `${component.endpoints.length} operations`,
          interfaceSpec: serializeInterfaceSpec(spec),
          width: '220',
          height: String(Math.max(140, height)),
        },
      }
    }

    return {
      id: generateId('sys'),
      type: 'cloud' as const,
      label: component.name,
      category: 'API',
      position: { x: origin.x + col * dx, y: origin.y + row * dy },
      properties: {
        componentType: 'api',
        vendor: parsed.title,
        service: 'API',
        description:
          component.description ??
          `${methods.join(', ') || 'API'} · ${component.endpoints.length} operation${component.endpoints.length === 1 ? '' : 's'}`,
        interfaceSpec: serializeInterfaceSpec(spec),
        width: '240',
        height: String(height),
      },
    }
  })
}

export function computeInjectOrigin(existing: SystemNode[]): { x: number; y: number } {
  if (existing.length === 0) return { x: 80, y: 80 }
  const maxX = Math.max(...existing.map((s) => s.position.x + Number(s.properties?.width ?? 180)))
  return { x: maxX + 80, y: 80 }
}

export async function fetchSwaggerSpec(url: string): Promise<string> {
  const trimmed = url.trim()
  if (!trimmed) throw new Error('Enter a Swagger / OpenAPI URL')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    throw new Error('Enter a valid http(s) URL')
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported')
  }

  let response: Response
  try {
    response = await fetch(trimmed, { headers: { Accept: 'application/json, application/yaml, text/plain' } })
  } catch {
    throw new Error('Browser blocked this URL (CORS). Download the spec and paste or upload the JSON file.')
  }

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status} ${response.statusText})`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()
  if (contentType.includes('text/html') || /^\s*<(!doctype|html)/i.test(text)) {
    throw new Error('URL returned HTML, not a spec. Use the JSON URL (for example /openapi.json or /v3/api-docs).')
  }
  return text
}

function slugId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'api'
}
