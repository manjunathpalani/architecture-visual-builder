import type { Edge, Node } from '@xyflow/react'
import {
  getFlowNodeType,
  parseEdgeRouting,
  parseLineStyle,
  parseLineWeight,
  type ArchitectureDocument,
  type Integration,
  type IntegrationDirection,
  type IntegrationFrequency,
  type IntegrationLineStyle,
  type IntegrationLineWeight,
  type IntegrationProtocol,
  type Position,
  type SystemNode,
  type SystemProperties,
  type SystemType,
  type EdgeRouting,
} from '../types'
import { sanitizeChangeDesigns } from './changeDesign'

export interface IntegrationNodeData extends Record<string, unknown> {
  systemType: SystemType
  label: string
  category: string
  properties: SystemProperties
  subDiagramStats?: { systems: number; integrations: number }
  canDrillIn?: boolean
  hasSubDiagramContent?: boolean
  /** Runtime: connected to the selected node (neighbor highlight) */
  isFlowNeighbor?: boolean
  /** Runtime: this node is the selection focus */
  isFlowFocus?: boolean
  /** Runtime: node sits on an end-to-end path through the selection */
  isFlowPath?: boolean
  /** Runtime: this node is the current hop while playing an end-to-end flow */
  isFlowPlayCurrent?: boolean
  /** Runtime: show connection ports (touch points) on this node */
  showTouchPoints?: boolean
  isStateContext?: boolean
  /** Runtime: this node has a coding-agent task in a technical change design */
  hasChangeTask?: boolean
}

/** Visual relation of an edge to the currently selected node (canvas-only) */
export type EdgeFocusRelation = 'out' | 'in' | 'unrelated' | 'idle'

export interface IntegrationEdgeData extends Record<string, unknown> {
  label: string
  direction: IntegrationDirection
  protocol: IntegrationProtocol
  frequency: IntegrationFrequency
  dataFormat: string
  description: string
  interfaceSpec?: string
  color?: string
  lineStyle?: IntegrationLineStyle
  lineWeight?: IntegrationLineWeight
  changeStatus?: 'unchanged' | 'new' | 'modified' | 'retired'
  routing?: EdgeRouting
  waypoints?: Position[]
  /** Runtime: relative flow vs selected box — out leaves selection, in enters it */
  focusRelation?: EdgeFocusRelation
  /** Runtime: id of the selected node driving highlight */
  focusNodeId?: string | null
  /** Runtime: color assigned to this hop's end-to-end path */
  flowPathColor?: string
  /** Runtime: how edges are colored on the canvas */
  colorBy?: 'direction' | 'protocol' | 'custom' | 'path'
  /** Runtime: 1-based hop number on an isolated/playing path */
  flowHopIndex?: number
  /** Runtime: this edge is the current hop while playing a flow */
  flowPlayCurrent?: boolean
  jiraIssueKey?: string
  jiraIssueSummary?: string
  jiraIssueUrl?: string
  adoProject?: string
  adoWorkItemId?: string
  adoWorkItemTitle?: string
  adoWorkItemUrl?: string
}

export function createEmptyDocument(name = 'New Integration Architecture'): ArchitectureDocument {
  return {
    metadata: {
      name,
      description: '',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    },
    systems: [],
    integrations: [],
  }
}

const DEFAULT_NODE_SIZES: Record<string, { width: number; height: number }> = {
  integration: { width: 180, height: 90 },
  diagram: { width: 160, height: 100 },
  annotation: { width: 180, height: 120 },
  group: { width: 320, height: 200 },
  shape: { width: 160, height: 100 },
}

function getNodeDimensions(
  system: SystemNode,
  flowType: string,
): { width: number; height: number } {
  const defaults = DEFAULT_NODE_SIZES[flowType] ?? DEFAULT_NODE_SIZES.integration
  const width = system.properties?.width ? Number(system.properties.width) : defaults.width
  const height = system.properties?.height ? Number(system.properties.height) : defaults.height
  return { width, height }
}

