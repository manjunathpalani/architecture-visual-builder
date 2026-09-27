import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import type { IntegrationNodeData } from './jsonIO'
import { absolutePosition, orderParentsFirst } from './nodeGrouping'

const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  integration: { width: 180, height: 90 },
  diagram: { width: 160, height: 100 },
  annotation: { width: 180, height: 120 },
  group: { width: 320, height: 200 },
}

function getNodeSize(node: Node<IntegrationNodeData>): { width: number; height: number } {
  const defaults = DEFAULT_SIZES[node.type ?? 'integration'] ?? DEFAULT_SIZES.integration
  const width = Number(node.measured?.width ?? node.style?.width ?? defaults.width)
  const height = Number(node.measured?.height ?? node.style?.height ?? defaults.height)
  return { width, height }
}

const TIER_COLUMNS: Record<string, number> = {
  saas: 0,
  external: 0,
  middleware: 1,
  aws: 2,
  azure: 2,
  powerplatform: 0,
  cloud: 2,
  diagram: 2,
  database: 3,
  onpremise: 4,
  note: 2,
  group: -1,
}

const COL_X = [80, 360, 640, 920, 1200]
const ROW_GAP = 110
const START_Y = 80

export function layoutFlow(
  nodes: Node<IntegrationNodeData>[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR',
): Node<IntegrationNodeData>[] {
  return layoutPreservingGroups(nodes, (world) => positionFlow(world, edges, direction))
}

function positionFlow(
  nodes: Node<IntegrationNodeData>[],
  edges: Edge[],
  direction: 'LR' | 'TB',
): Node<IntegrationNodeData>[] {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 })

  const layoutNodes = nodes.filter((n) => n.type !== 'group')

  layoutNodes.forEach((node) => {
    const { width, height } = getNodeSize(node)
    graph.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target)
    }
  })

  dagre.layout(graph)

  const positioned = nodes.map((node) => {
    if (node.type === 'group') return node
    const dagreNode = graph.node(node.id)
    if (!dagreNode) return node
    return {
      ...node,
      position: {
        x: dagreNode.x - dagreNode.width / 2,
        y: dagreNode.y - dagreNode.height / 2,
      },
    }
  })

  return positioned
}

export function layoutByTier(nodes: Node<IntegrationNodeData>[]): Node<IntegrationNodeData>[] {
  return layoutPreservingGroups(nodes, (world) => positionByTier(world))
}

function positionByTier(nodes: Node<IntegrationNodeData>[]): Node<IntegrationNodeData>[] {
  const columnCounts: Record<number, number> = {}
  const groupNodes = nodes.filter((n) => n.type === 'group')
  const contentNodes = nodes.filter((n) => n.type !== 'group')

  const positioned = contentNodes.map((node) => {
    const col = TIER_COLUMNS[node.data.systemType] ?? 2
    columnCounts[col] = (columnCounts[col] ?? 0) + 1
    const row = columnCounts[col] - 1
    const { height } = getNodeSize(node)

    return {
      ...node,
      position: {
        x: COL_X[col] ?? COL_X[2],
        y: START_Y + row * (height + ROW_GAP),
      },
    }
  })

  return [...positioned, ...groupNodes]
}

export function layoutGrid(nodes: Node<IntegrationNodeData>[]): Node<IntegrationNodeData>[] {
  return layoutPreservingGroups(nodes, (world) => positionGrid(world))
}

function positionGrid(nodes: Node<IntegrationNodeData>[]): Node<IntegrationNodeData>[] {
  const COLS = 4
  const GAP_X = 220
  const GAP_Y = 120
  const groupNodes = nodes.filter((n) => n.type === 'group')
  const contentNodes = nodes.filter((n) => n.type !== 'group')

  const positioned = contentNodes.map((node, index) => {
    const col = index % COLS
    const row = Math.floor(index / COLS)
    return {
      ...node,
      position: {
        x: 80 + col * GAP_X,
        y: 80 + row * GAP_Y,
      },
    }
  })

  return [...positioned, ...groupNodes]
}

/**
 * Chooses a layout based on the information available in the diagram. Connected
 * architecture diagrams benefit most from a directional flow; disconnected
 * components stay readable in a grid; and varied platform landscapes read best
 * in technology tiers.
 */
