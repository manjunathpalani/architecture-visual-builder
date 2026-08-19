import { SYSTEM_TYPE_CONFIG, type ArchitectureDocument, type Integration, type SystemNode, type SystemType } from '../types'
import { parseInterfaceSpec, uniqueMethods, type InterfaceSpec } from '../types/interfaceSpec'
import { hasSubDiagram } from './diagramNavigation'

export interface DiagramViewBrief {
  path: string
  description?: string
  systems: SystemBrief[]
  integrations: IntegrationBrief[]
}

export interface SystemBrief {
  id: string
  label: string
  type: SystemType
  typeLabel: string
  category: string
  vendor?: string
  environment?: string
  service?: string
  description: string
  explanation: string
  hasSubDiagram: boolean
  api?: ApiBrief
}

export interface IntegrationBrief {
  id: string
  label: string
  sourceId: string
  targetId: string
  sourceLabel: string
  targetLabel: string
  direction: string
  protocol: string
  frequency: string
  dataFormat: string
  description: string
  explanation: string
  api?: ApiBrief
}

export interface ApiBrief {
  title: string
  version: string
  baseUrl?: string
  description?: string
  methods: string[]
  endpoints: { method: string; path: string; summary?: string }[]
}

export interface ArchitectureBrief {
  title: string
  version: string
  updatedAt: string
  description: string
  generatedAt: string
  fileBase: string
  executiveSummary: string
  purpose: string
  scope: string[]
  observations: string[]
  stats: {
    systems: number
    integrations: number
    apis: number
    subDiagrams: number
    protocols: string[]
  }
  layers: { name: string; count: number; explanation: string }[]
  systems: SystemBrief[]
  integrations: IntegrationBrief[]
  apis: ApiBrief[]
  views: DiagramViewBrief[]
}

const CONTENT_TYPES = new Set<SystemType>([
  'saas', 'aws', 'azure', 'cloud', 'onpremise', 'middleware', 'database', 'external',
])

export function buildArchitectureBrief(doc: ArchitectureDocument): ArchitectureBrief {
  const generatedAt = new Date().toLocaleString()
  const views = collectViews(doc)
  const systems = views.flatMap((v) => v.systems)
  const integrations = views.flatMap((v) => v.integrations)
  const apis = [
    ...systems.map((s) => s.api).filter((a): a is ApiBrief => Boolean(a)),
    ...integrations.map((i) => i.api).filter((a): a is ApiBrief => Boolean(a)),
  ]

  const protocols = unique(integrations.map((i) => i.protocol))
  const layers = buildLayers(systems)
  const hubs = findHubs(systems, integrations)

  const executiveSummary = buildExecutiveSummary(doc, systems, integrations, apis, layers, hubs)
  const observations = buildObservations(systems, integrations, apis, hubs)

  return {
    title: doc.metadata.name,
    version: doc.metadata.version || '1.0.0',
    updatedAt: formatDate(doc.metadata.updatedAt),
    description: doc.metadata.description?.trim() || 'Enterprise integration architecture captured in Architecture Visual Builder.',
    generatedAt,
    fileBase: slugFile(doc.metadata.name),
    executiveSummary,
    purpose:
      'This Solution Architecture Document (SAD) describes the systems, integrations, and interfaces in the current diagram so stakeholders can review how information moves across the landscape.',
    scope: [
      `${systems.length} system${systems.length === 1 ? '' : 's'} across ${layers.length} architectural layer${layers.length === 1 ? '' : 's'}`,
      `${integrations.length} integration${integrations.length === 1 ? '' : 's'} covering ${protocols.length || 0} protocol${protocols.length === 1 ? '' : 's'}`,
      `${apis.length} API interface${apis.length === 1 ? '' : 's'} with documented methods`,
      views.length > 1
        ? `${views.length - 1} nested internal diagram${views.length === 2 ? '' : 's'} for component-level detail`
        : 'Current canvas view only (no nested diagrams)',
    ],
    observations,
    stats: {
      systems: systems.length,
      integrations: integrations.length,
      apis: apis.length,
      subDiagrams: views.length - 1,
      protocols,
    },
    layers,
    systems,
    integrations,
    apis,
    views,
  }
}

