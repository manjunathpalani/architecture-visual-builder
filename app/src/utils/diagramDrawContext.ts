import type { ArchitectureDocument, SystemNode } from '../types'
import type { DiagramPath } from '../types/diagram'
import { getDiagramView, isIntegrationPath } from './diagramNavigation'
import { describeZoneLinks } from './zoneRectangles'

/** How Draw with AI should choose components. `auto` reads the open canvas. */
export type DiagramDrawSetting = 'auto' | DiagramDrawKind

export type DiagramDrawKind =
  | 'integration'
  | 'solution'
  | 'context'
  | 'enterprise'
  | 'functional'
  | 'business'
  | 'bpm'
  | 'application'
  | 'infrastructure'
  | 'sequence'

export interface DiagramDrawKindInfo {
  id: DiagramDrawKind
  label: string
  /** One line shown under the Draw with AI toolbar. */
  matches: string
  rules: string
  examples: string[]
}

export const DIAGRAM_DRAW_KINDS: DiagramDrawKindInfo[] = [
  {
    id: 'integration',
    label: 'Enterprise integration',
    matches: 'SaaS, middleware, cloud services, and systems of record',
    rules: `Draw an integration landscape.
- Channels and SaaS use type "saas". Power Platform products use type "powerplatform".
- Cloud products use type "aws", "azure", or "cloud", with properties.vendor and properties.service set to the real product.
- Integration hubs use type "middleware". Systems of record use type "onpremise". Data platforms use type "database". Partners use type "external".
- Do not use C4 shapes, BPM decisions, or landing-zone groups unless the user asks.
- Prefer left-to-right: channels/SaaS → middleware/API → cloud → system of record → data.
- Mark APIs with properties.componentType = "api".`,
    examples: [
      'Retail order-to-cash: Shopify, Stripe, MuleSoft, SAP S/4HANA, and a warehouse WMS',
      'Add an Azure API Management front door and Event Hubs to this integration landscape',
    ],
  },
  {
    id: 'solution',
    label: 'Solution architecture',
    matches: 'C4 people, systems, and containers',
    rules: `Draw a C4-style solution architecture.
- People and external actors: type "diagram", properties.shape "c4-person", category "Software Engineering".
- Software systems at the solution boundary: type "diagram", properties.shape "c4-system".
- Applications, APIs, and data stores inside the solution: type "diagram", properties.shape "c4-container".
- A named cloud product may use type "azure" or "aws" with vendor and service, but most boxes must stay C4 shapes.
- Do not drop down into classes, controllers, or landing-zone networks unless the user asks.`,
    examples: [
      'Order solution: customer, web app, mobile app, order API, order service, and a database',
      'Add a C4 container for billing between the API and the database',
    ],
  },
  {
    id: 'context',
    label: 'System context',
    matches: 'One system of interest, actors, and external systems',
    rules: `Draw a system context diagram.
- Exactly one system of interest: type "diagram", properties.shape "c4-system".
- Actors: type "diagram", properties.shape "c4-person".
- External systems keep their product type ("saas", "onpremise", "external", "azure", "aws") when a product is named; otherwise type "diagram" shape "c4-system".
- No containers, no internal modules, no network zones.
- Integrations are high-level relationships, not API operations.`,
    examples: [
      'System context for an order platform: customers, staff, CRM, payments, ERP, and warehouse',
      'Add a shipping partner as an external system around the system of interest',
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise architecture',
    matches: 'Capabilities, applications, data, and technology',
    rules: `Draw a layered enterprise architecture.
- Business capabilities: type "diagram", properties.shape "package", category "Software Engineering".
- Applications: type "saas", "onpremise", or "middleware" with a vendor.
- Data platforms: type "database". Technology and security: type "azure", "aws", or "cloud" with properties.service.
- Do not use C4 containers, C4 people, or BPM steps.`,
    examples: [
      'Enterprise layers: customer capability, CRM, ERP, data lake, identity, and an integration hub',
      'Add a data platform and the technology services that host the application portfolio',
    ],
  },
  {
    id: 'functional',
    label: 'Functional architecture',
    matches: 'Functions and information flows',
    rules: `Draw a functional decomposition.
- Functions: type "diagram", properties.shape "process", category "Software Engineering".
- Shared services: properties.shape "component". Reference data: properties.shape "datastore".
- Do not use cloud SKUs, C4 people, or landing zones.
- Integrations are information or control flows. Use protocol "Custom" unless a real interface is named.`,
    examples: [
      'Order functions: catalog, capture, promise, payment, fulfill, and notify',
      'Add a shared identity function and a master-data store used by capture',
    ],
  },
  {
    id: 'business',
    label: 'Business architecture',
    matches: 'Stakeholders, outcomes, value streams, and capabilities',
    rules: `Draw a business architecture context.
- Stakeholders: type "diagram", properties.shape "c4-person" or "actor", category "Business".
- Outcomes and capabilities: properties.shape "package", category "Business".
- Value streams: properties.shape "process", category "Business".
- Enabling applications, only if needed: type "saas" or "onpremise", category "Application".
- Integration labels are business relationships. Protocol "Custom" unless it is a real system interface.`,
    examples: [
      'Business context: customers, a service outcome, a buy-to-support value stream, and two capabilities',
      'Show which applications enable the fulfil capability',
    ],
  },
  {
    id: 'bpm',
    label: 'Business process',
    matches: 'Steps, decisions, and roles',
    rules: `Draw a business process.
- Steps: type "diagram", properties.shape "process".
- Gateways: properties.shape "decision". Roles: properties.shape "actor".
- Queues and handoffs: properties.shape "queue". Records: properties.shape "datastore".
- Category "Software Engineering". Protocol "Custom".
- Follow process order. Do not draw a system landscape.`,
    examples: [
      'Approval process: submit, validate, auto-approve decision, human review, complete',
      'Add an exception path when the decision fails',
    ],
  },
  {
    id: 'application',
    label: 'Application internals',
    matches: 'Modules, APIs, data stores, and queues inside one component',
    rules: `Draw the inside of one application.
- Modules: type "diagram", properties.shape "component" or "c4-container", category "Software Engineering".
- APIs: properties.shape "interface" and properties.componentType "api".
- Databases: properties.shape "datastore". Messaging: properties.shape "queue".
- Do not redraw the parent component as a peer. Do not add SaaS products, C4 people, or landing zones unless the user asks.
- 4 to 10 components.`,
    examples: [
      'Inside this service: REST API, domain, repository, and an outbox queue',
      'Add a datastore for the aggregate and a queue for domain events',
    ],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    matches: 'Landing zones, networks, and cloud services',
    rules: `Draw a physical cloud or network architecture.
- Zones and subnets: type "group", category "Infrastructure", properties.zone one of "Landing Zone", "Hub", "Spoke", "Public", "Private", "DMZ".
- Services: type "aws", "azure", or "cloud" with properties.vendor and properties.service set to the real product (Front Door, Firewall, App Gateway, AKS, Key Vault, Route 53, ALB).
- Do not use C4 containers, BPM steps, or business capabilities.`,
    examples: [
      'Azure hub-and-spoke: Front Door, Firewall, App Gateway, AKS, SQL, Key Vault, Entra ID',
      'AWS landing zone: Route 53, CloudFront, WAF, ALB, EKS in a private subnet, RDS, and IAM',
    ],
  },
  {
    id: 'sequence',
    label: 'Sequence',
    matches: 'Participants and messages for one interaction',
    rules: `Draw one sequence for the open integration.
- Participants are only the systems involved in this interaction. Prefer type "diagram" and properties.shape "component", or keep the type of an endpoint already named.
- Each integration is one message. The label is the message name. Direction follows the call.
- 2 to 8 participants. Do not draw the wider landscape.`,
    examples: [
      'Sequence: client calls the API, the API writes the order, then publishes an event',
      'Add the database read that happens before the response',
    ],
  },
]

const KIND_BY_ID = new Map(DIAGRAM_DRAW_KINDS.map((kind) => [kind.id, kind]))

const INFRA_ZONES = new Set(['landing zone', 'public', 'private', 'hub', 'spoke', 'dmz'])

export function isDiagramDrawSetting(value: unknown): value is DiagramDrawSetting {
  return value === 'auto' || KIND_BY_ID.has(value as DiagramDrawKind)
}

export function diagramDrawKindInfo(kind: DiagramDrawKind): DiagramDrawKindInfo {
  return KIND_BY_ID.get(kind) ?? DIAGRAM_DRAW_KINDS[0]
}

export interface ResolvedDiagramDraw {
  setting: DiagramDrawSetting
  kind: DiagramDrawKind
  info: DiagramDrawKindInfo
  canvasName: string
  /** Where the user is: root name, or the nested path. */
  canvasPath: string
  componentCount: number
  hint: string
}

export function resolveDiagramDraw(
  document: ArchitectureDocument,
  path: DiagramPath,
  setting: DiagramDrawSetting,
): ResolvedDiagramDraw {
  const kind = setting === 'auto' ? detectDiagramDrawKind(document, path) : setting
  const info = diagramDrawKindInfo(kind)
  const view = getDiagramView(document, path)
  const canvasName = path.length === 0 ? document.metadata.name : path[path.length - 1]?.label || document.metadata.name
  const canvasPath = path.length === 0 ? document.metadata.name : path.map((segment) => segment.label).join(' / ')
  const detected = setting === 'auto' ? `Detected ${info.label.toLowerCase()}` : info.label
  const count = view.systems.length
  const where = path.length === 0 ? `Canvas “${canvasName}”` : `Nested canvas “${canvasName}”`
  const hint = `${where}. ${detected}. ${count} component${count === 1 ? '' : 's'}. New components use ${info.matches}.`
  return { setting, kind, info, canvasName, canvasPath, componentCount: count, hint }
}

export function detectDiagramDrawKind(document: ArchitectureDocument, path: DiagramPath): DiagramDrawKind {
  if (path.length > 0 && isIntegrationPath(path[path.length - 1])) return 'sequence'

  const view = getDiagramView(document, path)
  const systems = view.systems.filter((system) => system.type !== 'note')
  const shapes = countShapes(systems)
  const c4Person = shapes['c4-person'] ?? 0
  const c4System = shapes['c4-system'] ?? 0
  const c4Container = shapes['c4-container'] ?? 0
  const process = shapes.process ?? 0
  const decision = shapes.decision ?? 0
  const actor = shapes.actor ?? 0
  const packages = shapes.package ?? 0
  const appShapes =
    (shapes.component ?? 0) +
    (shapes.interface ?? 0) +
    (shapes.class ?? 0) +
    (shapes.datastore ?? 0) +
    (shapes.queue ?? 0)
  const business = systems.filter((system) => /business/i.test(system.category)).length
  const aws = systems.filter((system) => system.type === 'aws').length
  const azure = systems.filter((system) => system.type === 'azure').length
  const products = systems.filter((system) =>
    system.type === 'saas' ||
    system.type === 'middleware' ||
    system.type === 'onpremise' ||
    system.type === 'database' ||
    system.type === 'external' ||
    system.type === 'powerplatform' ||
    system.type === 'cloud',
  ).length
  const infraZones = systems.filter((system) => {
    const zone = system.properties?.zone?.trim().toLowerCase()
    return system.type === 'group' && Boolean(zone && INFRA_ZONES.has(zone))
  }).length

  if (actor >= 1 && decision >= 1 && process >= 1) return 'bpm'
  if (business >= 2) return 'business'
  if (c4System >= 1 && c4Container === 0 && c4Person >= 1 && appShapes === 0) return 'context'
  if (c4System + c4Container >= 3) return 'solution'
  if (process >= 3 && process > appShapes) return 'functional'
  if (appShapes >= 2 && appShapes >= c4Container) return 'application'
  if (packages >= 2 && products >= 2) return 'enterprise'
  if ((infraZones >= 1 && aws + azure >= 2) || (aws + azure >= 3 && c4System + c4Container === 0 && products <= 1)) {
    return 'infrastructure'
  }
  if (products >= 2 || aws + azure >= 1) return 'integration'
  if (path.length > 0) return 'application'
  return kindFromName(document) ?? 'integration'
}

export function buildDiagramSystemPrompt(kind: DiagramDrawKind): string {
  const info = diagramDrawKindInfo(kind)
  return `You are drawing a ${info.label.toLowerCase()} diagram inside Architecture Visual Builder.
Return ONLY valid JSON for an architecture diagram. No markdown, no commentary, no code fences.

JSON shape:
{
  "metadata": { "name": "short name", "description": "1-2 sentences", "version": "1.0.0" },
  "systems": [
    {
      "id": "kebab-case-id",
      "type": "saas|aws|azure|powerplatform|cloud|onpremise|middleware|database|external|diagram|group",
      "label": "Display name",
      "category": "SaaS|AWS|Azure|Power Platform|Cloud|On-Premise|Middleware|Database|External|Software Engineering|Business|Application|Infrastructure",
      "position": { "x": 80, "y": 80 },
      "properties": {
        "vendor": "optional",
        "service": "optional product name",
        "description": "what this component does",
        "componentType": "api when this is an API",
        "shape": "c4-person|c4-system|c4-container|actor|process|decision|package|component|interface|datastore|queue",
        "zone": "Landing Zone|Hub|Spoke|Public|Private|DMZ when type is group"
      }
    }
  ],
  "integrations": [
    {
      "id": "int-kebab-id",
      "source": "system-id",
      "target": "system-id",
      "label": "flow or message name",
      "direction": "outbound|inbound|bidirectional",
      "protocol": "REST API|SOAP|GraphQL|SFTP|Kafka|MQTT|Webhook|ODBC/JDBC|File Transfer|Custom",
      "frequency": "real-time|near-real-time|batch|event-driven|scheduled",
      "dataFormat": "JSON|XML|CSV|Avro|EDI",
      "description": "what moves and why"
    }
  ]
}

Rules:
- This diagram type is ${info.label}. ${info.matches}.
${info.rules}
- If the canvas summary lists types and shapes already in use, new components must use that same type and shape family.
- Do not switch to a different architecture style unless the user explicitly asks.
- 4 to 14 systems unless the user asks for fewer or more (hard cap 20).
- Every integration source and target MUST be an existing system id.
- Give every system a useful description. Use real product names when the user names them.
- If the user is refining this canvas, keep stable ids when the same systems remain.
- If the context lists zone boxes, keep every listed component id unchanged so each box stays around the same components.
- If images are attached, read every box and connector, then express that picture with this diagram type's components.
- Do not invent credentials or secrets.`
}

export function summarizeCanvasForDraw(
  document: ArchitectureDocument,
  path: DiagramPath,
  kind: DiagramDrawKind,
  includeComponents: boolean,
): string {
  const info = diagramDrawKindInfo(kind)
  const view = getDiagramView(document, path)
  const lines = [
    `Diagram type: ${info.label}. Draw components that match this type (${info.matches}).`,
    `Open canvas: ${path.length === 0 ? document.metadata.name : path.map((segment) => segment.label).join(' / ')}`,
    path.length === 0 ? 'Level: root diagram' : `Level: nested ${isIntegrationPath(path[path.length - 1]) ? 'sequence' : 'component'} diagram`,
  ]
  const parent = describeParent(document, path)
  if (parent) lines.push(parent)
  if (!includeComponents) {
    lines.push('The user did not include the components already on this canvas. Follow the diagram type only.')
    return lines.join('\n')
  }

  const systems = view.systems.filter((system) => system.type !== 'note')
  lines.push(vocabularyLine(systems))
  lines.push('Components on this canvas:')
  if (systems.length === 0) {
    lines.push(path.length > 0
      ? '(none yet — invent a coherent set that belongs inside the parent, using this diagram type)'
      : '(none yet)')
  } else {
    for (const system of systems.slice(0, 40)) {
      lines.push(`- ${system.id}: ${system.label} | type=${system.type} | category=${system.category}${shapeOf(system)}${productOf(system)}${system.properties?.description ? ` — ${system.properties.description}` : ''}`)
    }
  }
  lines.push('Integrations on this canvas:')
  if (view.integrations.length === 0) lines.push('(none)')
  else {
    for (const integration of view.integrations.slice(0, 40)) {
      lines.push(`- ${integration.id}: ${integration.source} -> ${integration.target}: ${integration.label} via ${integration.protocol}`)
    }
  }
  const zones = describeZoneLinks(view.drawings ?? [], systems)
  if (zones) lines.push(zones)
  return lines.join('\n')
}

function describeParent(document: ArchitectureDocument, path: DiagramPath): string | undefined {
  if (path.length === 0) return undefined
  const segment = path[path.length - 1]
  const parentView = getDiagramView(document, path.slice(0, -1))
  if (isIntegrationPath(segment)) {
    const integration = parentView.integrations.find((item) => item.id === segment.systemId)
    if (!integration) return `Parent integration: ${segment.label}`
    const source = labelOf(parentView.systems, integration.source)
    const target = labelOf(parentView.systems, integration.target)
    return `Parent integration: ${integration.label} (${source} → ${target}, ${integration.protocol}). Draw only this interaction.`
  }
  const system = parentView.systems.find((item) => item.id === segment.systemId)
  if (!system) return `Parent component: ${segment.label}`
  return `Parent component: ${system.label} | type=${system.type}${shapeOf(system)}${system.properties?.description ? ` — ${system.properties.description}` : ''}. Draw the inside of this component, not a new peer.`
}

function vocabularyLine(systems: SystemNode[]): string {
  if (systems.length === 0) return 'No component types on this canvas yet.'
  const types = tally(systems.map((system) => system.type))
  const shapes = tally(
    systems.map((system) => system.properties?.shape?.trim()).filter((shape): shape is string => Boolean(shape)),
  )
  const typeText = types.map(([name, count]) => `${name} × ${count}`).join(', ')
  const shapeText = shapes.length ? shapes.map(([name, count]) => `${name} × ${count}`).join(', ') : 'none'
  return `Match these existing component types: ${typeText}. Shapes in use: ${shapeText}.`
}

function tally(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function countShapes(systems: SystemNode[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const system of systems) {
    const shape = system.properties?.shape?.trim()
    if (!shape) continue
    counts[shape] = (counts[shape] ?? 0) + 1
  }
  return counts
}

function shapeOf(system: SystemNode): string {
  return system.properties?.shape ? ` | shape=${system.properties.shape}` : ''
}

function productOf(system: SystemNode): string {
  const vendor = system.properties?.vendor
  const service = system.properties?.service
  if (!vendor && !service) return ''
  return ` | ${[vendor, service].filter(Boolean).join(' ')}`
}

function labelOf(systems: SystemNode[], id: string): string {
  return systems.find((system) => system.id === id)?.label ?? id
}

function kindFromName(document: ArchitectureDocument): DiagramDrawKind | undefined {
  const name = `${document.metadata.name} ${document.metadata.description ?? ''}`.toLowerCase()
  if (document.metadata.infrastructure || /landing zone|infrastructure|hub-and-spoke|hub and spoke/.test(name)) {
    return 'infrastructure'
  }
  if (/system context|contextual/.test(name)) return 'context'
  if (/solution architecture|\bc4\b/.test(name)) return 'solution'
  if (/enterprise architecture/.test(name)) return 'enterprise'
  if (/functional architecture/.test(name)) return 'functional'
  if (/business architecture|business context/.test(name)) return 'business'
  if (/\bbpm\b|business process/.test(name)) return 'bpm'
  if (/sequence/.test(name)) return 'sequence'
  return undefined
}
