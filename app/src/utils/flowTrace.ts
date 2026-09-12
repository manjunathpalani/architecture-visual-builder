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
  none: '#64748b',
}

const STORAGE_KEY = 'architecture-visual-builder-flow-style-v3'

export type FlowScope = 'direct' | 'touches' | 'chain'

export interface FlowStyle {
  colorBy: FlowColorBy
  scope: FlowScope
  /** @deprecated derived from scope === 'chain' */
  endToEnd: boolean
}

const SCOPES: FlowScope[] = ['direct', 'touches', 'chain']

export function loadFlowStyle(): FlowStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { colorBy: 'direction', scope: 'direct', endToEnd: false }
    const parsed = JSON.parse(raw) as Partial<FlowStyle> & { endToEnd?: boolean }
    const colorBy = parsed.colorBy
    const scope: FlowScope = SCOPES.includes(parsed.scope as FlowScope)
      ? (parsed.scope as FlowScope)
      : parsed.endToEnd
        ? 'chain'
        : 'direct'
    return {
      colorBy:
        colorBy === 'protocol' || colorBy === 'custom' || colorBy === 'path' || colorBy === 'direction'
          ? colorBy
          : 'direction',
      scope,
      endToEnd: scope === 'chain',
    }
  } catch {
    return { colorBy: 'direction', scope: 'direct', endToEnd: false }
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
  /** Nodes that share an integration line with the selection (1 hop). */
  directNodeIds: Set<string>
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
  const pathLocked = Boolean(data.flowPlayCurrent) || data.flowHopIndex != null
  if (data.flowPathColor && (colorBy === 'path' || pathLocked)) {
    return data.flowPathColor
  }
  if (data.color) return data.color
  if (colorBy === 'protocol') return PROTOCOL_COLORS[data.protocol] ?? DIRECTION_COLORS.outbound
  return DIRECTION_COLORS[data.direction] ?? DIRECTION_COLORS.outbound
}

export function isolateFlowPath(trace: FlowTrace, pathId: string): FlowTrace {
  const path = trace.paths.find((item) => item.id === pathId)
  if (!path) return trace
  const nodeIds = new Set(path.nodeIds)
  const edgeHop = new Map<string, 'out' | 'in'>()
  const edgePathColor = new Map<string, string>()
  for (const id of path.edgeIds) {
    edgeHop.set(id, trace.edgeHop.get(id) ?? 'out')
    edgePathColor.set(id, path.color)
  }
  const directNodeIds = new Set([...trace.directNodeIds].filter((id) => nodeIds.has(id)))
  if (path.nodeIds.length >= 2) directNodeIds.add(path.nodeIds[1])
  return { paths: [path], edgeHop, edgePathColor, nodeIds, directNodeIds }
}

export function longestFlowPath(trace: FlowTrace | null | undefined): FlowPath | null {
  if (!trace || trace.paths.length === 0) return null
  return [...trace.paths].sort((a, b) => b.nodeIds.length - a.nodeIds.length || b.edgeIds.length - a.edgeIds.length)[0]
}

export function traceFromSinglePath(path: FlowPath): FlowTrace {
  const nodeIds = new Set(path.nodeIds)
  const edgeHop = new Map<string, 'out' | 'in'>()
  const edgePathColor = new Map<string, string>()
  path.edgeIds.forEach((id) => {
    edgeHop.set(id, 'out')
    edgePathColor.set(id, path.color)
  })
  const directNodeIds = new Set<string>()
  if (path.nodeIds[0]) directNodeIds.add(path.nodeIds[0])
  if (path.nodeIds[1]) directNodeIds.add(path.nodeIds[1])
  return { paths: [path], edgeHop, edgePathColor, nodeIds, directNodeIds }
}