function collectViews(doc: ArchitectureDocument): DiagramViewBrief[] {
  const views: DiagramViewBrief[] = []

  const visit = (
    path: string,
    description: string | undefined,
    systems: SystemNode[],
    integrations: Integration[],
  ) => {
    const systemBriefs = systems.filter(isContentSystem).map(toSystemBrief)
    const byId = new Map(systems.map((s) => [s.id, s.label]))
    const integrationBriefs = integrations.map((i) => toIntegrationBrief(i, byId))
    views.push({ path, description, systems: systemBriefs, integrations: integrationBriefs })

    for (const system of systems) {
      if (!system.subDiagram || !hasSubDiagram(system)) continue
      const nextPath = `${path} / ${system.label}`
      visit(
        nextPath,
        system.subDiagram.description,
        system.subDiagram.systems,
        system.subDiagram.integrations,
      )
    }
  }

  visit(doc.metadata.name, doc.metadata.description, doc.systems, doc.integrations)
  return views
}

function isContentSystem(system: SystemNode): boolean {
  if (system.type === 'note' || system.type === 'shape') return false
  return CONTENT_TYPES.has(system.type) || system.type === 'diagram' || system.type === 'group'
}

function toSystemBrief(system: SystemNode): SystemBrief {
  const typeLabel = SYSTEM_TYPE_CONFIG[system.type]?.label ?? system.type
  const vendor = system.properties?.vendor
  const environment = system.properties?.environment
  const service = system.properties?.service
  const description =
    system.properties?.description?.trim() ||
    `${typeLabel} component in the ${system.category || typeLabel} layer.`
  const api = specToApi(system.properties?.interfaceSpec)
  const explanation = [
    `${system.label} is a ${typeLabel.toLowerCase()} component`,
    vendor ? `from ${vendor}` : '',
    environment ? `running in ${environment}` : '',
    service ? `using ${service}` : '',
    `. ${description}`,
    api
      ? ` It exposes ${api.endpoints.length} API operation${api.endpoints.length === 1 ? '' : 's'} (${api.methods.join(', ') || 'no methods listed'}).`
      : '',
    hasSubDiagram(system) ? ' Internal structure is documented in a nested diagram.' : '',
  ]
    .filter(Boolean)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    id: system.id,
    label: system.label,
    type: system.type,
    typeLabel,
    category: system.category || typeLabel,
    vendor,
    environment,
    service,
    description,
    explanation,
    hasSubDiagram: hasSubDiagram(system),
    api,
  }
}

function toIntegrationBrief(integration: Integration, labels: Map<string, string>): IntegrationBrief {
  const sourceLabel = labels.get(integration.source) ?? integration.source
  const targetLabel = labels.get(integration.target) ?? integration.target
  const verb =
    integration.direction === 'inbound'
      ? 'receives from'
      : integration.direction === 'bidirectional'
        ? 'exchanges with'
        : 'sends to'
  const dataFormat = integration.dataFormat?.trim() || 'unspecified format'
  const description = integration.description?.trim() || ''
  const api = specToApi(integration.interfaceSpec)
  const explanation = [
    `${sourceLabel} ${verb} ${targetLabel} over ${integration.protocol} as a ${integration.frequency} ${dataFormat} flow`,
    integration.label ? ` named "${integration.label}"` : '',
    description ? `. ${description}` : '.',
    api
      ? ` The contract includes ${api.endpoints.length} operation${api.endpoints.length === 1 ? '' : 's'}: ${api.endpoints
          .slice(0, 6)
          .map((e) => `${e.method} ${e.path}`)
          .join(', ')}.`
      : '',
  ].join('')

  return {
    id: integration.id,
    label: integration.label,
    sourceId: integration.source,
    targetId: integration.target,
    sourceLabel,
    targetLabel,
    direction: integration.direction,
    protocol: integration.protocol,
    frequency: integration.frequency,
    dataFormat,
    description,
    explanation,
    api,
  }
}

function specToApi(json?: string): ApiBrief | undefined {
  const spec: InterfaceSpec | null = parseInterfaceSpec(json)
  if (!spec || spec.endpoints.length === 0) return undefined
  return {
    title: spec.title,
    version: spec.version,
    baseUrl: spec.baseUrl,
    description: spec.description,
    methods: uniqueMethods(spec.endpoints),
    endpoints: spec.endpoints.map((e) => ({
      method: e.method,
      path: e.path,
      summary: e.summary,
    })),
  }
}