export function documentToFlow(document: ArchitectureDocument): {
  nodes: Node<IntegrationNodeData>[]
  edges: Edge<IntegrationEdgeData>[]
} {
  const nodes: Node<IntegrationNodeData>[] = document.systems.map((system) => {
    const flowType = getFlowNodeType(system.type)
    const { width, height } = getNodeDimensions(system, flowType)

    return {
      id: system.id,
      type: flowType,
      position: system.position,
      zIndex: flowType === 'group' ? -1 : 0,
      data: {
        systemType: system.type,
        label: system.label,
        category: system.category,
        properties: system.properties ?? {},
      },
      style: { width, height },
    }
  })

  const edges: Edge<IntegrationEdgeData>[] = document.integrations.map((integration) => ({
    id: integration.id,
    source: integration.source,
    target: integration.target,
    sourceHandle: integration.sourceHandle,
    targetHandle: integration.targetHandle,
    type: 'integration',
    label: integration.label,
    data: {
      label: integration.label,
      direction: integration.direction,
      protocol: integration.protocol,
      frequency: integration.frequency,
      dataFormat: integration.dataFormat ?? 'JSON',
      description: integration.description ?? '',
      interfaceSpec: integration.interfaceSpec,
      color: integration.color,
      lineStyle: integration.lineStyle ? parseLineStyle(integration.lineStyle) : undefined,
      lineWeight: integration.lineWeight ? parseLineWeight(integration.lineWeight) : undefined,
      changeStatus: integration.changeStatus ?? 'unchanged',
      routing: parseEdgeRouting(integration.routing),
      waypoints: integration.waypoints ?? [],
      jiraIssueKey: integration.jiraIssueKey,
      jiraIssueSummary: integration.jiraIssueSummary,
      jiraIssueUrl: integration.jiraIssueUrl,
      adoProject: integration.adoProject,
      adoWorkItemId: integration.adoWorkItemId,
      adoWorkItemTitle: integration.adoWorkItemTitle,
      adoWorkItemUrl: integration.adoWorkItemUrl,
    },
  }))

  return { nodes, edges }
}

export function flowToDocument(
  nodes: Node<IntegrationNodeData>[],
  edges: Edge<IntegrationEdgeData>[],
  metadata: ArchitectureDocument['metadata'],
): ArchitectureDocument {
  const systems: SystemNode[] = nodes.map((node) => {
    const width = node.measured?.width ?? node.style?.width
    const height = node.measured?.height ?? node.style?.height
    const properties: SystemProperties = { ...node.data.properties }

    if (width) properties.width = String(Math.round(Number(width)))
    if (height) properties.height = String(Math.round(Number(height)))

    return {
      id: node.id,
      type: node.data.systemType,
      label: node.data.label,
      category: node.data.category,
      position: node.position,
      properties,
    }
  })

  const integrations: Integration[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: edge.data?.label ?? String(edge.label ?? 'Integration'),
    direction: edge.data?.direction ?? 'outbound',
    protocol: edge.data?.protocol ?? 'REST API',
    frequency: edge.data?.frequency ?? 'real-time',
    dataFormat: edge.data?.dataFormat ?? 'JSON',
    description: edge.data?.description ?? '',
    interfaceSpec: edge.data?.interfaceSpec,
    color: edge.data?.color,
    lineStyle: edge.data?.lineStyle,
    lineWeight: edge.data?.lineWeight,
    changeStatus: edge.data?.changeStatus,
    routing: parseEdgeRouting(edge.data?.routing),
    waypoints: edge.data?.waypoints,
    jiraIssueKey: edge.data?.jiraIssueKey,
    jiraIssueSummary: edge.data?.jiraIssueSummary,
    jiraIssueUrl: edge.data?.jiraIssueUrl,
    adoProject: edge.data?.adoProject,
    adoWorkItemId: edge.data?.adoWorkItemId,
    adoWorkItemTitle: edge.data?.adoWorkItemTitle,
    adoWorkItemUrl: edge.data?.adoWorkItemUrl,
  }))

  return {
    metadata: {
      ...metadata,
      updatedAt: new Date().toISOString(),
    },
    systems,
    integrations,
  }
}

export function parseArchitectureJson(json: string): ArchitectureDocument {
  const parsed = JSON.parse(json) as ArchitectureDocument

  if (!parsed.metadata || !Array.isArray(parsed.systems) || !Array.isArray(parsed.integrations)) {
    throw new Error('Invalid architecture JSON: requires metadata, systems, and integrations')
  }

  return {
    ...parsed,
    changeDesigns: sanitizeChangeDesigns(parsed.changeDesigns),
  }
}

export function serializeArchitecture(document: ArchitectureDocument): string {
  return JSON.stringify(document, null, 2)
}

export function downloadJson(architecture: ArchitectureDocument, filename?: string) {
  const blob = new Blob([serializeArchitecture(architecture)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename ?? `${architecture.metadata.name.replace(/\s+/g, '-').toLowerCase()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}