export function findPathBetween(
  edges: Edge<IntegrationEdgeData>[],
  nodeLabels: Map<string, string>,
  fromId: string,
  toId: string,
): FlowPath | null {
  if (!fromId || !toId || fromId === toId) return null
  const flowEdges: FlowEdge[] = edges
    .filter((edge) => edge.source && edge.target && nodeLabels.has(edge.source) && nodeLabels.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      direction: edge.data?.direction ?? 'outbound',
    }))

  const search = (directed: boolean): FlowPath | null => {
    const outgoing = new Map<string, Array<{ nodeId: string; edgeId: string }>>()
    for (const edge of flowEdges) {
      const hops = directed
        ? directedHops(edge)
        : [
            { from: edge.source, to: edge.target },
            { from: edge.target, to: edge.source },
          ]
      for (const hop of hops) {
        const list = outgoing.get(hop.from) ?? []
        list.push({ nodeId: hop.to, edgeId: edge.id })
        outgoing.set(hop.from, list)
      }
    }
    const parent = new Map<string, { prev: string; edgeId: string }>()
    const seen = new Set<string>([fromId])
    const queue = [fromId]
    while (queue.length) {
      const current = queue.shift()!
      for (const step of outgoing.get(current) ?? []) {
        if (seen.has(step.nodeId)) continue
        seen.add(step.nodeId)
        parent.set(step.nodeId, { prev: current, edgeId: step.edgeId })
        if (step.nodeId === toId) {
          const nodeIds = [toId]
          const edgeIds: string[] = []
          let cursor = toId
          while (cursor !== fromId) {
            const hop = parent.get(cursor)
            if (!hop) break
            edgeIds.unshift(hop.edgeId)
            nodeIds.unshift(hop.prev)
            cursor = hop.prev
          }
          return {
            id: `between-${fromId}-${toId}`,
            nodeIds,
            edgeIds,
            labels: nodeIds.map((id) => nodeLabels.get(id) ?? id),
            color: PATH_COLORS[0],
          }
        }
        queue.push(step.nodeId)
      }
    }
    return null
  }

  return search(true) ?? search(false)
}

export function traceEndToEnd(
  edges: Edge<IntegrationEdgeData>[],
  nodeLabels: Map<string, string>,
  focusNodeId: string | null,
  focusEdgeId: string | null,
): FlowTrace {
  return traceSelectionFlow(edges, nodeLabels, focusNodeId, focusEdgeId, true)
}

/** Highlight only nodes/edges actually linked to the selection. */
export function traceSelectionFlow(
  edges: Edge<IntegrationEdgeData>[],
  nodeLabels: Map<string, string>,
  focusNodeId: string | null,
  focusEdgeId: string | null,
  endToEnd = false,
): FlowTrace {
  const empty: FlowTrace = {
    paths: [],
    edgeHop: new Map(),
    edgePathColor: new Map(),
    nodeIds: new Set(),
    directNodeIds: new Set(),
  }
  if (!focusNodeId && !focusEdgeId) return empty

  const flowEdges: FlowEdge[] = edges
    .filter((edge) => edge.source && edge.target && nodeLabels.has(edge.source) && nodeLabels.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      direction: edge.data?.direction ?? 'outbound',
    }))

  const focusEdge = focusEdgeId ? flowEdges.find((edge) => edge.id === focusEdgeId) ?? null : null
  const seed = focusNodeId ?? focusEdge?.source ?? null
  if (!seed) return empty

  const incident = focusNodeId
    ? flowEdges.filter((edge) => edge.source === focusNodeId || edge.target === focusNodeId)
    : focusEdge
      ? [focusEdge]
      : []

  const directNodeIds = new Set<string>()
  const nodeIds = new Set<string>()
  const edgeHop = new Map<string, 'out' | 'in'>()
  const edgePathColor = new Map<string, string>()
  const paths: FlowPath[] = []

  if (focusNodeId) nodeIds.add(focusNodeId)
  if (focusEdge) {
    nodeIds.add(focusEdge.source)
    nodeIds.add(focusEdge.target)
    directNodeIds.add(focusEdge.source)
    directNodeIds.add(focusEdge.target)
  }

  incident.forEach((edge, index) => {
    const other = edge.source === seed ? edge.target : edge.source
    directNodeIds.add(other)
    nodeIds.add(other)
    const hop: 'out' | 'in' = edge.source === seed ? 'out' : 'in'
    edgeHop.set(edge.id, hop)
    const color = PATH_COLORS[index % PATH_COLORS.length]
    edgePathColor.set(edge.id, color)
    paths.push({
      id: `link-${edge.id}`,
      nodeIds: [seed, other],
      edgeIds: [edge.id],
      labels: [nodeLabels.get(seed) ?? seed, nodeLabels.get(other) ?? other],
      color,
    })
  })

  if (endToEnd) {
    const down = walkDirected(seed, flowEdges, 'down')
    const up = walkDirected(seed, flowEdges, 'up')
    down.nodeIds.forEach((id) => nodeIds.add(id))
    up.nodeIds.forEach((id) => nodeIds.add(id))
    down.steps.forEach((step) => {
      if (!edgeHop.has(step.edgeId)) edgeHop.set(step.edgeId, 'out')
    })
    up.steps.forEach((step) => {
      if (!edgeHop.has(step.edgeId)) edgeHop.set(step.edgeId, 'in')
    })
    const chainPaths = collectDirectedPaths(seed, flowEdges, nodeLabels)
    chainPaths.forEach((path, index) => {
      if (path.nodeIds.length < 3) return
      const color = PATH_COLORS[(paths.length + index) % PATH_COLORS.length]
      path.edgeIds.forEach((id) => {
        if (!edgePathColor.has(id)) edgePathColor.set(id, color)
      })
      paths.push({ ...path, color })
    })
  }

  return { paths: paths.slice(0, MAX_PATHS), edgeHop, edgePathColor, nodeIds, directNodeIds }
}