function buildLayers(systems: SystemBrief[]): ArchitectureBrief['layers'] {
  const groups = new Map<string, SystemBrief[]>()
  for (const system of systems) {
    const key = system.category || system.typeLabel
    const list = groups.get(key) ?? []
    list.push(system)
    groups.set(key, list)
  }

  return [...groups.entries()].map(([name, items]) => ({
    name,
    count: items.length,
    explanation: `The ${name} layer contains ${items.length} component${items.length === 1 ? '' : 's'}: ${items
      .slice(0, 8)
      .map((s) => s.label)
      .join(', ')}${items.length > 8 ? `, and ${items.length - 8} more` : ''}.`,
  }))
}

function findHubs(systems: SystemBrief[], integrations: IntegrationBrief[]): SystemBrief[] {
  const degree = new Map<string, number>()
  for (const i of integrations) {
    degree.set(i.sourceId, (degree.get(i.sourceId) ?? 0) + 1)
    degree.set(i.targetId, (degree.get(i.targetId) ?? 0) + 1)
  }
  return systems
    .filter((s) => (degree.get(s.id) ?? 0) >= 3)
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
}

function buildExecutiveSummary(
  doc: ArchitectureDocument,
  systems: SystemBrief[],
  integrations: IntegrationBrief[],
  apis: ApiBrief[],
  layers: ArchitectureBrief['layers'],
  hubs: SystemBrief[],
): string {
  const intro = doc.metadata.description?.trim()
    ? `${doc.metadata.name} - ${doc.metadata.description.trim()}.`
    : `${doc.metadata.name} is an integration architecture spanning ${systems.length} systems.`

  const layerText =
    layers.length > 0
      ? ` Systems are grouped into ${layers.map((l) => `${l.name} (${l.count})`).join(', ')}.`
      : ''

  const flowText =
    integrations.length > 0
      ? ` ${integrations.length} integration${integrations.length === 1 ? '' : 's'} move data using ${unique(
          integrations.map((i) => i.protocol),
        ).join(', ') || 'documented protocols'}.`
      : ' No integrations are modelled yet.'

  const hubText =
    hubs.length > 0
      ? ` ${hubs[0].label} is a primary integration hub, with additional concentration around ${hubs
          .slice(1, 3)
          .map((h) => h.label)
          .join(' and ')}.`
      : ''

  const apiText =
    apis.length > 0
      ? ` ${apis.length} API interface${apis.length === 1 ? '' : 's'} are specified, covering methods such as ${unique(
          apis.flatMap((a) => a.methods),
        ).join(', ')}.`
      : ''

  return `${intro}${layerText}${flowText}${hubText}${apiText}`.replace(/\s+/g, ' ').trim()
}

function buildObservations(
  systems: SystemBrief[],
  integrations: IntegrationBrief[],
  apis: ApiBrief[],
  hubs: SystemBrief[],
): string[] {
  const notes: string[] = []

  if (hubs.length > 0) {
    notes.push(
      `${hubs.map((h) => h.label).join(', ')} ${hubs.length === 1 ? 'acts' : 'act'} as a concentration point. Changes there have a wide blast radius.`,
    )
  }

  const realtime = integrations.filter((i) => i.frequency === 'real-time' || i.frequency === 'near-real-time')
  if (realtime.length > 0) {
    notes.push(
      `${realtime.length} integration${realtime.length === 1 ? '' : 's'} are real-time or near-real-time and should be treated as latency-sensitive.`,
    )
  }

  const undocumented = integrations.filter((i) => !i.description && !i.api)
  if (undocumented.length > 0) {
    notes.push(
      `${undocumented.length} integration${undocumented.length === 1 ? '' : 's'} have no written contract or description yet.`,
    )
  }

  if (apis.length > 0) {
    const ops = apis.reduce((sum, a) => sum + a.endpoints.length, 0)
    notes.push(`Documented APIs expose ${ops} operation${ops === 1 ? '' : 's'} that consumers can rely on.`)
  }

  const nested = systems.filter((s) => s.hasSubDiagram)
  if (nested.length > 0) {
    notes.push(
      `${nested.length} component${nested.length === 1 ? '' : 's'} include nested diagrams for internal design.`,
    )
  }

  if (notes.length === 0) {
    notes.push('Add system descriptions and interface specs to deepen this SAD on the next export.')
  }

  return notes
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function formatDate(value?: string): string {
  if (!value) return new Date().toLocaleDateString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function slugFile(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'architecture'
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
