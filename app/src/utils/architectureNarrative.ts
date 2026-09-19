import {
  SYSTEM_TYPE_CONFIG,
  type ArchitectureDocument,
  type Integration,
  type SystemNode,
  type SystemType,
} from '../types'
import type { DiagramPath } from '../types/diagram'
import { parseInterfaceSpec, uniqueMethods, type InterfaceSpec } from '../types/interfaceSpec'
import { hasSubDiagram, hasSubDiagramContent } from './diagramNavigation'

export interface DiagramCaptureTarget {
  key: string
  title: string
  path: DiagramPath
}

export interface SequenceStepBrief {
  from: string
  to: string
  protocol: string
  frequency: string
  message: string
}

export interface SequenceFlowBrief {
  id: string
  name: string
  viewKey: string
  viewPath: string
  summary: string
  participants: string[]
  steps: SequenceStepBrief[]
  script: string
}

export type NfrSource = 'feature' | 'architecture' | 'ai'

export interface NfrBrief {
  id: string
  category: string
  requirement: string
  rationale: string
  source: NfrSource
}

export interface DiagramViewBrief {
  key: string
  path: string
  description?: string
  systems: SystemBrief[]
  integrations: IntegrationBrief[]
  sequenceFlows: SequenceFlowBrief[]
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
  sequenceFlows: SequenceFlowBrief[]
  nfrs: NfrBrief[]
  assumptions: string[]
  risks: string[]
  recommendations: string[]
  aiWritten: boolean
}