function directedHops(edge: FlowEdge): Array<{ from: string; to: string }> {
  if (edge.direction === 'inbound') return [{ from: edge.target, to: edge.source }]
  if (edge.direction === 'bidirectional' || edge.direction === 'none') {
    return [
      { from: edge.source, to: edge.target },
      { from: edge.target, to: edge.source },
    ]
  }
  return [{ from: edge.source, to: edge.target }]
}

function walkDirected(
  start: string,
  edges: FlowEdge[],
  toward: 'down' | 'up',
): { nodeIds: Set<string>; steps: Array<{ edgeId: string; from: string; to: string }> } {
  const nodeIds = new Set<string>([start])
  const steps: Array<{ edgeId: string; from: string; to: string }> = []
  const used = new Set<string>()
  const queue = [start]
  while (queue.length) {
    const current = queue.shift()!
    for (const edge of edges) {
      for (const hop of directedHops(edge)) {
        const from = toward === 'down' ? hop.from : hop.to
        const to = toward === 'down' ? hop.to : hop.from
        if (from !== current) continue
        const key = `${edge.id}:${from}:${to}`
        if (used.has(key)) continue
        used.add(key)
        steps.push({ edgeId: edge.id, from, to })
        if (!nodeIds.has(to)) {
          nodeIds.add(to)
          queue.push(to)
        }
      }
    }
  }
  return { nodeIds, steps }
}

function collectDirectedPaths(
  start: string,
  edges: FlowEdge[],
  nodeLabels: Map<string, string>,
): FlowPath[] {
  const outgoing = new Map<string, Array<{ nodeId: string; edgeId: string }>>()
  for (const edge of edges) {
    for (const hop of directedHops(edge)) {
      const list = outgoing.get(hop.from) ?? []
      list.push({ nodeId: hop.to, edgeId: edge.id })
      outgoing.set(hop.from, list)
    }
  }
  const found: FlowPath[] = []
  const visit = (node: string, trail: string[], edgeIds: string[]) => {
    if (found.length >= MAX_PATHS || trail.length > MAX_DEPTH) return
    const next = outgoing.get(node) ?? []
    if (next.length === 0) {
      if (trail.length > 2) {
        found.push({
          id: `path-${found.length + 1}`,
          nodeIds: [...trail],
          edgeIds: [...edgeIds],
          labels: trail.map((id) => nodeLabels.get(id) ?? id),
          color: PATH_COLORS[found.length % PATH_COLORS.length],
        })
      }
      return
    }
    let branched = false
    for (const step of next) {
      if (trail.includes(step.nodeId) || edgeIds.includes(step.edgeId)) continue
      branched = true
      trail.push(step.nodeId)
      edgeIds.push(step.edgeId)
      visit(step.nodeId, trail, edgeIds)
      edgeIds.pop()
      trail.pop()
    }
    if (!branched && trail.length > 2) {
      found.push({
        id: `path-${found.length + 1}`,
        nodeIds: [...trail],
        edgeIds: [...edgeIds],
        labels: trail.map((id) => nodeLabels.get(id) ?? id),
        color: PATH_COLORS[found.length % PATH_COLORS.length],
      })
    }
  }
  visit(start, [start], [])
  return found
}
