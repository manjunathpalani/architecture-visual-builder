import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import type { IntegrationNodeData } from './jsonIO'

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
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 })

  const layoutNodes = nodes.filter((n) => n.type !== 'group')
  const groupNodes = nodes.filter((n) => n.type === 'group')

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

  return repositionGroups(positioned, groupNodes)
}

export function layoutByTier(nodes: Node<IntegrationNodeData>[]): Node<IntegrationNodeData>[] {
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

  const allNodes = [...positioned, ...groupNodes]
  return repositionGroups(allNodes, groupNodes)
}

export function layoutGrid(nodes: Node<IntegrationNodeData>[]): Node<IntegrationNodeData>[] {
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

  return repositionGroups([...positioned, ...groupNodes], groupNodes)
}

function repositionGroups(
  nodes: Node<IntegrationNodeData>[],
  groupNodes: Node<IntegrationNodeData>[],
): Node<IntegrationNodeData>[] {
  if (groupNodes.length === 0) return nodes

  const contentNodes = nodes.filter((n) => n.type !== 'group')
  const bounds = getContentBounds(contentNodes)

  return nodes.map((node) => {
    if (node.type !== 'group') return node

    const zone = node.data.properties.zone
    if (zone) {
      const zoneBounds = getZoneBounds(contentNodes, zone)
      if (zoneBounds) {
        return {
          ...node,
          position: { x: zoneBounds.x - 24, y: zoneBounds.y - 36 },
          style: {
            ...node.style,
            width: zoneBounds.width + 48,
            height: zoneBounds.height + 56,
          },
        }
      }
    }

    if (bounds) {
      return {
        ...node,
        position: { x: bounds.x - 32, y: bounds.y - 40 },
        style: {
          ...node.style,
          width: bounds.width + 64,
          height: bounds.height + 64,
        },
      }
    }

    return node
  })
}

function getContentBounds(nodes: Node<IntegrationNodeData>[]) {
  if (nodes.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  nodes.forEach((node) => {
    const { width, height } = getNodeSize(node)
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + width)
    maxY = Math.max(maxY, node.position.y + height)
  })

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function getZoneBounds(nodes: Node<IntegrationNodeData>[], zone: string) {
  const zoneMap: Record<string, string[]> = {
    SaaS: ['saas', 'external'],
    Cloud: ['aws', 'azure', 'cloud', 'middleware', 'database'],
    'On-Premise': ['onpremise'],
  }

  const types = zoneMap[zone]
  if (!types) return null

  const filtered = nodes.filter((n) => types.includes(n.data.systemType))
  return getContentBounds(filtered)
}