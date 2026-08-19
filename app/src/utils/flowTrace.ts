import type { Edge } from '@xyflow/react'
import type { IntegrationDirection } from '../types'
import type { IntegrationEdgeData } from './jsonIO'

export type FlowColorBy = 'direction' | 'protocol' | 'custom' | 'path'

export const PATH_COLORS = [
  '#0d9488',
  '#d97706',
  '#db2777',
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
  '#be123c',
  '#0f766e',
  '#c026d3',
]

export const PROTOCOL_COLORS: Record<string, string> = {
  'REST API': '#6366f1',
  SOAP: '#8b5cf6',
  GraphQL: '#ec4899',
  SFTP: '#f59e0b',
  Kafka: '#f97316',
  MQTT: '#14b8a6',
  Webhook: '#0ea5e9',
  'ODBC/JDBC': '#10b981',
  'File Transfer': '#64748b',
  Custom: '#334155',
}

export const DIRECTION_COLORS: Record<string, string> = {
  inbound: '#0ea5e9',
  outbound: '#6366f1',
  bidirectional: '#8b5cf6',
}

const STORAGE_KEY = 'architecture-visual-builder-flow-style'

export interface FlowStyle {
  colorBy: FlowColorBy
  endToEnd: boolean
}

export function loadFlowStyle(): FlowStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { colorBy: 'direction', endToEnd: true }
    const parsed = JSON.parse(raw) as Partial<FlowStyle>
    const colorBy = parsed.colorBy
    return {
      colorBy:
        colorBy === 'protocol' || colorBy === 'custom' || colorBy === 'path' || colorBy === 'direction'
          ? colorBy
          : 'direction',
      endToEnd: parsed.endToEnd !== false,
    }
  } catch {
    return { colorBy: 'direction', endToEnd: true }
  }
}

export function saveFlowStyle(style: FlowStyle) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(style))
  } catch {
    /* ignore */
  }
}

export interface FlowPath {
  id: string
  nodeIds: string[]
  edgeIds: string[]
  labels: string[]
  color: string
}

export interface FlowTrace {
  paths: FlowPath[]
  edgeHop: Map<string, 'out' | 'in'>
  edgePathColor: Map<string, string>
  nodeIds: Set<string>
}

type FlowEdge = {
  id: string
  source: string
  target: string
  direction: IntegrationDirection
}

const MAX_DEPTH = 10
const MAX_PATHS = 16

export function resolveEdgeColor(
  data: IntegrationEdgeData | undefined,
  colorBy: FlowColorBy,
): string {
  if (!data) return DIRECTION_COLORS.outbound
  if (data.flowPathColor && (colorBy === 'path' || data.focusRelation === 'out' || data.focusRelation === 'in')) {
    return data.flowPathColor
  }
  if (colorBy === 'custom' && data.color) return data.color
  if (colorBy === 'protocol') return PROTOCOL_COLORS[data.protocol] ?? DIRECTION_COLORS.outbound
  if (colorBy === 'path' && data.color) return data.color
  return DIRECTION_COLORS[data.direction] ?? DIRECTION_COLORS.outbound
}

export function traceEndToEnd(
  edges: Edge<IntegrationEdgeData>[],
  nodeLabels: Map<string, string>,
  focusNodeId: string | null,
  focusEdgeId: string | null,
): FlowTrace {
  const empty: FlowTrace = {
    paths: [],
    edgeHop: new Map(),
    edgePathColor: new Map(),
    nodeIds: new Set(),
  }
  if (!focusNodeId && !focusEdgeId) return empty

  const flowEdges: FlowEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    direction: edge.data?.direction ?? 'outbound',
  }))

  const { outgoing, incoming } = buildAdjacency(flowEdges)
  const seed = focusNodeId ?? edgeEndpoint(flowEdges, focusEdgeId)
  if (!seed) return empty

  const downstreamNodes = walk(seed, outgoing)
  const upstreamNodes = walk(seed, incoming)
  const sources = [...upstreamNodes].filter((id) => (incoming.get(id)?.length ?? 0) === 0 || id === seed)
  const sinks = [...downstreamNodes].filter((id) => (outgoing.get(id)?.length ?? 0) === 0 || id === seed)
  const startNodes = sources.length > 0 ? sources : [seed]
  const endNodes = sinks.length > 0 ? sinks : [seed]

  const rawPaths: string[][] = []
  for (const start of startNodes) {
    enumeratePaths(start, endNodes, outgoing, focusNodeId, focusEdgeId, rawPaths)
    if (rawPaths.length >= MAX_PATHS) break
  }

  if (rawPaths.length === 0 && focusNodeId) {
    const local: string[][] = []
    for (const step of outgoing.get(focusNodeId) ?? []) {
      local.push([focusNodeId, step.nodeId])
    }
    for (const step of incoming.get(focusNodeId) ?? []) {
      local.push([step.nodeId, focusNodeId])
    }
    rawPaths.push(...local)
  }

  const unique = dedupePaths(rawPaths)
  const paths: FlowPath[] = unique.map((nodeIds, index) => {
    const edgeIds = pathEdgeIds(nodeIds, outgoing, incoming)
    return {
      id: `path-${index + 1}`,
      nodeIds,
      edgeIds,
      labels: nodeIds.map((id) => nodeLabels.get(id) ?? id),
      color: PATH_COLORS[index % PATH_COLORS.length],
    }
  })

  const edgeHop = new Map<string, 'out' | 'in'>()
  const edgePathColor = new Map<string, string>()
  const nodeIds = new Set<string>()

  for (const id of downstreamNodes) {
    for (const step of outgoing.get(id) ?? []) {
      if (downstreamNodes.has(step.nodeId) || id === seed) edgeHop.set(step.edgeId, 'out')
    }
  }
  for (const id of upstreamNodes) {
    for (const step of incoming.get(id) ?? []) {
      if (upstreamNodes.has(step.nodeId) || id === seed) {
        if (!edgeHop.has(step.edgeId)) edgeHop.set(step.edgeId, 'in')
      }
    }
  }

  for (const path of paths) {
    path.nodeIds.forEach((id) => nodeIds.add(id))
    path.edgeIds.forEach((id) => {
      if (!edgePathColor.has(id)) edgePathColor.set(id, path.color)
      if (!edgeHop.has(id)) edgeHop.set(id, 'out')
    })
  }

  if (focusNodeId) nodeIds.add(focusNodeId)

  return { paths, edgeHop, edgePathColor, nodeIds }
}

