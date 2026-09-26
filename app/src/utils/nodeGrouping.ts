import type { Edge, Node } from '@xyflow/react'
import type { IntegrationEdgeData, IntegrationNodeData } from './jsonIO'
import type { Position } from '../types'

export function absolutePosition(
  node: Node<IntegrationNodeData>,
  byId: Map<string, Node<IntegrationNodeData>>,
): Position {
  let x = node.position.x
  let y = node.position.y
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && byId.has(parentId) && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)!
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

export function orderParentsFirst(nodes: Node<IntegrationNodeData>[]): Node<IntegrationNodeData>[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const done = new Set<string>()
  const visiting = new Set<string>()
  const ordered: Node<IntegrationNodeData>[] = []

  const visit = (node: Node<IntegrationNodeData>) => {
    if (done.has(node.id) || visiting.has(node.id)) return
    visiting.add(node.id)
    if (node.parentId && byId.has(node.parentId)) visit(byId.get(node.parentId)!)
    visiting.delete(node.id)
    done.add(node.id)
    ordered.push(node)
  }

  nodes.forEach(visit)
  return ordered
}

export function descendantIds(
  rootIds: Iterable<string>,
  nodes: Node<IntegrationNodeData>[],
): Set<string> {
  const ids = new Set(rootIds)
  let added = true
  while (added) {
    added = false
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id)
        added = true
      }
    }
  }
  return ids
}

export function shiftInternalWaypoints(
  edges: Edge<IntegrationEdgeData>[],
  memberIds: Set<string>,
  dx: number,
  dy: number,
): Edge<IntegrationEdgeData>[] {
  if (dx === 0 && dy === 0) return edges
  return edges.map((edge) => {
    const sourceIn = memberIds.has(edge.source)
    const targetIn = memberIds.has(edge.target)
    if (!sourceIn || !targetIn) return edge
    const waypoints = edge.data?.waypoints
    if (!waypoints?.length) return edge
    return {
      ...edge,
      data: {
        ...(edge.data as IntegrationEdgeData),
        waypoints: waypoints.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      },
    }
  })
}

export function groupFlowNodes(
  nodes: Node<IntegrationNodeData>[],
  selectedIds: Set<string>,
  groupId: string,
): Node<IntegrationNodeData>[] {
  const members = nodes.filter((node) => selectedIds.has(node.id) && node.type !== 'group' && node.data.systemType !== 'group')
  if (members.length === 0) return nodes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const abs = members.map((node) => {
    const position = absolutePosition(node, byId)
    const width = Number(node.measured?.width ?? node.style?.width ?? 180)
    const height = Number(node.measured?.height ?? node.style?.height ?? 90)
    return { node, position, width, height }
  })
  const padX = 28
  const padTop = 44
  const padBottom = 28
  const bounds = abs.reduce(
    (result, item) => ({
      left: Math.min(result.left, item.position.x),
      top: Math.min(result.top, item.position.y),
      right: Math.max(result.right, item.position.x + item.width),
      bottom: Math.max(result.bottom, item.position.y + item.height),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  )
  const groupPosition = { x: bounds.left - padX, y: bounds.top - padTop }
  const group: Node<IntegrationNodeData> = {
    id: groupId,
    type: 'group',
    position: groupPosition,
    zIndex: -1,
    data: {
      systemType: 'group',
      label: 'Group',
      category: 'Infrastructure',
      properties: {},
      canDrillIn: false,
    },
    style: {
      width: bounds.right - bounds.left + padX * 2,
      height: bounds.bottom - bounds.top + padTop + padBottom,
    },
    selected: true,
  }

  const memberIds = new Set(members.map((node) => node.id))
  const next = nodes.map((node) => {
    if (!memberIds.has(node.id)) return { ...node, selected: false }
    const world = absolutePosition(node, byId)
    return {
      ...node,
      parentId: groupId,
      extent: 'parent' as const,
      expandParent: true,
      position: { x: world.x - groupPosition.x, y: world.y - groupPosition.y },
      selected: false,
    }
  })
  return orderParentsFirst([group, ...next.filter((node) => node.id !== groupId)])
}

export function ungroupFlowNodes(
  nodes: Node<IntegrationNodeData>[],
  selectedIds: Set<string>,
): Node<IntegrationNodeData>[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const groupIds = new Set(
    nodes.filter((node) => selectedIds.has(node.id) && (node.type === 'group' || node.data.systemType === 'group')).map((node) => node.id),
  )
  for (const node of nodes) {
    if (selectedIds.has(node.id) && node.parentId) groupIds.add(node.parentId)
  }
  if (groupIds.size === 0) return nodes

  const next = nodes
    .filter((node) => !(groupIds.has(node.id) && (node.type === 'group' || node.data.systemType === 'group')))
    .map((node) => {
      if (!node.parentId || !groupIds.has(node.parentId)) return node
      const world = absolutePosition(node, byId)
      return {
        ...node,
        parentId: undefined,
        extent: undefined,
        expandParent: undefined,
        position: world,
        selected: true,
      }
    })

  return orderParentsFirst(next)
}