const CONTENT_TYPES = new Set<SystemType>([
  'saas', 'aws', 'azure', 'powerplatform', 'cloud', 'onpremise', 'middleware', 'database', 'external',
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

  const sequenceFlows = views.flatMap((view) => view.sequenceFlows)
  const nfrs = collectNfrs(doc, systems, integrations, apis, hubs)
  const executiveSummary = buildExecutiveSummary(doc, systems, integrations, apis, layers, hubs)
  const observations = buildObservations(systems, integrations, apis, hubs, sequenceFlows, nfrs)

  return {
    title: doc.metadata.name,
    version: doc.metadata.version || '1.0.0',
    updatedAt: formatDate(doc.metadata.updatedAt),
    description: doc.metadata.description?.trim() || 'Enterprise integration architecture captured in Architecture Visual Builder.',
    generatedAt,
    fileBase: slugFile(doc.metadata.name),
    executiveSummary,
    purpose:
      'This Solution Architecture Document (SAD) describes the systems, integrations, nested diagrams, sequence flows, and non-functional requirements in the modelled landscape so stakeholders can review how information moves and what quality attributes the design must meet.',
    scope: [
      `${systems.length} system${systems.length === 1 ? '' : 's'} across ${layers.length} architectural layer${layers.length === 1 ? '' : 's'}`,
      `${integrations.length} integration${integrations.length === 1 ? '' : 's'} covering ${protocols.length || 0} protocol${protocols.length === 1 ? '' : 's'}`,
      `${apis.length} API interface${apis.length === 1 ? '' : 's'} with documented methods`,
      views.length > 1
        ? `${views.length - 1} nested internal diagram${views.length === 2 ? '' : 's'} for component-level detail`
        : 'Current canvas view only (no nested diagrams)',
      `${sequenceFlows.length} sequence flow${sequenceFlows.length === 1 ? '' : 's'} derived from modelled integrations`,
      `${nfrs.length} non-functional requirement${nfrs.length === 1 ? '' : 's'} covering quality attributes`,
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
    sequenceFlows,
    nfrs,
    assumptions: buildAssumptions(views, nfrs),
    risks: [],
    recommendations: [],
    aiWritten: false,
  }
}

export function listDiagramCaptureTargets(doc: ArchitectureDocument): DiagramCaptureTarget[] {
  const targets: DiagramCaptureTarget[] = [{ key: 'root', title: doc.metadata.name, path: [] }]
  const visit = (systems: SystemNode[], path: DiagramPath, keyPrefix: string) => {
    for (const system of systems) {
      if (!system.subDiagram || !hasSubDiagram(system)) continue
      const nextPath = [...path, { systemId: system.id, label: system.label }]
      const key = keyPrefix === 'root' ? system.id : `${keyPrefix}/${system.id}`
      targets.push({
        key,
        title: nextPath.map((segment) => segment.label).join(' / '),
        path: nextPath,
      })
      visit(system.subDiagram.systems, nextPath, key)
      visitIntegrations(system.subDiagram.integrations, nextPath, key)
    }
  }
  const visitIntegrations = (integrations: Integration[], path: DiagramPath, keyPrefix: string) => {
    for (const integration of integrations) {
      if (!integration.subDiagram || !hasSubDiagramContent(integration.subDiagram)) continue
      const nextPath = [...path, { systemId: integration.id, label: integration.label, kind: 'integration' as const }]
      const key = keyPrefix === 'root' ? integration.id : `${keyPrefix}/${integration.id}`
      targets.push({
        key,
        title: `${nextPath.map((segment) => segment.label).join(' / ')} sequence`,
        path: nextPath,
      })
      visit(integration.subDiagram.systems, nextPath, key)
      visitIntegrations(integration.subDiagram.integrations, nextPath, key)
    }
  }
  visit(doc.systems, [], 'root')
  visitIntegrations(doc.integrations, [], 'root')
  return targets
}

export function diagramPathKey(path: DiagramPath): string {
  return path.length === 0 ? 'root' : path.map((segment) => segment.systemId).join('/')
}

function collectViews(doc: ArchitectureDocument): DiagramViewBrief[] {
  const views: DiagramViewBrief[] = []

  const visit = (
    key: string,
    path: string,
    description: string | undefined,
    systems: SystemNode[],
    integrations: Integration[],
  ) => {
    const systemBriefs = systems.filter(isContentSystem).map(toSystemBrief)
    const byId = new Map(systems.map((s) => [s.id, s.label]))
    const integrationBriefs = integrations.map((i) => toIntegrationBrief(i, byId))
    views.push({
      key,
      path,
      description,
      systems: systemBriefs,
      integrations: integrationBriefs,
      sequenceFlows: collectSequenceFlows(key, path, systems, integrations),
    })

    for (const system of systems) {
      if (!system.subDiagram || !hasSubDiagram(system)) continue
      const nextKey = key === 'root' ? system.id : `${key}/${system.id}`
      const nextPath = `${path} / ${system.label}`
      visit(
        nextKey,
        nextPath,
        system.subDiagram.description,
        system.subDiagram.systems,
        system.subDiagram.integrations,
      )
    }
    for (const integration of integrations) {
      if (!integration.subDiagram || !hasSubDiagramContent(integration.subDiagram)) continue
      const nextKey = key === 'root' ? integration.id : `${key}/${integration.id}`
      const nextPath = `${path} / ${integration.label} sequence`
      visit(
        nextKey,
        nextPath,
        integration.subDiagram.description,
        integration.subDiagram.systems,
        integration.subDiagram.integrations,
      )
    }
  }

  visit('root', doc.metadata.name, doc.metadata.description, doc.systems, doc.integrations)
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
  sequenceFlows: SequenceFlowBrief[],
  nfrs: NfrBrief[],
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

  if (sequenceFlows.length > 0) {
    notes.push(
      `${sequenceFlows.length} end-to-end sequence flow${sequenceFlows.length === 1 ? '' : 's'} are documented, including nested-diagram traffic.`,
    )
  }

  if (nfrs.length > 0) {
    const categories = unique(nfrs.map((item) => item.category))
    notes.push(`Non-functional requirements cover ${categories.join(', ')}.`)
  }

  if (notes.length === 0) {
    notes.push('Add system descriptions and interface specs to deepen this SAD on the next export.')
  }

  return notes
}

function buildAssumptions(views: DiagramViewBrief[], nfrs: NfrBrief[]): string[] {
  const notes: string[] = [
    'The canvas is the source of truth for systems, integrations, and nested diagrams included in this SAD.',
  ]
  if (views.length > 1) {
    notes.push('Nested diagrams describe the internal design of their parent component and do not replace parent-level contracts.')
  }
  if (nfrs.some((item) => item.source === 'feature')) {
    notes.push('Feature and user-story NFRs are included where they constrain the architecture.')
  }
  notes.push('Sequence flows are derived from modelled integration direction, protocol, and frequency.')
  return notes
}

function collectSequenceFlows(
  viewKey: string,
  viewPath: string,
  systems: SystemNode[],
  integrations: Integration[],
): SequenceFlowBrief[] {
  const contentIds = new Set(systems.filter(isContentSystem).map((system) => system.id))
  const labels = new Map(systems.map((system) => [system.id, system.label]))
  const explicit = integrations
    .filter((item) => (item.sequenceFlow?.length ?? 0) > 0)
    .map((item, index) => toExplicitSequenceFlow(viewKey, viewPath, item, labels, index))
  const used = new Set(explicit.map((item) => item.id))
  const edges = integrations.filter((item) => contentIds.has(item.source) && contentIds.has(item.target))
  if (edges.length === 0) return explicit

  const outgoing = new Map<string, Array<{ to: string; edge: Integration }>>()
  const incomingCount = new Map<string, number>()
  for (const edge of edges) {
    for (const hop of directedHops(edge)) {
      const list = outgoing.get(hop.from) ?? []
      list.push({ to: hop.to, edge })
      outgoing.set(hop.from, list)
      incomingCount.set(hop.to, (incomingCount.get(hop.to) ?? 0) + 1)
    }
  }

  const starts = [...outgoing.keys()].filter((id) => (incomingCount.get(id) ?? 0) === 0)
  const seeds = starts.length > 0 ? starts : [...outgoing.keys()]
  const found: Integration[][] = []

  const visit = (node: string, trail: Integration[], seen: string[]) => {
    if (found.length >= 12 || trail.length > 8) return
    const unused = (outgoing.get(node) ?? []).filter(
      (step) => !trail.includes(step.edge) && !seen.includes(step.to),
    )
    if (unused.length === 0) {
      if (trail.length > 0) found.push([...trail])
      return
    }
    for (const step of unused) {
      trail.push(step.edge)
      seen.push(step.to)
      visit(step.to, trail, seen)
      seen.pop()
      trail.pop()
    }
  }

  for (const seed of seeds) {
    visit(seed, [], [seed])
  }

  const uniquePaths = new Map<string, Integration[]>()
  for (const trail of found) {
    const key = trail.map((edge) => edge.id).join('>')
    if (!uniquePaths.has(key)) uniquePaths.set(key, trail)
  }

  const ranked = [...uniquePaths.values()].sort((a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id))
  const kept: Integration[][] = []
  const usedEdges = new Set<string>()
  for (const trail of ranked) {
    if (trail.length >= 2) {
      const ids = trail.map((edge) => edge.id)
      if (kept.some((item) => isEdgePrefix(ids, item.map((edge) => edge.id)))) continue
      kept.push(trail)
      ids.forEach((id) => usedEdges.add(id))
    }
    if (kept.length >= 8) break
  }

  for (const edge of edges) {
    if (usedEdges.has(edge.id)) continue
    kept.push([edge])
    usedEdges.add(edge.id)
    if (kept.length >= 10) break
  }

  const derived = kept
    .slice(0, 10)
    .map((trail, index) => toSequenceFlow(viewKey, viewPath, trail, labels, index))
    .filter((item) => !used.has(item.id))
  return [...explicit, ...derived].slice(0, 12)
}

function toExplicitSequenceFlow(
  viewKey: string,
  viewPath: string,
  edge: Integration,
  labels: Map<string, string>,
  index: number,
): SequenceFlowBrief {
  const hops = [
    labels.get(edge.source) ?? edge.source,
    ...(edge.sequenceFlow ?? []).map((step) => step.label),
    labels.get(edge.target) ?? edge.target,
  ]
  const steps: SequenceStepBrief[] = []
  for (let i = 0; i < hops.length - 1; i++) {
    steps.push({
      from: hops[i],
      to: hops[i + 1],
      protocol: edge.protocol,
      frequency: edge.frequency,
      message: edge.description?.trim() || edge.label,
    })
  }
  const script = steps
    .map((step, hop) => `${hop + 1}. ${step.from} → ${step.to} : ${step.protocol} — ${step.message}`)
    .join('\n')
  return {
    id: `${viewKey}-seq-int-${edge.id}-${index + 1}`,
    name: edge.label?.trim() || `${hops[0]} to ${hops[hops.length - 1]}`,
    viewKey,
    viewPath,
    summary: `Defined sequence on ${edge.label}: ${hops.join(' → ')}`,
    participants: unique(hops),
    steps,
    script,
  }
}

function isEdgePrefix(short: string[], long: string[]): boolean {
  if (short.length >= long.length) return false
  return short.every((id, index) => long[index] === id)
}

function directedHops(edge: Integration): Array<{ from: string; to: string }> {
  if (edge.direction === 'inbound') return [{ from: edge.target, to: edge.source }]
  if (edge.direction === 'bidirectional') {
    return [
      { from: edge.source, to: edge.target },
      { from: edge.target, to: edge.source },
    ]
  }
  return [{ from: edge.source, to: edge.target }]
}

function toSequenceFlow(
  viewKey: string,
  viewPath: string,
  trail: Integration[],
  labels: Map<string, string>,
  index: number,
): SequenceFlowBrief {
  const steps: SequenceStepBrief[] = trail.map((edge) => {
    const hop = directedHops(edge)[0]
    const from = labels.get(hop.from) ?? hop.from
    const to = labels.get(hop.to) ?? hop.to
    const payload = edge.dataFormat?.trim() || edge.label || 'message'
    return {
      from,
      to,
      protocol: edge.protocol,
      frequency: edge.frequency,
      message: edge.description?.trim() || `${edge.protocol} ${payload} (${edge.frequency})`,
    }
  })
  const participants = unique(steps.flatMap((step) => [step.from, step.to]))
  const start = steps[0]?.from ?? 'Start'
  const end = steps[steps.length - 1]?.to ?? 'End'
  const name = trail.length === 1 && trail[0].label?.trim()
    ? trail[0].label.trim()
    : `${start} to ${end}`
  const script = steps
    .map((step, hop) => `${hop + 1}. ${step.from} → ${step.to} : ${step.protocol} — ${step.message}`)
    .join('\n')

  return {
    id: `${viewKey}-seq-${index + 1}`,
    name,
    viewKey,
    viewPath,
    summary:
      trail.length === 1
        ? `${start} exchanges with ${end} over ${steps[0].protocol} as a ${steps[0].frequency} flow.`
        : `${steps.length}-step flow from ${start} to ${end} across ${participants.length} participants.`,
    participants,
    steps,
    script,
  }
}

function collectNfrs(
  doc: ArchitectureDocument,
  systems: SystemBrief[],
  integrations: IntegrationBrief[],
  apis: ApiBrief[],
  hubs: SystemBrief[],
): NfrBrief[] {
  const items: NfrBrief[] = []
  let featureIndex = 1
  for (const design of doc.changeDesigns ?? []) {
    for (const line of parseRequirementLines(design.nonFunctionalRequirements)) {
      items.push({
        id: `NFR-F-${featureIndex++}`,
        category: inferNfrCategory(line),
        requirement: line,
        rationale: `From feature “${design.title}”`,
        source: 'feature',
      })
    }
    for (const story of design.stories ?? []) {
      for (const line of parseRequirementLines(story.nonFunctionalRequirements)) {
        items.push({
          id: `NFR-S-${featureIndex++}`,
          category: inferNfrCategory(line),
          requirement: line,
          rationale: `From story “${story.title}” in ${design.title}`,
          source: 'feature',
        })
      }
    }
  }

  const derived = deriveArchitectureNfrs(systems, integrations, apis, hubs)
  const seen = new Set(items.map((item) => item.requirement.toLowerCase()))
  for (const item of derived) {
    if (seen.has(item.requirement.toLowerCase())) continue
    seen.add(item.requirement.toLowerCase())
    items.push(item)
  }
  return items.slice(0, 16)
}

function deriveArchitectureNfrs(
  systems: SystemBrief[],
  integrations: IntegrationBrief[],
  apis: ApiBrief[],
  hubs: SystemBrief[],
): NfrBrief[] {
  const items: NfrBrief[] = []
  const externals = systems.filter((system) => system.type === 'external' || system.category === 'External')
  const databases = systems.filter((system) => system.type === 'database' || system.category === 'Database')
  const realtime = integrations.filter((item) => item.frequency === 'real-time' || item.frequency === 'near-real-time')
  const observability = systems.filter((system) => /observ|monitor|log|telemetry/i.test(`${system.label} ${system.service ?? ''}`))

  if (externals.length > 0) {
    items.push({
      id: 'NFR-SEC-1',
      category: 'Security',
      requirement: `Interfaces with external systems (${externals
        .slice(0, 4)
        .map((system) => system.label)
        .join(', ')}) shall authenticate callers and encrypt data in transit.`,
      rationale: 'External boundaries are the primary exposure surface on this canvas.',
      source: 'architecture',
    })
  } else if (apis.length > 0) {
    items.push({
      id: 'NFR-SEC-1',
      category: 'Security',
      requirement: 'Published API contracts shall require authenticated access and reject unsigned or anonymous calls by default.',
      rationale: 'Documented APIs are consumer-facing contracts.',
      source: 'architecture',
    })
  }

  if (realtime.length > 0) {
    items.push({
      id: 'NFR-PERF-1',
      category: 'Performance',
      requirement: `Real-time and near-real-time flows (${realtime
        .slice(0, 3)
        .map((item) => `${item.sourceLabel} → ${item.targetLabel}`)
        .join('; ')}) shall complete within the latency budget of the upstream channel.`,
      rationale: 'Latency-sensitive integrations are modelled on the canvas.',
      source: 'architecture',
    })
  }

  if (hubs.length > 0) {
    items.push({
      id: 'NFR-REL-1',
      category: 'Reliability',
      requirement: `${hubs[0].label} shall degrade gracefully; a hub failure must not silently drop in-flight messages.`,
      rationale: `${hubs[0].label} concentrates integration traffic.`,
      source: 'architecture',
    })
  }

  if (apis.length > 0) {
    items.push({
      id: 'NFR-AVL-1',
      category: 'Availability',
      requirement: 'Documented API operations shall remain versioned and available to consumers for the life of the contract.',
      rationale: `${apis.length} API interface${apis.length === 1 ? '' : 's'} are specified on the landscape.`,
      source: 'architecture',
    })
  }

  if (databases.length > 0) {
    items.push({
      id: 'NFR-DATA-1',
      category: 'Data',
      requirement: `Systems of record (${databases
        .slice(0, 4)
        .map((system) => system.label)
        .join(', ')}) shall preserve durability, backup, and recoverable restore for persisted data.`,
      rationale: 'Database components are modelled as systems of record.',
      source: 'architecture',
    })
  }

  items.push({
    id: 'NFR-OPS-1',
    category: observability.length > 0 ? 'Observability' : 'Operability',
    requirement:
      observability.length > 0
        ? `${observability.map((system) => system.label).join(', ')} shall capture traces, metrics, and logs for every modelled integration hop.`
        : 'Each modelled integration shall be operable: failures must be detectable, replayable, and attributable to a source and target system.',
    rationale: 'Operations need hop-level visibility across the landscape.',
    source: 'architecture',
  })

  const nested = systems.filter((system) => system.hasSubDiagram)
  if (nested.length > 0) {
    items.push({
      id: 'NFR-CHG-1',
      category: 'Operability',
      requirement: `Internal changes in nested diagrams (${nested
        .slice(0, 4)
        .map((system) => system.label)
        .join(', ')}) shall preserve parent-level integration contracts.`,
      rationale: 'Nested diagrams are part of the published architecture.',
      source: 'architecture',
    })
  }

  return items
}

function parseRequirementLines(text?: string): string[] {
  if (!text?.trim()) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').replace(/^NFR-\d+:\s*/i, '').trim())
    .filter(Boolean)
}

function inferNfrCategory(line: string): string {
  const text = line.toLowerCase()
  if (/secur|auth|encrypt|iam|token|tls|oauth|permission/.test(text)) return 'Security'
  if (/latency|throughput|performance|real-time|sla|response time/.test(text)) return 'Performance'
  if (/availab|uptime|rto|rpo/.test(text)) return 'Availability'
  if (/reliab|failover|resilien|retry|idempot/.test(text)) return 'Reliability'
  if (/observ|log|metric|trace|monitor/.test(text)) return 'Observability'
  if (/gdpr|hipaa|sox|complian|audit|pii|pci/.test(text)) return 'Compliance'
  if (/accessib|wcag/.test(text)) return 'Accessibility'
  if (/data|backup|retention|privacy|encrypt at rest/.test(text)) return 'Data'
  return 'Operability'
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
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