export function layoutSmart(
  nodes: Node<IntegrationNodeData>[],
  edges: Edge[],
): Node<IntegrationNodeData>[] {
  const contentNodes = nodes.filter((node) => node.type !== 'group')
  const connectedEdges = edges.filter(
    (edge) =>
      contentNodes.some((node) => node.id === edge.source) &&
      contentNodes.some((node) => node.id === edge.target),
  )

  if (connectedEdges.length > 0) return layoutFlow(nodes, connectedEdges, 'LR')

  const systemTypes = new Set(contentNodes.map((node) => node.data.systemType))
  if (systemTypes.size >= 3) return layoutByTier(nodes)

  return layoutGrid(nodes)
}

function layoutPreservingGroups(
  nodes: Node<IntegrationNodeData>[],
  positionContent: (world: Node<IntegrationNodeData>[]) => Node<IntegrationNodeData>[],
): Node<IntegrationNodeData>[] {
  const membership = groupMembership(nodes)
  const world = toWorldNodes(nodes)
  const moved = positionContent(world)
  return attachGroups(moved, membership)
}

function toWorldNodes(nodes: Node<IntegrationNodeData>[]): Node<IntegrationNodeData>[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return nodes.map((node) => ({
    ...node,
    position: absolutePosition(node, byId),
    parentId: undefined,
    extent: undefined,
    expandParent: undefined,
  }))
}

/** Components a group actually contains: its children, or the nodes sitting inside its box. */
function groupMembership(nodes: Node<IntegrationNodeData>[]): Map<string, string[]> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const groups = nodes.filter((node) => node.type === 'group' || node.data.systemType === 'group')
  const claimed = new Set<string>()
  const membership = new Map<string, string[]>()

  for (const group of groups) {
    const children = nodes.filter((node) => node.parentId === group.id && !claimed.has(node.id)).map((node) => node.id)
    if (children.length === 0) continue
    children.forEach((id) => claimed.add(id))
    membership.set(group.id, children)
  }

  const loose = groups
    .filter((group) => !membership.has(group.id))
    .map((group) => {
      const position = absolutePosition(group, byId)
      const width = Number(group.style?.width ?? group.measured?.width ?? 320)
      const height = Number(group.style?.height ?? group.measured?.height ?? 200)
      return { group, position, width, height, area: width * height }
    })
    .sort((a, b) => a.area - b.area)

  for (const item of loose) {
    const inside: string[] = []
    for (const node of nodes) {
      if (node.id === item.group.id || claimed.has(node.id)) continue
      if (node.type === 'group' || node.data.systemType === 'group') continue
      if (node.type === 'annotation' || node.data.systemType === 'note') continue
      const position = absolutePosition(node, byId)
      const size = getNodeSize(node)
      const cx = position.x + size.width / 2
      const cy = position.y + size.height / 2
      if (
        cx >= item.position.x &&
        cy >= item.position.y &&
        cx <= item.position.x + item.width &&
        cy <= item.position.y + item.height
      ) {
        inside.push(node.id)
      }
    }
    if (inside.length === 0) continue
    inside.forEach((id) => claimed.add(id))
    membership.set(item.group.id, inside)
  }

  return membership
}

function attachGroups(
  nodes: Node<IntegrationNodeData>[],
  membership: Map<string, string[]>,
): Node<IntegrationNodeData>[] {
  if (membership.size === 0) return nodes
  const next = nodes.map((node) => ({ ...node }))
  const byId = new Map(next.map((node) => [node.id, node]))
  const padX = 28
  const padTop = 44
  const padBottom = 28
  const ordered = [...membership.entries()].sort(
    (a, b) => groupDepth(b[0], membership) - groupDepth(a[0], membership),
  )

  for (const [groupId, memberIds] of ordered) {
    const group = byId.get(groupId)
    const members = memberIds.map((id) => byId.get(id)).filter((node): node is Node<IntegrationNodeData> => Boolean(node))
    if (!group || members.length === 0) continue
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of members) {
      const size = getNodeSize(node)
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + size.width)
      maxY = Math.max(maxY, node.position.y + size.height)
    }
    const position = { x: minX - padX, y: minY - padTop }
    group.position = position
    group.parentId = undefined
    group.extent = undefined
    group.expandParent = undefined
    group.style = {
      ...group.style,
      width: maxX - minX + padX * 2,
      height: maxY - minY + padTop + padBottom,
    }
    for (const node of members) {
      node.parentId = groupId
      node.extent = 'parent'
      node.expandParent = true
      node.position = { x: node.position.x - position.x, y: node.position.y - position.y }
    }
  }

  return orderParentsFirst(next)
}

function groupDepth(id: string, membership: Map<string, string[]>): number {
  const nested = (membership.get(id) ?? []).filter((memberId) => membership.has(memberId))
  if (nested.length === 0) return 0
  return 1 + Math.max(...nested.map((memberId) => groupDepth(memberId, membership)))
}