function edgeEndpoint(edges: FlowEdge[], edgeId: string | null): string | null {
  if (!edgeId) return null
  const edge = edges.find((e) => e.id === edgeId)
  return edge?.source ?? null
}

function buildAdjacency(edges: FlowEdge[]) {
  const outgoing = new Map<string, Array<{ nodeId: string; edgeId: string }>>()
  const incoming = new Map<string, Array<{ nodeId: string; edgeId: string }>>()

  const add = (
    map: Map<string, Array<{ nodeId: string; edgeId: string }>>,
    from: string,
    to: string,
    edgeId: string,
  ) => {
    const list = map.get(from) ?? []
    list.push({ nodeId: to, edgeId })
    map.set(from, list)
  }

  for (const edge of edges) {
    const forward = edge.direction !== 'inbound'
    const reverse = edge.direction === 'inbound' || edge.direction === 'bidirectional'
    if (forward) {
      add(outgoing, edge.source, edge.target, edge.id)
      add(incoming, edge.target, edge.source, edge.id)
    }
    if (reverse) {
      add(outgoing, edge.target, edge.source, edge.id)
      add(incoming, edge.source, edge.target, edge.id)
    }
  }

  return { outgoing, incoming }
}

function walk(
  start: string,
  adj: Map<string, Array<{ nodeId: string; edgeId: string }>>,
): Set<string> {
  const seen = new Set<string>([start])
  const queue = [start]
  while (queue.length) {
    const current = queue.shift()!
    for (const step of adj.get(current) ?? []) {
      if (seen.has(step.nodeId)) continue
      seen.add(step.nodeId)
      queue.push(step.nodeId)
    }
  }
  return seen
}

function enumeratePaths(
  start: string,
  ends: string[],
  outgoing: Map<string, Array<{ nodeId: string; edgeId: string }>>,
  mustNode: string | null,
  mustEdge: string | null,
  out: string[][],
) {
  const endSet = new Set(ends)
  const visit = (node: string, trail: string[], usedEdges: Set<string>) => {
    if (out.length >= MAX_PATHS || trail.length > MAX_DEPTH) return
    if (endSet.has(node) && trail.length > 1) {
      const includeNode = !mustNode || trail.includes(mustNode)
      const includeEdge = !mustEdge || usedEdges.has(mustEdge)
      if (includeNode && includeEdge) out.push([...trail])
    }
    for (const step of outgoing.get(node) ?? []) {
      if (trail.includes(step.nodeId) || usedEdges.has(step.edgeId)) continue
      usedEdges.add(step.edgeId)
      trail.push(step.nodeId)
      visit(step.nodeId, trail, usedEdges)
      trail.pop()
      usedEdges.delete(step.edgeId)
    }
  }
  visit(start, [start], new Set())
}

function dedupePaths(paths: string[][]): string[][] {
  const seen = new Set<string>()
  const unique: string[][] = []
  for (const path of paths) {
    const key = path.join('>')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(path)
  }
  return unique
}

function pathEdgeIds(
  nodeIds: string[],
  outgoing: Map<string, Array<{ nodeId: string; edgeId: string }>>,
  incoming: Map<string, Array<{ nodeId: string; edgeId: string }>>,
): string[] {
  const ids: string[] = []
  for (let i = 0; i < nodeIds.length - 1; i += 1) {
    const from = nodeIds[i]
    const to = nodeIds[i + 1]
    const hit =
      outgoing.get(from)?.find((step) => step.nodeId === to) ??
      incoming.get(to)?.find((step) => step.nodeId === from)
    if (hit) ids.push(hit.edgeId)
  }
  return ids
}
